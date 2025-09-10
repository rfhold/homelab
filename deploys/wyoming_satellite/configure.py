from pyinfra.context import host
from pyinfra.operations import files, systemd, server
from pyinfra.facts.server import Home
from pyinfra.operations.util import any_changed


def _install_custom_wake_words(home: str, custom_models: list) -> None:
    custom_dir = f"{home}/custom-wake-words"

    files.directory(
        name="Create custom wake words directory",
        path=custom_dir,
        mode="0755",
        present=True,
    )

    for model in custom_models:
        model_name = model.get("name")
        model_url = model.get("url")

        if not model_name or not model_url:
            continue

        model_file = f"{custom_dir}/{model_name}.tflite"

        files.download(
            name=f"Download custom wake word model {model_name}",
            src=model_url,
            dest=model_file,
            mode="644",
        )


def configure() -> None:
    home = host.get_fact(Home)
    config = host.data.get("wyoming_satellite", {})

    satellite_name = config.get("name", "my satellite")
    satellite_uri = config.get("uri", "tcp://0.0.0.0:10700")

    audio_config = config.get("audio", {})
    mic_device = audio_config.get(
        "mic_device", "plughw:CARD=seeed2micvoicec,DEV=0")
    speaker_device = audio_config.get(
        "speaker_device", "plughw:CARD=seeed2micvoicec,DEV=0")

    mic_command = f"arecord -D {mic_device} -r 16000 -c 1 -f S16_LE -t raw"
    snd_command = f"aplay -D {speaker_device} -r 22050 -c 1 -f S16_LE -t raw"

    enhancements = config.get("enhancements", {})
    auto_gain = enhancements.get("auto_gain")
    noise_suppression = enhancements.get("noise_suppression")
    mic_volume_multiplier = enhancements.get("mic_volume_multiplier")
    snd_volume_multiplier = enhancements.get("snd_volume_multiplier")

    wake_config = config.get("wake_word", {})
    openwakeword_enabled = wake_config.get("enabled", False)
    wake_uri = wake_config.get("uri", "tcp://127.0.0.1:10400")
    wake_word_name = wake_config.get("name", "ok_nabu")
    custom_models = wake_config.get("custom_models", [])
    preload_models = wake_config.get("preload_models", [])

    led_config = config.get("led_service", {})
    led_enabled = led_config.get("enabled", False)
    led_uri = led_config.get("uri", "tcp://127.0.0.1:10500")
    led_type = led_config.get("type", "2mic")
    led_brightness = led_config.get("brightness", 15)

    service_requires = []
    exec_args = [
        f"--name '{satellite_name}'",
        f"--uri '{satellite_uri}'",
        f"--mic-command '{mic_command}'",
        f"--snd-command '{snd_command}'"
    ]

    if auto_gain is not None:
        exec_args.append(f"--mic-auto-gain {auto_gain}")

    if noise_suppression is not None:
        exec_args.append(f"--mic-noise-suppression {noise_suppression}")

    if mic_volume_multiplier is not None:
        exec_args.append(f"--mic-volume-multiplier {mic_volume_multiplier}")

    if snd_volume_multiplier is not None:
        exec_args.append(f"--snd-volume-multiplier {snd_volume_multiplier}")

    if openwakeword_enabled:
        service_requires.append("wyoming-openwakeword.service")
        exec_args.extend([
            f"--wake-uri '{wake_uri}'",
            f"--wake-word-name '{wake_word_name}'"
        ])

    if led_enabled:
        if led_type == "2mic":
            service_requires.append("2mic_leds.service")
        elif led_type == "4mic":
            service_requires.append("4mic_leds.service")
        exec_args.append(f"--event-uri '{led_uri}'")

    wyoming_satellite_service = files.template(
        name="Create wyoming-satellite systemd service",
        _sudo=True,
        src="deploys/wyoming_satellite/templates/wyoming-satellite.service.j2",
        dest="/etc/systemd/system/wyoming-satellite.service",
        user="root",
        group="root",
        mode="0644",
        backup=True,

        home_dir=home,
        exec_args=" ".join(exec_args),
        service_requires=service_requires,
    )

    openwakeword_service = None
    if openwakeword_enabled:
        if custom_models:
            _install_custom_wake_words(home, custom_models)

        custom_model_dir = f"{
            home}/custom-wake-words" if custom_models else None

        openwakeword_service = files.template(
            name="Create wyoming-openwakeword systemd service",
            _sudo=True,
            src="deploys/wyoming_satellite/templates/wyoming-openwakeword.service.j2",
            dest="/etc/systemd/system/wyoming-openwakeword.service",
            user="root",
            group="root",
            mode="0644",
            backup=True,

            home_dir=home,
            wake_uri=wake_uri,
            custom_model_dir=custom_model_dir,
            preload_models=preload_models,
        )

    led_service = None
    if led_enabled:
        led_service_name = f"{led_type}_leds"
        led_script_name = f"{led_type}_service.py"

        led_args = [f"--uri '{led_uri}'"]
        if led_brightness != 15:
            led_args.append(f"--led-brightness {led_brightness}")

        led_service = files.template(
            name=f"Create {led_service_name} systemd service",
            _sudo=True,
            src="deploys/wyoming_satellite/templates/led_service.service.j2",
            dest=f"/etc/systemd/system/{led_service_name}.service",
            user="root",
            group="root",
            mode="0644",
            backup=True,

            service_name=led_service_name,
            service_description=f"{led_type.upper()} LEDs",
            home_dir=home,
            script_name=led_script_name,
            led_args=" ".join(led_args),
        )

    changed_services = [wyoming_satellite_service]
    if openwakeword_service:
        changed_services.append(openwakeword_service)
    if led_service:
        changed_services.append(led_service)

    systemd.daemon_reload(
        name="Reload systemd daemon if service files changed",
        _sudo=True,
        _if=any_changed(*changed_services),
    )

    systemd.service(
        name="Enable and start wyoming-satellite service",
        _sudo=True,
        service="wyoming-satellite.service",
        running=True,
        enabled=True,
        restarted=wyoming_satellite_service.did_change,
    )

    if openwakeword_enabled and openwakeword_service:
        systemd.service(
            name="Enable and start wyoming-openwakeword service",
            _sudo=True,
            service="wyoming-openwakeword.service",
            running=True,
            enabled=True,
            restarted=openwakeword_service.did_change,
        )

    if led_enabled and led_service:
        led_service_name = f"{led_type}_leds.service"
        systemd.service(
            name=f"Enable and start {led_service_name}",
            _sudo=True,
            service=led_service_name,
            running=True,
            enabled=True,
            restarted=led_service.did_change,
        )

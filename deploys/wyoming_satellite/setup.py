from pyinfra import host
from pyinfra.operations import apt, git, server, python, pip
from pyinfra.facts.server import Home
from pyinfra.api import FactBase


class DKMSModuleInstalled(FactBase):
    """
    Returns True if a DKMS module is installed, False otherwise.
    """

    def command(self, module_name):
        return f"/usr/sbin/dkms status | grep '{module_name}' >/dev/null 2>&1 && echo 'installed' || echo 'not_installed'"

    def process(self, output):
        return output and output[0].strip() == 'installed'


class VirtualEnvironment(FactBase):
    """
    Returns True if a virtual environment exists and has a Python interpreter.
    """

    def command(self, path):
        return f"test -f {path}/bin/python3 && echo 'exists' || echo 'not_exists'"

    def process(self, output):
        return output and output[0].strip() == 'exists'


def install() -> None:
    home = host.get_fact(Home)

    apt.update(
        name="Update apt repositories",
        _sudo=True,
        cache_time=3600,  # Only update if cache is older than 1 hour
    )

    apt.packages(
        name="Install wyoming-satellite system dependencies",
        _sudo=True,
        packages=[
            "git",
            "python3-venv",
            "libopenblas-dev",
            "python3-spidev",
            "python3-gpiozero",
        ],
        update=False,
    )

    satellite_repo = git.repo(
        name="Clone wyoming-satellite repository",
        src="https://github.com/rhasspy/wyoming-satellite.git",
        dest=f"{home}/wyoming-satellite",
        branch="master",
        pull=False,  # Don't auto-pull, only clone if missing
    )

    openwakeword_repo = git.repo(
        name="Clone wyoming-openwakeword repository",
        src="https://github.com/rhasspy/wyoming-openwakeword.git",
        dest=f"{home}/wyoming-openwakeword",
        branch="master",
        pull=False,  # Don't auto-pull, only clone if missing
    )

    respeaker_config = host.data.get("respeaker_hat", {})
    if respeaker_config.get("enabled", False):
        # Check if seeed-voicecard DKMS module is already installed
        dkms_installed = host.get_fact(
            DKMSModuleInstalled, module_name="seeed-voicecard")

        if not dkms_installed:
            server.shell(
                name="Install ReSpeaker drivers",
                _sudo=True,
                commands=[
                    f"cd {home}/wyoming-satellite && bash etc/install-respeaker-drivers.sh"],
                _timeout=3600,
            )

    # Check if virtual environment exists
    satellite_venv_exists = host.get_fact(
        VirtualEnvironment, path=f"{home}/wyoming-satellite/.venv"
    )

    if not satellite_venv_exists:
        server.shell(
            name="Create wyoming-satellite virtual environment",
            _sudo=True,
            commands=[
                f"python3 -m venv {home}/wyoming-satellite/.venv"
            ],
        )

    pip.packages(
        name="Install wyoming-satellite Python packages",
        packages=["pip", "wheel", "setuptools"],
        pip=f"{home}/wyoming-satellite/.venv/bin/pip3",
        _sudo=True,
        latest=False,  # Don't force latest, only install if missing
    )

    server.shell(
        name="Install wyoming-satellite with extras",
        _sudo=True,
        commands=[
            f"cd {
                home}/wyoming-satellite && .venv/bin/pip3 install -f 'https://synesthesiam.github.io/prebuilt-apps/' -e '.[all]'"
        ],
        _if=satellite_repo.did_change,
    )

    server.shell(
        name="Setup wyoming-openwakeword",
        commands=[f"cd {home}/wyoming-openwakeword && script/setup"],
        _if=openwakeword_repo.did_change,
    )

    # Check if LED service virtual environment exists
    led_venv_exists = host.get_fact(
        VirtualEnvironment, path=f"{home}/wyoming-satellite/examples/.venv"
    )

    if not led_venv_exists:
        server.shell(
            name="Create LED service virtual environment",
            _sudo=True,
            commands=[
                f"python3 -m venv --system-site-packages {home}/wyoming-satellite/examples/.venv"
            ],
        )

    pip.packages(
        name="Install LED service Python packages",
        _sudo=True,
        packages=["pip", "wheel", "setuptools", "wyoming==1.5.2"],
        pip=f"{home}/wyoming-satellite/examples/.venv/bin/pip3",
        latest=False,  # Don't force latest, only install if missing
    )

    led_config = host.data.get("wyoming_satellite", {}).get("led_service", {})
    if led_config.get("type") == "usb_4mic":
        pip.packages(
            name="Install pixel-ring for USB 4mic array",
            _sudo=True,
            packages=["pixel-ring"],
            pip=f"{home}/wyoming-satellite/examples/.venv/bin/pip3",
            latest=False,  # Don't force latest, only install if missing
        )

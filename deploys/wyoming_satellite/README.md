# Wyoming Satellite Host Deploy

This guide describes tracked PyInfra source. It does not establish that a satellite is configured, deployed, reachable, or using a wake word. See [`../../docs/voice-satellites/verification.md`](../../docs/voice-satellites/verification.md).

## Required Host Data

[`../wyoming-satellite-deploy.py`](../wyoming-satellite-deploy.py) skips a host unless it has a non-empty `wyoming_satellite` block. A minimal source-shaped example is:

```python
"wyoming_satellite": {
    "name": "<satellite-name>",
    "uri": "tcp://0.0.0.0:10700",
    "audio": {
        "mic_device": "<alsa-input-device>",
        "speaker_device": "<alsa-output-device>",
    },
}
```

This is a synthetic example, not inventory or deployment evidence.

| Key | Source behavior |
| --- | --- |
| `name` | Satellite display name; source default is `my satellite` |
| `uri` | Wyoming Satellite listen URI; source default is `tcp://0.0.0.0:10700` |
| `audio.mic_device` | ALSA device used to build the `arecord` command |
| `audio.speaker_device` | ALSA device used to build the `aplay` command |
| `enhancements` | Optional auto-gain, noise-suppression, and volume arguments |
| `led_service` | Optional event-service branch and brightness setting |
| `wake_word` | Optional openWakeWord branch, disabled when absent or not enabled |

The optional wake-word branch accepts a URI, selected name, model download entries, and preload names. Its presence in source is not evidence that any host selects it. Custom model files are written beneath the remote user's home directory, not a hard-coded `/home/pi` path.

The separate top-level `respeaker_hat.enabled` host-data setting gates the source's ReSpeaker driver installation path.

## Tracked Host Changes

[`setup.py`](setup.py) uses APT, clones the Wyoming Satellite and openWakeWord repositories, creates Python environments, and installs optional hardware dependencies. [`configure.py`](configure.py) always manages `wyoming-satellite.service` after the required host data passes validation. It conditionally manages openWakeWord and LED services when their source branches are enabled.

## Execution

This command can install packages, download code or models, write systemd units, and start or restart services:

```bash
uv run pyinfra inventory.py --limit <authorized-host> deploys/wyoming-satellite-deploy.py
```

Use only after explicit authorization for the host and reviewed host data. Do not infer a group-wide target or wake-word choice from this guide.

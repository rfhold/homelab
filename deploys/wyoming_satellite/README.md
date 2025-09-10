# Wyoming Satellite Deployment

This deployment configures Wyoming Satellite voice assistants with support for custom wake words.

## Configuration

### Basic Configuration

```python
"wyoming_satellite": {
    "name": "satellite-name",
    "uri": "tcp://0.0.0.0:10700",
    "audio": {
        "mic_device": "plughw:CARD=seeed2micvoicec,DEV=0",
        "speaker_device": "plughw:CARD=seeed2micvoicec,DEV=0"
    },
    "wake_word": {
        "enabled": True,
        "uri": "tcp://127.0.0.1:10400",
        "name": "ok_nabu"
    }
}
```

### Custom Wake Words

To use custom wake word models from the Home Assistant wake words collection or other sources:

```python
"wake_word": {
    "enabled": True,
    "uri": "tcp://127.0.0.1:10400",
    "name": "computer_v2",  # Wake word name to use
    "custom_models": [
        {
            "name": "computer_v2",
            "url": "https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/computer/computer_v2.tflite"
        }
    ],
    "preload_models": ["computer_v2"]  # Models to preload at startup
}
```

### Configuration Options

#### Wake Word Settings

- `enabled`: Enable wake word detection
- `uri`: Wyoming OpenWakeWord service URI
- `name`: Wake word name to use for detection
- `custom_models`: List of custom wake word models to download
  - `name`: Model name (without .tflite extension)
  - `url`: Direct download URL for the .tflite model file
- `preload_models`: List of model names to preload at service startup

#### Custom Models

Custom wake word models are downloaded to `/home/pi/custom-wake-words/` and configured with proper permissions (pi:pi ownership, 644 permissions).

The Wyoming OpenWakeWord service is automatically configured with:
- `--custom-model-dir` pointing to the custom models directory
- `--preload-model` for each model specified in `preload_models`

#### Audio Configuration

- `mic_device`: Audio input device (ALSA format)
- `speaker_device`: Audio output device (ALSA format)

#### Audio Enhancements

```python
"enhancements": {
    "auto_gain": 5,
    "noise_suppression": 2,
    "mic_volume_multiplier": 1.0,
    "snd_volume_multiplier": 1.0
}
```

#### LED Service

```python
"led_service": {
    "enabled": True,
    "type": "2mic",  # or "4mic", "usb_4mic"
    "uri": "tcp://127.0.0.1:10500",
    "brightness": 2
}
```

## Example Configurations

### Default Wake Word (ok_nabu)

```python
("satellite.example.com", {
    "wyoming_satellite": {
        "name": "living-room",
        "uri": "tcp://0.0.0.0:10700",
        "wake_word": {
            "enabled": True,
            "name": "ok_nabu"
        }
    }
})
```

### Custom Wake Word (computer_v2)

```python
("satellite.example.com", {
    "wyoming_satellite": {
        "name": "office",
        "uri": "tcp://0.0.0.0:10700",
        "wake_word": {
            "enabled": True,
            "name": "computer_v2",
            "custom_models": [
                {
                    "name": "computer_v2",
                    "url": "https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/computer/computer_v2.tflite"
                }
            ],
            "preload_models": ["computer_v2"]
        }
    }
})
```

### Multiple Custom Wake Words

```python
("satellite.example.com", {
    "wyoming_satellite": {
        "name": "kitchen",
        "uri": "tcp://0.0.0.0:10700",
        "wake_word": {
            "enabled": True,
            "name": "jarvis_v1",
            "custom_models": [
                {
                    "name": "jarvis_v1",
                    "url": "https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/jarvis/jarvis_v1.tflite"
                },
                {
                    "name": "computer_v2",
                    "url": "https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/computer/computer_v2.tflite"
                }
            ],
            "preload_models": ["jarvis_v1", "computer_v2"]
        }
    }
})
```

## Available Wake Words

Popular custom wake words from the Home Assistant collection:

- `computer_v2`: "Computer" - https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/computer/computer_v2.tflite
- `jarvis_v1`: "Jarvis" - https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/jarvis/jarvis_v1.tflite
- `alexa_v0_1`: "Alexa" - https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/alexa/alexa_v0_1.tflite

## Deployment

Deploy to a specific host:

```bash
pyinfra inventory.py deploys/wyoming-satellite-deploy.py --limit satellite.example.com
```

Deploy to all voice satellites:

```bash
pyinfra inventory.py deploys/wyoming-satellite-deploy.py --limit voice
```

## Service Management

After deployment, services are managed via systemd:

```bash
# Check status
sudo systemctl status wyoming-satellite.service
sudo systemctl status wyoming-openwakeword.service

# View logs
sudo journalctl -u wyoming-satellite.service -f
sudo journalctl -u wyoming-openwakeword.service -f

# Restart services
sudo systemctl restart wyoming-satellite.service
sudo systemctl restart wyoming-openwakeword.service
```

## Troubleshooting

### Wake Word Not Detected

1. Check if custom models are downloaded:
   ```bash
   ls -la /home/pi/custom-wake-words/
   ```

2. Verify OpenWakeWord service configuration:
   ```bash
   sudo systemctl cat wyoming-openwakeword.service
   ```

3. Check service logs:
   ```bash
   sudo journalctl -u wyoming-openwakeword.service -f
   ```

### Audio Issues

1. List audio devices:
   ```bash
   arecord -l
   aplay -l
   ```

2. Test microphone:
   ```bash
   arecord -D plughw:CARD=seeed2micvoicec,DEV=0 -r 16000 -c 1 -f S16_LE -t wav test.wav
   ```

3. Test speaker:
   ```bash
   aplay -D plughw:CARD=seeed2micvoicec,DEV=0 test.wav
   ```

## Hardware Support

- ReSpeaker 2-Mic Pi HAT
- ReSpeaker 4-Mic Pi HAT
- ReSpeaker USB 4-Mic Array
- Generic USB microphones and speakers

ReSpeaker drivers are automatically installed when `respeaker_hat.enabled: True` is configured.
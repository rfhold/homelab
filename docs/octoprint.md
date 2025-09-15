# OctoPrint Containerization Guide

## Overview

OctoPrint is a web-based 3D printer control and monitoring interface that provides remote access to 3D printers. This guide covers containerizing OctoPrint with static configuration, community plugins, and printer connectivity.

## Container Images

### Official Image
- **Repository**: `octoprint/octoprint`
- **Recommended Tag**: `latest` (stable) or `edge` (includes prereleases)
- **Architecture**: Multi-arch support (amd64, arm64, arm/v7)
- **Size**: ~500MB
- **Base**: Python 3.10-slim-bullseye

### Available Tags
- `latest` - Latest stable release
- `edge` - Latest release including prereleases
- `canary` - Maintenance branch
- `bleeding` - Development branch
- `minimal` - Lightweight without mjpg-streamer
- `X.Y.Z` - Specific version tags

## Resource Requirements

### Minimum
- **CPU**: 1 core
- **Memory**: 256MB
- **Storage**: 1GB

### Recommended
- **CPU**: 2+ cores (for webcam streaming)
- **Memory**: 1-2GB RAM
- **Storage**: 10GB+ for G-code files and timelapses

## Volume Configuration

### Essential Mounts
```yaml
volumes:
  - octoprint-data:/octoprint
```

### Directory Structure
```
/octoprint/
├── octoprint/
│   ├── config.yaml          # Main configuration
│   ├── users.yaml           # User database
│   ├── uploads/             # G-code files
│   ├── timelapse/          # Timelapse recordings
│   └── logs/               # Application logs
└── plugins/                # Manually installed plugins
```

## Environment Variables

### Core Settings
```yaml
environment:
  - ENABLE_MJPG_STREAMER=true    # Enable webcam streaming
  - CAMERA_DEV=/dev/video0       # Camera device (supports comma-separated list)
  - MJPG_STREAMER_INPUT=-n -r 640x480  # Webcam parameters
  - AUTOMIGRATE=false            # Auto-migrate from previous versions
```

## Static Configuration

### Main Configuration File (`config.yaml`)

```yaml
server:
  host: 0.0.0.0
  port: 80
  commands:
    serverRestartCommand: s6-svc -r /var/run/s6/services/octoprint

# Printer Connection
serial:
  port: /dev/ttyACM0           # Serial port for printer
  baudrate: 115200             # Communication speed
  autoconnect: false           # Auto-connect on startup
  timeout:
    detection: 5               # Device detection timeout
    connection: 10             # Connection timeout
    communication: 30          # Communication timeout

# Webcam Configuration
webcam:
  stream: /webcam/?action=stream
  snapshot: http://localhost:8080/?action=snapshot
  ffmpeg: /usr/bin/ffmpeg
  bitrate: 5000k
  watermark: true
  flipH: false
  flipV: false
  rotate90: false

# Plugin Management
plugins:
  _disabled: []                # List of disabled plugins
  pluginmanager:
    repository: https://plugins.octoprint.org/plugins.json

# API Configuration
api:
  enabled: true
  key: your-api-key-here      # Generate via UI or set manually
  allowCrossOrigin: false
```

### User Configuration (`users.yaml`)

```yaml
testuser:
  password: hashed-password-here
  active: true
  roles:
    - user
    - admin
  settings: {}
```

## Device Mapping

### Printer Connection
```yaml
devices:
  - /dev/ttyACM0:/dev/ttyACM0   # Most common USB serial
  - /dev/ttyUSB0:/dev/ttyUSB0   # Alternative USB serial
```

### Webcam Access
```yaml
devices:
  - /dev/video0:/dev/video0     # Primary webcam
  - /dev/video1:/dev/video1     # Secondary webcam (optional)
```

## Community Plugin Management

### Pre-installation Methods

#### 1. Custom Dockerfile Approach
```dockerfile
FROM octoprint/octoprint:latest

# Install popular plugins
RUN pip install \
    "OctoPrint-PrintTimeGenius" \
    "OctoPrint-DisplayLayerProgress" \
    "OctoPrint-FilamentManager" \
    "OctoPrint-BedLevelVisualizer" \
    "OctoPrint-TheSpaghettiDetective"
```

#### 2. Runtime Installation Script
```bash
#!/bin/bash
# install-plugins.sh
pip install "OctoPrint-PrintTimeGenius"
pip install "OctoPrint-DisplayLayerProgress" 
pip install "OctoPrint-FilamentManager"
pip install "OctoPrint-BedLevelVisualizer"
pip install "OctoPrint-TheSpaghettiDetective"
```

#### 3. Plugin List Configuration
Configure plugins to install via config.yaml:
```yaml
plugins:
  pluginmanager:
    repository: https://plugins.octoprint.org/plugins.json
    pip_args: --user
    pip_force_user: false
```

### Popular Community Plugins

#### Essential Plugins
- **OctoPrint-PrintTimeGenius**: Advanced print time estimation
- **OctoPrint-DisplayLayerProgress**: Layer progress display
- **OctoPrint-FilamentManager**: Filament usage tracking
- **OctoPrint-BedLevelVisualizer**: Bed leveling visualization

#### Monitoring & Control
- **OctoPrint-TheSpaghettiDetective**: AI failure detection
- **OctoPrint-Enclosure**: Enclosure control (fans, lights, etc.)
- **OctoPrint-PSUControl**: Power supply control
- **OctoPrint-TouchUI**: Touch-friendly interface

#### File Management
- **OctoPrint-FileManager**: Enhanced file management
- **OctoPrint-UltimakerFormatPackage**: Ultimaker file format support

## Network Configuration

### Ports
- `80` - Main web interface
- `8080` - mjpg-streamer webcam stream

### Reverse Proxy Considerations
```yaml
server:
  reverseProxy:
    prefixHeader: X-Script-Name
    schemeHeader: X-Scheme
    hostHeader: X-Forwarded-Host
    prefixFallback: /octoprint
    schemeFallback: http
    trustBasicAuth: false
    trustRemoteUser: false
```

## Complete Docker Compose Example

```yaml
version: '3.8'

services:
  octoprint:
    image: octoprint/octoprint:latest
    restart: unless-stopped
    ports:
      - "80:80"
    devices:
      - /dev/ttyACM0:/dev/ttyACM0  # Printer connection
      - /dev/video0:/dev/video0     # Webcam
    volumes:
      - octoprint-data:/octoprint
      - ./config/config.yaml:/octoprint/octoprint/config.yaml:ro  # Static config
      - ./config/users.yaml:/octoprint/octoprint/users.yaml:ro    # User config
      - ./plugins:/octoprint/plugins  # Plugin directory
    environment:
      - ENABLE_MJPG_STREAMER=true
      - CAMERA_DEV=/dev/video0
      - MJPG_STREAMER_INPUT=-n -r 1280x720 -f 10
    depends_on:
      - plugin-installer

  # Optional: Plugin installation service
  plugin-installer:
    image: octoprint/octoprint:latest
    volumes:
      - octoprint-data:/octoprint
      - ./install-plugins.sh:/install-plugins.sh:ro
    command: ["/bin/bash", "/install-plugins.sh"]
    restart: "no"

volumes:
  octoprint-data:
```

## Security Configuration

### API Security
```yaml
api:
  enabled: true
  key: "generate-secure-api-key"  # Use pwgen or similar
  allowCrossOrigin: false
  apps:
    - appkey: "app-specific-key"
      name: "Mobile App"
```

### Access Control
```yaml
accessControl:
  enabled: true
  autologinLocal: false  # Disable for security
  autologinAs: null
  localNetworks:
    - "192.168.1.0/24"   # Your local network
```

## Troubleshooting

### Common Issues

#### Permission Denied on Serial Port
```bash
# Add dialout group to container or run privileged
docker run --privileged ...
# OR
docker run --group-add dialout ...
```

#### Webcam Not Found
```bash
# Check device availability
ls -la /dev/video*
# Ensure container has access
docker run --device /dev/video0 ...
```

#### Plugin Installation Failures
```bash
# Check plugin compatibility
pip install --dry-run "OctoPrint-PluginName"
# Install with verbose output
pip install -v "OctoPrint-PluginName"
```

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost/api/version"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

## Integration Notes

### Klipper Integration
For Klipper printers, use virtual serial port:
```yaml
serial:
  port: /tmp/printer  # Virtual serial port created by Klipper
  baudrate: 250000
```

### Home Assistant Integration
OctoPrint supports MQTT and REST API for Home Assistant integration:
```yaml
plugins:
  mqtt:
    broker:
      host: your-mqtt-broker
      port: 1883
    publish:
      events: true
      progress: true
```
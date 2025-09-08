# Bambu Lab X1 Carbon + OctoPrint Integration Guide

## Overview

This guide covers the connection of a Bambu Lab X1 Carbon 3D printer to OctoPrint, with special considerations for the x1plus firmware and integration with go2rtc for camera streaming. The Bambu Lab X1 Carbon uses proprietary protocols by default, but with x1plus firmware or specific configurations, it can be integrated with OctoPrint for enhanced control and monitoring capabilities.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Connection Methods](#connection-methods)
3. [X1Plus Firmware Benefits](#x1plus-firmware-benefits)
4. [OctoPrint Configuration](#octoprint-configuration)
5. [go2rtc Camera Integration](#go2rtc-camera-integration)
6. [Network Setup](#network-setup)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Hardware Requirements
- Bambu Lab X1 Carbon 3D printer
- Raspberry Pi or server running OctoPrint
- Network connectivity (Ethernet recommended)
- MicroSD card for X1Plus (if installing custom firmware)

### Software Requirements
- OctoPrint 1.9.0 or later
- Python 3.9+ (for OctoPrint-BambuPrinter plugin)
- go2rtc (for camera streaming)
- X1Plus firmware (optional but recommended)

### Network Requirements
- Printer and OctoPrint on same network
- Port access: 1883 (MQTT), 990 (FTP), 8883 (Secure MQTT)
- mDNS/Bonjour support for discovery

## Connection Methods

### Method 1: Stock Firmware with OctoPrint-BambuPrinter Plugin

The OctoPrint-BambuPrinter plugin by jneilliii provides basic connectivity to Bambu Lab printers without firmware modifications.

#### Installation
```bash
# Install via OctoPrint Plugin Manager URL:
https://github.com/jneilliii/OctoPrint-BambuPrinter/archive/master.zip
```

#### Configuration
1. **Get Printer Credentials:**
   - Open Bambu Studio
   - Go to Device > Settings
   - Note the Access Code and Serial Number
   - Find IP address in network settings

2. **Configure Plugin:**
   ```yaml
   # OctoPrint settings
   serial_number: "00M00A0B0C0D"
   access_code: "12345678"
   host: "192.168.1.100"
   port: 1883
   ```

3. **Limitations:**
   - No direct G-code control
   - Limited real-time monitoring
   - No camera access through OctoPrint
   - Print files must be uploaded via Bambu Studio first

### Method 2: X1Plus Firmware (Recommended)

X1Plus provides enhanced connectivity options and SSH access, making integration much more flexible.

#### X1Plus Installation
1. **Prepare Installation Media:**
   - Download X1Plus from GitHub releases
   - Format MicroSD card as FAT32
   - Copy X1Plus installer to SD card

2. **Install X1Plus:**
   - Insert SD card into printer
   - Power on while holding buttons (see X1Plus docs)
   - Follow on-screen installation
   - Set up SSH access during configuration

3. **Enable Developer Features:**
   ```bash
   # SSH into X1Plus printer
   ssh root@<printer-ip>
   
   # Enable additional protocols
   x1plus settings set developer.mode true
   x1plus settings set network.ssh.enabled true
   ```

## X1Plus Firmware Benefits

### Enhanced Connectivity
- **SSH Access:** Direct shell access to printer OS
- **Root Access:** Full control over printer systems
- **Custom Scripts:** Ability to run custom automation
- **API Access:** Enhanced programmatic control

### Network Features
- **Static IP Support:** Reliable network addressing
- **Port Forwarding:** Direct access to internal services
- **Custom DNS:** Better network integration
- **VPN Support:** Secure remote access

### Camera Access
- **RTSP Streams:** Direct camera streaming
- **Multiple Cameras:** Chamber and toolhead camera access
- **Stream Control:** Start/stop streaming on demand
- **Quality Settings:** Adjustable resolution and framerate

### File Management
- **Direct Upload:** Send files without Bambu Studio
- **SD Card Access:** Direct file management
- **Network Shares:** Mount network storage
- **Backup Support:** Easy configuration backup

## OctoPrint Configuration

### Basic Setup

1. **Install OctoPrint:**
   ```bash
   # Using OctoPi image (recommended)
   # Or manual installation:
   pip install octoprint
   ```

2. **Install Required Plugins:**
   - OctoPrint-BambuPrinter (required)
   - OctoPrint-WebcamStreamer (optional)
   - OctoPrint-PrintTimeGenius (recommended)

### X1Plus-Specific Configuration

1. **Create Connection Script:**
   ```python
   # /home/pi/.octoprint/scripts/x1plus_connect.py
   import paramiko
   import json
   
   class X1PlusConnection:
       def __init__(self, host, username='root'):
           self.host = host
           self.username = username
           self.ssh = paramiko.SSHClient()
           self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
       
       def connect(self):
           self.ssh.connect(self.host, username=self.username)
       
       def send_gcode(self, command):
           stdin, stdout, stderr = self.ssh.exec_command(
               f"echo '{command}' > /dev/printer"
           )
           return stdout.read().decode()
       
       def get_status(self):
           stdin, stdout, stderr = self.ssh.exec_command(
               "cat /var/log/printer/status.json"
           )
           return json.loads(stdout.read().decode())
   ```

2. **Configure Serial Connection:**
   ```yaml
   # config.yaml
   serial:
     port: /dev/virtualprinter
     baudrate: 115200
     autoconnect: true
   
   plugins:
     bambuprinter:
       connection_type: "x1plus"
       host: "192.168.1.100"
       use_ssh: true
   ```

### File Transfer Configuration

1. **FTP Setup (Stock Firmware):**
   ```yaml
   # FTP configuration
   ftp:
     host: 192.168.1.100
     port: 990
     username: bblp
     password: <access_code>
     path: /cache/
   ```

2. **SSH/SCP Setup (X1Plus):**
   ```bash
   # Upload script
   #!/bin/bash
   scp "$1" root@192.168.1.100:/mnt/sdcard/x3g/
   ssh root@192.168.1.100 "x1plus print start /mnt/sdcard/x3g/$(basename $1)"
   ```

## go2rtc Camera Integration

### Overview
go2rtc acts as a bridge between the Bambu Lab X1 Carbon's camera system and OctoPrint, providing low-latency streaming and multiple format support.

### Camera Sources

1. **Chamber Camera (Stock):**
   - Resolution: 1920x1080
   - Protocol: RTSP (with X1Plus)
   - FPS: 30
   - Stream URL: `rtsp://192.168.1.100:8554/streaming/live/1`

2. **Toolhead Camera (X1Plus):**
   - Resolution: 640x480
   - Used for AI detection and monitoring
   - Access via: `/dev/video1`

### go2rtc Configuration

```yaml
# go2rtc.yaml
api:
  listen: ":1984"

rtsp:
  listen: ":8554"

webrtc:
  listen: ":8555"

streams:
  # Chamber camera from X1 Carbon
  x1carbon_chamber:
    - rtsp://bblp:${ACCESS_CODE}@192.168.1.100:8554/streaming/live/1
    - ffmpeg:x1carbon_chamber#video=h264#hardware
  
  # Toolhead camera (X1Plus only)
  x1carbon_toolhead:
    - exec:ssh root@192.168.1.100 'ffmpeg -f v4l2 -i /dev/video1 -c:v libx264 -preset ultrafast -f rtsp {output}'
    
  # Combined view
  x1carbon_multi:
    - rtsp://192.168.1.100:8554/x1carbon_chamber
    - rtsp://192.168.1.100:8554/x1carbon_toolhead
```

### OctoPrint Webcam Setup

1. **Configure Webcam URL:**
   ```yaml
   # OctoPrint config.yaml
   webcam:
     stream: http://localhost:1984/api/stream.mjpeg?src=x1carbon_chamber
     snapshot: http://localhost:1984/api/frame.jpeg?src=x1carbon_chamber
     ffmpeg: /usr/bin/ffmpeg
   ```

2. **WebRTC Configuration (Low Latency):**
   ```javascript
   // Custom OctoPrint plugin for WebRTC
   function setupWebRTC() {
       const pc = new RTCPeerConnection({
           iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
       });
       
       fetch('http://localhost:1984/api/webrtc?src=x1carbon_chamber')
           .then(r => r.json())
           .then(async answer => {
               await pc.setRemoteDescription(answer);
           });
   }
   ```

### Advanced Camera Features

1. **AI Detection Integration:**
   ```yaml
   # Frigate integration for print monitoring
   frigate:
     cameras:
       x1carbon:
         ffmpeg:
           inputs:
             - path: rtsp://127.0.0.1:8554/x1carbon_chamber
               roles:
                 - detect
                 - record
         detect:
           width: 1920
           height: 1080
           fps: 5
         objects:
           track:
             - spaghetti  # Detect print failures
   ```

2. **Timelapse Creation:**
   ```bash
   # Capture script for timelapse
   #!/bin/bash
   while true; do
     wget -O /tmp/frame_$(date +%s).jpg \
       http://localhost:1984/api/frame.jpeg?src=x1carbon_chamber
     sleep 10
   done
   ```

## Network Setup

### Network Architecture
```
┌─────────────────┐
│  X1 Carbon      │
│  192.168.1.100  │
│  ┌────────────┐ │
│  │  X1Plus    │ │
│  │  Firmware  │ │
│  └────────────┘ │
└────────┬────────┘
         │ Ethernet (Recommended)
         │
    ┌────▼────┐
    │ Switch  │
    └────┬────┘
         │
┌────────▼────────┐     ┌──────────────┐
│   OctoPrint     │────►│   go2rtc     │
│  192.168.1.110  │     │ 192.168.1.111│
└─────────────────┘     └──────────────┘
```

### Port Configuration

| Service | Port | Protocol | Direction | Purpose |
|---------|------|----------|-----------|---------|
| SSH | 22 | TCP | Inbound | X1Plus shell access |
| HTTP | 80 | TCP | Inbound | Web interface |
| MQTT | 1883 | TCP | Bidirectional | Printer communication |
| RTSP | 8554 | TCP | Outbound | Camera streaming |
| FTP | 990 | TCP | Inbound | File transfer (stock) |
| WebRTC | 8555 | TCP/UDP | Bidirectional | Low-latency video |

### Security Considerations

1. **Network Isolation:**
   ```bash
   # Create VLAN for 3D printers
   ip link add link eth0 name eth0.100 type vlan id 100
   ip addr add 192.168.100.1/24 dev eth0.100
   ```

2. **Firewall Rules:**
   ```bash
   # Allow only OctoPrint to printer
   iptables -A FORWARD -s 192.168.1.110 -d 192.168.1.100 -j ACCEPT
   iptables -A FORWARD -s 192.168.1.100 -d 192.168.1.110 -j ACCEPT
   iptables -A FORWARD -d 192.168.1.100 -j DROP
   ```

3. **SSH Key Authentication:**
   ```bash
   # Generate key on OctoPrint
   ssh-keygen -t ed25519 -f ~/.ssh/x1carbon
   
   # Copy to X1Plus
   ssh-copy-id -i ~/.ssh/x1carbon.pub root@192.168.1.100
   ```

## Plugin Configuration

### OctoPrint-BambuPrinter Settings

```python
# Plugin configuration
BAMBU_SETTINGS = {
    "printer_type": "X1 Carbon",
    "connection": {
        "type": "mqtt",
        "host": "192.168.1.100",
        "port": 1883,
        "username": "bblp",
        "password": "<access_code>",
        "client_id": "octoprint_" + uuid.uuid4().hex[:8]
    },
    "features": {
        "temperature_reporting": True,
        "progress_reporting": True,
        "file_management": False,  # Use alternative method
        "camera_support": False,   # Use go2rtc instead
    },
    "x1plus": {
        "enabled": True,
        "ssh_host": "192.168.1.100",
        "ssh_user": "root",
        "enhanced_api": True
    }
}
```

### MQTT Topics

```yaml
# Monitoring topics
subscribe:
  - device/00M00A0B0C0D/report  # Status updates
  - device/00M00A0B0C0D/temperature  # Temperature data
  - device/00M00A0B0C0D/progress  # Print progress

# Control topics  
publish:
  - device/00M00A0B0C0D/command  # Send commands
  - device/00M00A0B0C0D/gcode  # G-code commands (X1Plus)
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Connection Refused
**Problem:** OctoPrint cannot connect to printer
**Solutions:**
- Verify printer IP address: `ping 192.168.1.100`
- Check firewall settings on both devices
- Ensure X1Plus SSH is enabled
- Verify MQTT broker is running: `mosquitto_sub -h 192.168.1.100 -t '#'`

#### 2. Camera Stream Not Working
**Problem:** No video in OctoPrint interface
**Solutions:**
```bash
# Test RTSP stream directly
ffplay rtsp://192.168.1.100:8554/streaming/live/1

# Check go2rtc status
curl http://localhost:1984/api/streams

# Verify camera permissions (X1Plus)
ssh root@192.168.1.100 'ls -la /dev/video*'
```

#### 3. File Upload Failures
**Problem:** Cannot upload G-code to printer
**Solutions:**
- Check SD card space: `ssh root@192.168.1.100 'df -h'`
- Verify write permissions: `ssh root@192.168.1.100 'touch /mnt/sdcard/test'`
- Use alternative upload method via SSH/SCP

#### 4. Temperature Reading Issues
**Problem:** Incorrect or missing temperature data
**Solutions:**
```python
# Debug MQTT messages
import paho.mqtt.client as mqtt

def on_message(client, userdata, msg):
    print(f"{msg.topic}: {msg.payload}")

client = mqtt.Client()
client.on_message = on_message
client.connect("192.168.1.100", 1883)
client.subscribe("device/+/report")
client.loop_forever()
```

#### 5. Print Control Not Working
**Problem:** Cannot pause/resume/stop prints
**Solutions:**
- Verify MQTT authentication
- Check X1Plus API status: `curl http://192.168.1.100/api/status`
- Test direct command: `mosquitto_pub -h 192.168.1.100 -t device/<serial>/command -m '{"cmd":"pause"}'`

### Diagnostic Commands

```bash
# Check X1Plus status
ssh root@192.168.1.100 'x1plus status'

# View printer logs
ssh root@192.168.1.100 'journalctl -u printer -f'

# Test camera stream
ffmpeg -i rtsp://192.168.1.100:8554/streaming/live/1 -f null -

# Monitor MQTT traffic
mosquitto_sub -h 192.168.1.100 -t 'device/+/#' -v

# Check network connectivity
nmap -p 22,80,1883,8554 192.168.1.100
```

## Advanced Configuration

### Custom G-code Macros

```gcode
; X1Plus custom start G-code
M104 S{material_print_temperature_layer_0} ; Set extruder temp
M140 S{material_bed_temperature_layer_0} ; Set bed temp
G28 ; Home all axes
G29 ; Auto bed leveling (X1Plus enhanced)
M109 S{material_print_temperature_layer_0} ; Wait for extruder
M190 S{material_bed_temperature_layer_0} ; Wait for bed
```

### Automation Scripts

```python
# Auto-connect script for OctoPrint
import octoprint.plugin
import paramiko

class X1PlusAutoConnect(octoprint.plugin.StartupPlugin):
    def on_after_startup(self):
        # Establish SSH connection
        ssh = paramiko.SSHClient()
        ssh.connect('192.168.1.100', username='root')
        
        # Start camera stream
        ssh.exec_command('/opt/bin/start_rtsp_server.sh')
        
        # Initialize MQTT bridge
        self._start_mqtt_bridge()
```

### Performance Optimization

```yaml
# Optimized go2rtc settings for X1 Carbon
streams:
  x1carbon_optimized:
    - rtsp://192.168.1.100:8554/streaming/live/1#timeout=5#buffer=100
    - ffmpeg:x1carbon_optimized#video=h264#hardware#preset=ultrafast

ffmpeg:
  h264_hardware: "-c:v h264_v4l2m2m -b:v 4M"
  global: "-hide_banner -loglevel error"
```

## Best Practices

### Network Configuration
1. Use wired Ethernet connection for printer
2. Assign static IP address to printer
3. Implement VLAN separation for IoT devices
4. Enable QoS for video streaming

### Security
1. Change default passwords on X1Plus
2. Use SSH keys instead of passwords
3. Restrict network access with firewall rules
4. Regular firmware updates

### Reliability
1. Set up monitoring for printer status
2. Implement automatic reconnection logic
3. Use UPS for printer and OctoPrint server
4. Regular configuration backups

### Performance
1. Use hardware acceleration for video encoding
2. Optimize camera resolution for bandwidth
3. Implement caching for frequently accessed data
4. Monitor system resources

## Additional Resources

### Official Documentation
- [X1Plus Wiki](https://github.com/X1Plus/X1Plus/wiki)
- [OctoPrint Documentation](https://docs.octoprint.org)
- [go2rtc Documentation](https://github.com/AlexxIT/go2rtc)
- [Bambu Lab Support](https://wiki.bambulab.com)

### Community Resources
- [X1Plus Discord](https://discord.gg/x1plus)
- [OctoPrint Community Forum](https://community.octoprint.org)
- [Reddit r/BambuLab](https://reddit.com/r/BambuLab)
- [Reddit r/octoprint](https://reddit.com/r/octoprint)

### Related Projects
- [OctoPrint-BambuPrinter Plugin](https://github.com/jneilliii/OctoPrint-BambuPrinter)
- [Bambu Studio](https://github.com/bambulab/BambuStudio)
- [X1Plus Firmware](https://github.com/X1Plus/X1Plus)
- [go2rtc](https://github.com/AlexxIT/go2rtc)
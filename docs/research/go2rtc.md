# go2rtc Container Deployment Guide

## Overview

go2rtc is a universal media gateway that supports multiple streaming protocols including RTSP, WebRTC, RTMP, HTTP-FLV, MSE, HLS, MP4, MJPEG, and HomeKit. It provides zero-delay streaming with multi-source codec negotiation and serves as both a streaming server and protocol converter.

**Primary use cases:**
- Camera stream gateway and protocol converter
- WebRTC streaming server for low-latency browser viewing  
- RTSP server for IP cameras
- Integration hub for smart home platforms (Home Assistant, Frigate)
- Two-way audio support for compatible cameras

## Docker Images

### Official Images
- **Repository**: `alexxit/go2rtc`
- **Latest**: `latest` - Stable release on Alpine Linux (multi-arch)
- **Hardware**: `latest-hardware` - Debian-based with GPU transcoding support
- **Rockchip**: `latest-rockchip` - For RK35xx ARM64 hardware
- **Development**: `master` tags for latest features

## Configuration

### Core Configuration File
Location: `/config/go2rtc.yaml`

```yaml
api:
  listen: ":1984"
  username: ""
  password: ""

rtsp:
  listen: ":8554"
  username: "admin"
  password: "secret"

webrtc:
  listen: ":8555/tcp"
  candidates: []
  ice_servers:
    - urls: ["stun:stun.l.google.com:19302"]

streams:
  camera_name:
    - rtsp://user:pass@camera_ip/stream
    - ffmpeg:source#options

log:
  level: "info"
  format: "color"
```

### Environment Variables
- `TZ` - Timezone (e.g., `America/New_York`)
- `CAMERA_PASSWORD` - Camera authentication
- `RTSP_USER` / `RTSP_PASS` - RTSP server credentials

## Network & Ports

### Required Ports
- **1984/tcp** - HTTP API and Web UI
- **8554/tcp** - RTSP server
- **8555/tcp** - WebRTC signaling
- **8555/udp** - WebRTC media transport

### Network Mode
- **host** - Recommended for WebRTC and HomeKit
- **bridge** - Requires careful port mapping

## Docker Compose Example

```yaml
version: '3.8'
services:
  go2rtc:
    image: alexxit/go2rtc:latest
    container_name: go2rtc
    restart: unless-stopped
    network_mode: host
    environment:
      - TZ=America/New_York
    volumes:
      - ./config:/config
    devices:
      - /dev/dri:/dev/dri  # For hardware acceleration
    privileged: false
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: go2rtc
spec:
  replicas: 1
  selector:
    matchLabels:
      app: go2rtc
  template:
    metadata:
      labels:
        app: go2rtc
    spec:
      hostNetwork: true  # Recommended for WebRTC
      containers:
      - name: go2rtc
        image: alexxit/go2rtc:latest
        ports:
        - containerPort: 1984
        - containerPort: 8554
        - containerPort: 8555
        volumeMounts:
        - name: config
          mountPath: /config
        env:
        - name: TZ
          value: "America/New_York"
      volumes:
      - name: config
        persistentVolumeClaim:
          claimName: go2rtc-config
```

## Volume Mounts

### Required
- `/config` - Configuration files and persistent state

### Optional  
- `/media` - For file-based sources
- `/dev/dri` - Intel/AMD GPU acceleration
- `/dev/video*` - USB cameras

## Security Configuration

### Authentication
```yaml
api:
  username: "admin"
  password: "secure_password"

rtsp:
  username: "rtsp_user" 
  password: "rtsp_password"
```

### HTTPS/TLS
```yaml
api:
  tls_listen: ":8443"
  tls_cert: "/config/cert.pem"
  tls_key: "/config/key.pem"
```

## Integration Examples

### Home Assistant
```yaml
# configuration.yaml
webrtc:
  interface: 127.0.0.1
  port: 1984
```

### With Frigate
Frigate 0.12+ includes go2rtc internally, but can also use external instance:
```yaml
go2rtc:
  streams:
    camera_name: rtsp://camera_ip/stream
```

## Hardware Acceleration

### Intel Quick Sync
```yaml
version: '3.8'
services:
  go2rtc:
    image: alexxit/go2rtc:latest-hardware
    devices:
      - /dev/dri:/dev/dri
    group_add:
      - "109"  # render group
```

### NVIDIA GPU  
```yaml
version: '3.8'
services:
  go2rtc:
    image: alexxit/go2rtc:latest-hardware
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
```

## Monitoring & Health Checks

### Health Check Endpoints
- `http://localhost:1984/api/streams` - Active streams
- `http://localhost:1984/api/webrtc` - WebRTC statistics
- Web UI at `http://localhost:1984/`

### Docker Health Check
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:1984/api/streams"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Troubleshooting

### Common Issues
1. **WebRTC not working**: Use `network_mode: host` or configure ICE servers
2. **Camera connection failed**: Check credentials and network access
3. **Hardware acceleration not working**: Verify device access and drivers
4. **Audio sync issues**: Adjust buffer settings in stream configuration

### Debugging
```yaml
log:
  level: "debug"
  modules:
    webrtc: "trace"
    rtsp: "debug"
```

## Resource Requirements

### Minimum
- **CPU**: 1 core
- **Memory**: 256MB 
- **Storage**: 100MB

### Recommended  
- **CPU**: 2+ cores (for transcoding)
- **Memory**: 512MB-1GB
- **Hardware acceleration**: GPU for multiple high-resolution streams

## Camera Compatibility

### Tested Brands
- Dahua, Hikvision, Reolink
- Tapo, UniFi, Wyze
- ONVIF Profile T (two-way audio)
- HomeKit cameras
- USB cameras via FFmpeg

### Stream Examples
```yaml
streams:
  dahua_cam:
    - rtsp://admin:password@192.168.1.10/cam/realmonitor?channel=1&subtype=0
  
  reolink_cam:
    - rtsp://admin:password@192.168.1.11:554/h264Preview_01_main
    
  tapo_cam:
    - ffmpeg:rtsp://admin:password@192.168.1.12/stream1#video=copy#audio=copy
```
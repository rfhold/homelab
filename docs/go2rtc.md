# go2rtc Container Requirements Documentation

## Service Overview

go2rtc is an ultimate camera streaming application that provides a zero-dependency, high-performance media gateway for various streaming protocols. It serves as a universal translator between different video/audio formats and protocols, enabling seamless streaming from cameras to browsers, smart home platforms, and recording systems. go2rtc excels at WebRTC streaming with sub-second latency, multi-source codec negotiation, and two-way audio support. In this homelab, go2rtc is primarily bundled with Frigate NVR but can also be deployed standalone for advanced streaming scenarios.

## Container Availability

### Official Docker Images

**Docker Hub (Primary)**
- **Registry**: docker.io
- **Image**: `alexxit/go2rtc:latest` - Standard multi-arch build
- **Tags**:
  - `latest` - Latest stable release
  - `master` - Development build (may be unstable)
  - `master-hardware` - Development with hardware acceleration support
  - Version-specific tags (e.g., `v1.9.9`)

### GitHub Container Registry
- **Registry**: ghcr.io
- **Image**: `ghcr.io/alexxit/go2rtc:latest`
- Same tag structure as Docker Hub

### Bundled with Frigate
- **Image**: `ghcr.io/blakeblackshear/frigate:stable`
- go2rtc v1.9.x is embedded in Frigate 0.14+
- No separate installation needed when using Frigate

### Supported Architectures
- `linux/amd64` (x86-64)
- `linux/arm64` (ARM64/aarch64)  
- `linux/arm/v7` (ARMv7 32-bit)
- `linux/386` (x86 32-bit)
- `darwin/amd64` (macOS Intel)
- `darwin/arm64` (macOS Apple Silicon)

## Environment Variables

### Core Configuration
- `GO2RTC_CONFIG_FILE` - Path to config file (default: `/config/go2rtc.yaml`)
- `TZ` - Timezone (e.g., "America/New_York")

### Network Configuration
- `GO2RTC_API` - API listen address (default: `:1984`)
- `GO2RTC_RTSP` - RTSP server listen address (default: `:8554`)
- `GO2RTC_WEBRTC` - WebRTC listen address (default: `:8555`)

### Stream Variables (supports substitution in config)
- `RTSP_USER` - Default RTSP username
- `RTSP_PASSWORD` - Default RTSP password
- `MQTT_USER` - MQTT broker username
- `MQTT_PASSWORD` - MQTT broker password

## Configuration Files

### Primary Configuration
- **Location**: `/config/go2rtc.yaml`
- **Format**: YAML configuration file
- **Auto-reload**: Supports hot reload on file changes

### Configuration Structure
```yaml
# API Server Configuration
api:
  listen: ":1984"
  base_path: ""
  static_dir: ""
  origin: "*"

# RTSP Server Configuration  
rtsp:
  listen: ":8554"
  default_query: "video&audio"

# WebRTC Configuration
webrtc:
  listen: ":8555"
  candidates:
    - stun:8555  # For dynamic public IP
  ice_servers:
    - urls: [stun:stun.l.google.com:19302]

# Stream Definitions
streams:
  camera_name:
    - rtsp://user:pass@192.168.1.100/stream1
    - ffmpeg:camera_name#audio=opus

# FFmpeg Configuration
ffmpeg:
  bin: ffmpeg  # Path to ffmpeg binary
  global: "-hide_banner"
  h264: "-c:v libx264 -g 30 -preset superfast -tune zerolatency"
  
# Logging
log:
  level: info
  output: stdout
  format: text
```

### When Bundled with Frigate
- Configuration embedded in Frigate's `config.yml`
- Located under `go2rtc:` section
- Shares port configuration with Frigate

## Resource Requirements

### Minimum Requirements
- **CPU**: 1 core (without transcoding)
- **Memory**: 64MB RAM base
- **Storage**: 10MB for application
- **Shared Memory**: Not required (uses standard memory)

### Recommended Requirements
- **CPU**: 2+ cores for transcoding
- **Memory**: 256MB+ RAM
- **Storage**: 100MB for caching
- **GPU**: Optional for hardware acceleration

### Performance Considerations
- Zero-copy streaming when codecs match
- Each transcoding stream uses ~1 CPU core
- WebRTC uses minimal resources
- Can handle 100+ concurrent streams without transcoding

## Network Configuration

### Required Ports
- **1984/tcp** - HTTP API and web interface
- **8554/tcp** - RTSP server (TCP)
- **8554/udp** - RTSP server (UDP, optional)
- **8555/tcp** - WebRTC signaling
- **8555/udp** - WebRTC media transport

### Protocol Support
- **Input**: RTSP, RTMP, HTTP-FLV, HLS, WebRTC, HomeKit
- **Output**: WebRTC, MSE/MP4, HLS, RTSP, MJPEG
- **Audio Codecs**: OPUS, AAC, PCMU, PCMA, MP3
- **Video Codecs**: H.264, H.265, VP8, VP9, AV1

### WebRTC Configuration
- STUN server for NAT traversal
- TURN server optional for symmetric NAT
- ICE candidates for direct peer connections
- Supports both TCP and UDP transport

## Dependencies

### Built-in Components
- **FFmpeg**: Included in Docker image
- **Python**: Included for echo sources
- **ngrok**: Included for tunneling (optional)

### External Services (Optional)
- **MQTT Broker**: For Home Assistant integration
- **STUN Server**: For WebRTC NAT traversal
- **TURN Server**: For symmetric NAT scenarios

### Camera Compatibility
- Any RTSP camera
- ONVIF Profile T cameras (two-way audio)
- HomeKit cameras
- USB cameras via FFmpeg
- Browser as camera source

## Storage and Volumes

### Configuration Volume
- `/config` - Configuration files
  - `go2rtc.yaml` - Main configuration
  - Custom scripts for echo sources

### Optional Volumes
- `/media` - Media files for streaming
- `/dev/shm` - Shared memory (not required)

### Directory Structure
```
/config/
├── go2rtc.yaml         # Main configuration
└── scripts/            # Custom echo source scripts
```

## Security Considerations

### Authentication
- Basic auth for web UI (optional)
- RTSP authentication support
- No auth on localhost by default
- API tokens for external access

### Network Security
- Bind to localhost for internal only
- Use reverse proxy for HTTPS
- Separate auth for each protocol
- WebRTC encryption built-in

### Container Security
- Run as non-root user
- No privileged mode required
- Read-only filesystem compatible
- Minimal attack surface

## Deployment Patterns

### Standalone Deployment
- Direct camera connections
- Independent of other services
- Full protocol support
- Minimal resource usage

### With Frigate Integration
- Bundled in Frigate container
- Shared configuration
- Automatic stream discovery
- Unified management

### High Availability
- Stateless operation
- Multiple instances supported
- Load balancing possible
- No persistent data

### Reverse Proxy Setup
- Traefik/Nginx compatible
- WebSocket support required
- Path-based routing supported
- CORS headers handled

## Version Matrix

### go2rtc Versions
- **1.9.x** - Current stable (bundled with Frigate 0.14)
- **1.8.x** - Previous stable
- **1.10.x** - Development branch

### FFmpeg Compatibility
- **FFmpeg 4.x** - Full support
- **FFmpeg 5.x** - Recommended
- **FFmpeg 6.x** - Latest features

### Protocol Support
- **WebRTC**: All versions
- **MSE**: All versions
- **HomeKit**: v1.7.0+
- **WebTorrent**: v1.3.0+

## Integration with Other Services

### Frigate NVR
- Auto-configured when bundled
- Handles RTSP restreaming
- WebRTC for live view
- Recording source provider

### Home Assistant
- RTSPtoWebRTC integration
- WebRTC Camera custom component
- Stream source for cameras
- Two-way audio support

### Compatible Clients
- Web browsers (Chrome, Firefox, Safari)
- VLC Media Player
- FFmpeg/FFplay
- Home Assistant
- Any RTSP client

## Networking and Port Requirements

### Internal Communication
- Cameras → go2rtc: RTSP (554/tcp)
- go2rtc → Browsers: WebRTC (8555/tcp+udp)
- go2rtc → Frigate: RTSP (8554/tcp)
- API clients → go2rtc: HTTP (1984/tcp)

### External Access
- Port forwarding for WebRTC (8555)
- STUN for NAT traversal
- Dynamic DNS for changing IPs
- ngrok for private networks

## Storage and Volume Requirements

### Persistent Storage
- Configuration only
- No media storage required
- No database needed
- Stateless operation

### Temporary Storage
- Memory buffers for streaming
- No disk cache required
- Automatic cleanup
- Low storage footprint

## Troubleshooting Common Issues

### Stream Connection Issues
- Verify camera RTSP URL
- Check network connectivity
- Confirm authentication
- Test with FFplay directly

### WebRTC Problems
- Configure STUN/TURN servers
- Check firewall rules
- Verify port forwarding
- Enable UDP transport

### Codec Incompatibility
- Enable FFmpeg transcoding
- Check browser support
- Verify camera settings
- Use codec filters

### Performance Issues
- Disable unnecessary transcoding
- Use hardware acceleration
- Optimize camera settings
- Monitor CPU usage

## Example Configurations

### Basic RTSP Camera
```yaml
streams:
  front_door:
    - rtsp://admin:password@192.168.1.100/stream1
```

### Camera with Transcoding
```yaml
streams:
  garage:
    - rtsp://admin:password@192.168.1.101/stream1
    - ffmpeg:garage#audio=opus#video=h264
```

### Two-Way Audio Camera
```yaml
streams:
  doorbell:
    - rtsp://admin:password@192.168.1.102/stream1#backchannel=0
    - ffmpeg:doorbell#audio=pcmu
```

### HomeKit Camera Proxy
```yaml
streams:
  aqara_g3:
    - homekit://AAAA-BBBB-CCCC
    - ffmpeg:aqara_g3#audio=aac#audio=opus

homekit:
  aqara_g3:
    pin: 12345678
```

### USB Camera
```yaml
streams:
  webcam:
    - ffmpeg:device?video=0&video_size=1920x1080#video=h264
```

## Best Practices

### Stream Configuration
- Use direct RTSP when possible
- Add transcoding only when needed
- Configure sub-streams for detection
- Set appropriate codec priorities

### Network Optimization
- Use wired connections for cameras
- Configure multicast if supported
- Implement VLANs for isolation
- Monitor bandwidth usage

### Security Hardening
- Change default passwords
- Use HTTPS for web access
- Implement network segmentation
- Regular updates

### Resource Management
- Monitor CPU/memory usage
- Limit concurrent streams
- Use hardware acceleration
- Implement stream timeouts

## Migration and Upgrades

### Version Upgrades
- Review changelog for breaking changes
- Backup configuration
- Test in development first
- Gradual rollout

### From Standalone to Frigate
- Export stream configurations
- Migrate to Frigate config format
- Update client connections
- Verify functionality

### Configuration Migration
- YAML format changes rare
- Automatic migration usually available
- Manual updates documented
- Backwards compatibility maintained
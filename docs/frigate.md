# Frigate NVR Container Requirements Documentation

## Service Overview

Frigate is an open-source Network Video Recorder (NVR) built specifically for Home Assistant integration with advanced AI object detection capabilities. It provides real-time object detection using AI accelerators (Coral TPU, GPUs, or CPU), motion-based recording, event review system with alerts, and comprehensive Home Assistant integration. Frigate processes camera streams locally for privacy and features a modern web UI for configuration and monitoring.

## Container Availability

### Official Docker Images

**GitHub Container Registry (Primary)**
- **Registry**: ghcr.io
- **Images**:
  - `ghcr.io/blakeblackshear/frigate:stable` - Standard build for amd64 & RPi optimized for arm64 (includes Hailo support)
  - `ghcr.io/blakeblackshear/frigate:stable-standard-arm64` - Standard Frigate build for arm64
  - `ghcr.io/blakeblackshear/frigate:stable-tensorrt` - Nvidia GPU optimized build for amd64
  - `ghcr.io/blakeblackshear/frigate:stable-rocm` - AMD GPU optimized build

### Community Supported Images
- `ghcr.io/blakeblackshear/frigate:stable-tensorrt-jp6` - Nvidia Jetson Jetpack 6 optimized
- `ghcr.io/blakeblackshear/frigate:stable-rk` - Rockchip SoC optimized build

### Supported Architectures
- `linux/amd64` (x86-64)
- `linux/arm64/v8` (ARM64/aarch64)
- `linux/arm/v7` (ARMv7 32-bit)

### Version Tags
- `stable` - Latest stable release
- `beta` - Beta release channel
- `dev` - Development builds
- Version-specific tags (e.g., `0.14.1`)

## Environment Variables

### Core Configuration
- `FRIGATE_RTSP_PASSWORD` - Default password for RTSP restreaming
- `LIBVA_DRIVER_NAME` - Intel GPU driver override (e.g., `i965` for certain CPUs)
- `FRIGATE_MQTT_USER` - MQTT broker username (supports substitution in config)
- `FRIGATE_MQTT_PASSWORD` - MQTT broker password (supports substitution in config)
- `FRIGATE_RTSP_USER` - RTSP camera username (supports substitution in config)
- `FRIGATE_GO2RTC_RTSP_USERNAME` - go2rtc RTSP username (supports substitution in config)
- `FRIGATE_GO2RTC_RTSP_PASSWORD` - go2rtc RTSP password (supports substitution in config)
- `FRIGATE_GENAI_API_KEY` - Generative AI API key (supports substitution in config)

### System Variables
- `TZ` - Timezone (e.g., "America/New_York")
- `NVIDIA_VISIBLE_DEVICES` - GPU device selection for Nvidia containers
- `NVIDIA_DRIVER_CAPABILITIES` - Required Nvidia capabilities (set to `all`)

## Configuration Files

### Primary Configuration
- **Location**: `/config/config.yml` or `/config/config.yaml`
- **Format**: YAML configuration file
- **Schema**: Supports VS Code validation with JSON schema

### Configuration Structure
```yaml
mqtt:
  enabled: true/false
  host: mqtt_broker_address
  user: username
  password: password

cameras:
  camera_name:
    enabled: true
    ffmpeg:
      inputs:
        - path: rtsp://camera_url
          roles:
            - detect
            - record
    detect:
      width: 1280
      height: 720
      fps: 5

detectors:
  coral:
    type: edgetpu
    device: usb/pci

record:
  enabled: true
  retain:
    days: 7
    mode: motion/active_objects/all

go2rtc:
  streams:
    camera_name:
      - rtsp://camera_url
```

### Database
- **Location**: `/config/frigate.db`
- **Type**: SQLite database
- **Purpose**: Stores events, recordings metadata, configuration

### go2rtc Configuration
- **Location**: Embedded in main config or separate file
- **Purpose**: WebRTC/RTSP restreaming configuration

## Resource Requirements

### Minimum Requirements
- **CPU**: 2 cores (x86_64 or ARM64)
- **Memory**: 2GB RAM base + camera-specific requirements
- **Storage**: 10GB for application and initial recordings
- **Shared Memory**: 128MB minimum (see calculation below)

### Recommended Requirements
- **CPU**: 4+ cores with hardware acceleration
- **Memory**: 4GB+ RAM
- **Storage**: 100GB+ for recordings (depends on retention)
- **AI Accelerator**: Coral TPU or GPU recommended

### Shared Memory Calculation
Calculate minimum shm-size per camera:
```
(width * height * 1.5 * 20 + 270480) / 1048576 + 40MB for logs
```
Example for 1280x720: ~67MB per camera

### Performance Considerations
- Hardware acceleration significantly reduces CPU usage
- Coral TPU handles 100+ FPS object detection
- GPU acceleration available for Nvidia/AMD/Intel
- Sub-stream for detection reduces resource usage

## Network Configuration

### Required Ports
- **8971/tcp** - Authenticated web UI and API (main interface)
- **5000/tcp** - Internal unauthenticated API (container network only)
- **8554/tcp** - RTSP restreaming server
- **8555/tcp** - WebRTC over TCP
- **8555/udp** - WebRTC over UDP

### Protocol Requirements
- HTTP/HTTPS for web interface
- WebSocket support for real-time updates
- RTSP for camera streams
- WebRTC for low-latency viewing
- MQTT for Home Assistant integration (optional)

### Internal Networking
- Requires access to camera network
- MQTT broker connectivity (if enabled)
- NTP for time synchronization

## Dependencies

### AI Accelerators (Optional but Recommended)
- **Google Coral TPU**:
  - USB version: Pass through `/dev/bus/usb`
  - PCIe/M.2 version: Pass through `/dev/apex_0`
- **Nvidia GPU**: Requires nvidia-docker runtime
- **Intel GPU**: Pass through `/dev/dri/renderD128`
- **AMD GPU**: ROCm support via specific image
- **Hailo-8/8L**: Pass through `/dev/hailo0`
- **OpenVINO**: CPU-based acceleration

### External Services
- **MQTT Broker** (optional):
  - Required for Home Assistant integration
  - Mosquitto or compatible broker
- **go2rtc** (included):
  - WebRTC/RTSP relay server
  - Bundled in container

### Home Assistant Integration
- **MQTT Integration**: For device discovery
- **Frigate Integration**: HACS or core integration
- **Media Source**: For browsing recordings

## Storage and Volumes

### Required Volume Mounts
- `/config` - Configuration and database
  - Contains config.yml
  - SQLite database
  - Runtime state files

### Media Storage
- `/media/frigate/clips` - Snapshot storage
  - Event snapshots
  - Thumbnail cache
- `/media/frigate/recordings` - Video recordings
  - Segmented video files
  - Structured by date/hour
- `/media/frigate/exports` - Manual exports
  - User-generated clips
  - Timelapse exports

### Cache Storage
- `/tmp/cache` - Recording cache (recommend tmpfs)
  - Temporary recording segments
  - Processing workspace
  - Size: 1GB recommended

### Internal Shared Memory
- `/dev/shm` - Frame cache (do not modify)
  - Decoded frame buffer
  - Inter-process communication
  - Size calculated based on cameras

### Directory Structure
```
/config/
├── config.yml              # Main configuration
├── frigate.db             # SQLite database
└── model_cache/           # AI model cache

/media/frigate/
├── clips/                 # Snapshots
│   └── {camera}/         
├── recordings/            # Video segments
│   └── {date}/{hour}/    
└── exports/              # User exports
```

## Security Considerations

### Authentication
- Web UI requires authentication (user management in UI)
- API authentication via header tokens
- RTSP streams can be password protected
- Internal port 5000 is unauthenticated (container network only)

### Container Security
- Run with limited capabilities when possible
- Avoid privileged mode unless required for hardware
- Use read-only root filesystem where applicable
- Proper file permissions on mounted volumes

### Network Security
- Use reverse proxy for HTTPS/TLS
- Isolate camera network segment
- Firewall rules for port access
- VPN for remote access recommended

### Secrets Management
- Environment variable substitution for passwords
- Protect config file with sensitive data
- Use Docker secrets when available
- Rotate RTSP passwords regularly

## Deployment Patterns

### Standalone Deployment
- Single container with all components
- Direct camera connections
- Local storage for recordings
- Web UI on port 8971

### Home Assistant Add-on
- Managed through HA Supervisor
- Automatic MQTT configuration
- Ingress support for UI access
- Protection mode considerations

### High Availability Considerations
- Stateful application (not clusterable)
- Single instance per camera set
- External storage recommended
- Database backup essential

### Reverse Proxy Configuration
- Traefik/Nginx/Caddy compatible
- WebSocket proxy support required
- Path-based or subdomain routing
- Cache static assets

### Container Orchestration
- **Docker Compose**: Recommended for standalone
- **Kubernetes**: Helm chart available
- **Docker Swarm**: Single replica service
- **Unraid**: Community app available

## Version Matrix

### Frigate Versions
- **0.14.x** - Current stable branch
- **0.13.x** - Previous stable (maintenance)
- **0.15.x** - Development branch

### Compatibility Requirements
- **FFmpeg**: 4.x or 5.x (included)
- **Python**: 3.9+ (internal)
- **go2rtc**: 1.9.x (bundled)
- **OpenCV**: 4.x (included)

### AI Model Compatibility
- **YOLO**: YOLOv8 models supported
- **MobileNet**: SSD MobileNet v2
- **Custom Models**: ONNX format support
- **Frigate+**: Cloud-trained custom models

## Hardware Acceleration

### Video Decoding
- **Intel**: VAAPI with `/dev/dri/renderD128`
- **Nvidia**: NVDEC via tensorrt image
- **Raspberry Pi**: Hardware H.264 decode
- **AMD**: VAAPI/ROCm support
- **Rockchip**: MPP/RKVDEC support

### Object Detection Acceleration
- **Google Coral**: 100+ FPS detection
- **Nvidia GPU**: TensorRT acceleration
- **Intel**: OpenVINO support
- **Hailo**: Dedicated AI processor
- **Apple Silicon**: CoreML (experimental)

## Monitoring and Health

### Health Endpoints
- `/api/stats` - System statistics
- `/api/version` - Version information
- `/api/config` - Running configuration

### Metrics
- CPU/Memory usage per process
- Detection FPS and inference speed
- Camera connection status
- Recording disk usage
- MQTT connection state

### Logging
- Container stdout/stderr
- Debug mode available
- Per-camera statistics
- FFmpeg process logs

## Integration Capabilities

### MQTT Topics
- `frigate/available` - Service availability
- `frigate/{camera}/person` - Object counts
- `frigate/{camera}/motion` - Motion detection
- `frigate/events` - Event stream
- `frigate/stats` - Statistics updates

### HTTP API
- RESTful API for all operations
- Event management endpoints
- Recording playback API
- Configuration API
- Export generation

### Home Assistant Features
- Camera entities
- Binary sensors for motion/objects
- Media browser integration
- Mobile app notifications
- Lovelace cards support

## Common Issues and Troubleshooting

### Camera Connection Issues
- Verify RTSP URL format
- Check network connectivity
- Confirm credentials
- Test with FFmpeg directly

### Detection Problems
- Verify detector configuration
- Check hardware device access
- Monitor inference speeds
- Adjust detection resolution

### Recording Issues
- Check storage permissions
- Monitor disk space
- Verify retain configuration
- Check segment generation

### Performance Problems
- Enable hardware acceleration
- Use sub-streams for detection
- Adjust FPS settings
- Monitor CPU/memory usage

## Migration and Upgrades

### Version Upgrades
- Backup database before upgrading
- Review breaking changes
- Test in non-production first
- Update configuration syntax

### Data Migration
- Database auto-migrates on startup
- Recordings remain compatible
- Configuration may need updates
- Model cache may regenerate

### Backup Procedures
- SQLite database backup
- Configuration file backup
- Recordings are expendable
- Export important clips

## Best Practices

### Camera Configuration
- Use sub-streams for detection (720p or lower)
- Main stream for recording (1080p+)
- Set appropriate FPS (5-10 for detection)
- Configure motion masks

### Storage Management
- Use dedicated volume for recordings
- Implement retention policies
- Monitor disk usage
- Consider NAS for large deployments

### Resource Optimization
- Enable hardware acceleration
- Use appropriate detection models
- Implement motion zones
- Adjust detection frequency

### Security Hardening
- Change default passwords
- Use HTTPS via reverse proxy
- Implement network segmentation
- Regular security updates
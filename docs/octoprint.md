# OctoPrint Container Deployment Documentation

## Service Overview

OctoPrint provides a web interface for controlling consumer 3D printers, offering remote monitoring, control, and management capabilities. It transforms a simple USB-connected 3D printer into a network-enabled smart device with features including webcam streaming, timelapse recording, plugin support, and comprehensive printer management.

## Container Availability

### Official Images
- **Registry**: Docker Hub (`octoprint/octoprint`)
- **Multi-arch Support**: `amd64`, `arm64`, `arm/v7`
- **Base Image**: Python 3 on Alpine/Debian variants

### Available Tags
- `latest` - Latest stable release (currently 1.11.2)
- `edge` - Latest release including prereleases
- `canary` - Follows maintenance branch
- `bleeding` - Follows development branch
- `X.Y.Z` - Specific version tags (e.g., `1.11.2`, `1.11.1`)
- `minimal` - Lightweight variant with reduced dependencies
- `*-minimal` - Minimal versions of all above tags

### Recommended Images
- **Production**: `octoprint/octoprint:latest`
- **Testing**: `octoprint/octoprint:edge`
- **Resource-constrained**: `octoprint/octoprint:minimal`

## Environment Variables

### Core Configuration
- `ENABLE_MJPG_STREAMER` - Enable webcam streaming (default: `false`)
- `CAMERA_DEV` - Camera device path (default: `/dev/video0`)
- `MJPG_STREAMER_INPUT` - MJPG streamer parameters (default: `-n -r 640x480`)
- `AUTOMIGRATE` - Auto-migrate filesystem structures (default: `false`)
- `OCTOPRINT_PORT` - Web interface port (default: `5000`)

### Advanced Options
- `PYTHONUSERBASE` - Python user base directory
- `PIP_USER` - Enable user pip installations
- `OCTOPRINT_DEBUG` - Enable debug logging
- `OCTOPRINT_BASE_URL` - Base URL for reverse proxy setups

## Configuration Files

### Primary Configuration
- **Location**: `/octoprint/octoprint/config.yaml`
- **Format**: YAML
- **Key Sections**:
  - `server` - Host, port, and server settings
  - `webcam` - Camera configuration
  - `accessControl` - User management settings
  - `api` - API key and access settings
  - `plugins` - Plugin configurations
  - `printer` - Printer connection settings
  - `temperature` - Temperature monitoring profiles
  - `gcode` - GCODE scripts and macros

### Users Database
- **Location**: `/octoprint/octoprint/users.yaml`
- **Purpose**: User accounts and permissions

### Plugin Data
- **Location**: `/octoprint/plugins/`
- **Purpose**: Downloaded and installed plugins

### Logs
- **Location**: `/octoprint/logs/`
- **Files**: `octoprint.log`, `plugin_*.log`

## Resource Requirements

### Minimum Requirements
- **CPU**: 1 core (ARM or x86)
- **Memory**: 256MB RAM
- **Storage**: 1GB for application and data

### Recommended Requirements
- **CPU**: 2+ cores
- **Memory**: 512MB-1GB RAM
- **Storage**: 4GB+ (for timelapses and uploads)

### Performance Scaling
- Additional memory for multiple simultaneous connections
- CPU scales with plugin usage and webcam streaming
- Storage scales with print file uploads and timelapse recordings

## Network Configuration

### Required Ports
- **5000/tcp** - Web interface and API
- **8080/tcp** - MJPG Streamer (webcam)

### Optional Ports
- **8081/tcp** - Additional camera streams
- **8082/tcp** - Third camera stream (if configured)

### Service Discovery
- Supports Bonjour/mDNS for automatic discovery
- Service type: `_octoprint._tcp`

## Volume Requirements

### Essential Volumes
- `/octoprint` - Main configuration and data directory
  - Persistent storage for all OctoPrint data
  - Contains config, plugins, uploads, timelapses

### Device Mounts
- `/dev/ttyUSB0` or `/dev/ttyACM0` - 3D printer serial connection
- `/dev/video0` - Webcam device (if using webcam)

### Recommended Mount Structure
```
/octoprint/
├── octoprint/          # Configuration directory
│   ├── config.yaml     # Main configuration
│   ├── users.yaml      # User database
│   └── printerProfiles/ # Printer profiles
├── plugins/            # Installed plugins
├── uploads/            # GCODE uploads
├── timelapse/          # Timelapse recordings
├── logs/               # Application logs
└── data/               # Application data
```

## Dependencies

### External Services
- None required for basic operation

### Optional Services
- **Slicer** - For STL to GCODE conversion (CuraEngine, Slic3r)
- **MQTT Broker** - For MQTT plugin integration
- **Database** - Some plugins may require SQLite/PostgreSQL

### Hardware Dependencies
- **3D Printer** - USB serial connection required
- **Webcam** - USB UVC-compatible camera (optional)
- **GPIO Access** - For relay/LED control plugins (Raspberry Pi)

## Security Considerations

### Access Control
- **Default**: No authentication (must be configured)
- **User Management**: Built-in user system with roles
- **API Keys**: Required for external API access
- **Force Login**: Recommended for internet-exposed instances

### Network Security
- **HTTPS**: Configure reverse proxy with SSL/TLS
- **CORS**: Configurable cross-origin policies
- **IP Whitelisting**: Available through access control
- **API Security**: Token-based authentication

### File System Security
- **Upload Restrictions**: File type and size limits
- **Plugin Sandboxing**: Limited by Python environment
- **Script Execution**: GCODE scripts run with container permissions

### Container Security
- **Non-root User**: Container runs as `octoprint` user (UID 1000)
- **Capabilities**: Requires device access for printer/camera
- **Read-only Root**: Possible with proper volume configuration

## Deployment Patterns

### Standalone Deployment
- Single container with all features
- Direct USB connection to printer
- Local storage for all data

### Multi-Instance Setup
- Multiple containers for multiple printers
- Unique ports per instance
- Separate data volumes per printer

### High Availability
- Not typically configured for HA
- Stateful service with device dependencies
- Consider backup strategies instead

### Reverse Proxy Configuration
- Common with Traefik, Nginx, or Caddy
- WebSocket support required
- Path-based routing supported

## Version Matrix

### OctoPrint Versions
- **1.11.x** - Current stable branch (Python 3.9+)
- **1.10.x** - Previous stable (Python 3.7+)
- **1.9.x** - Legacy support (Python 3.7+)

### Python Compatibility
- **1.11.x** - Python 3.9, 3.10, 3.11, 3.12
- **1.10.x** - Python 3.7, 3.8, 3.9, 3.10, 3.11
- **1.9.x** - Python 3.7, 3.8, 3.9, 3.10

### Plugin Compatibility
- Check plugin compatibility per OctoPrint version
- Python version affects available plugins
- Some plugins require specific system packages

## Integration Capabilities

### Camera Support
- **MJPG Streamer** - Built-in support
- **USB Cameras** - UVC-compatible devices
- **Network Cameras** - MJPEG/H.264 streams
- **Multiple Cameras** - Configurable multi-cam setups

### Slicer Integration
- **Built-in** - CuraEngine support
- **External** - Slic3r, PrusaSlicer via plugins
- **Cloud** - Integration with cloud slicing services

### Monitoring Integration
- **MQTT** - Home automation integration
- **Webhooks** - Event notifications
- **REST API** - Full control via API
- **Prometheus** - Metrics export via plugins

### File Management
- **Upload Methods** - Web UI, API, watched folders
- **Storage Providers** - Local, SD card (printer)
- **Cloud Storage** - Via plugins (Google Drive, Dropbox)

## Backup and Restore

### Backup Scope
- Configuration files (`config.yaml`, `users.yaml`)
- Installed plugins and settings
- Uploaded GCODE files
- Timelapse recordings
- Printer profiles

### Backup Methods
- **Built-in Backup Plugin** - Creates downloadable archives
- **Volume Backup** - Direct volume snapshot/copy
- **File-level Backup** - Selective file backup

### Restore Procedures
- Stop container before restore
- Replace volume contents or specific files
- Restart container with restored data
- Verify printer connection and settings

## Performance Tuning

### Memory Optimization
- Adjust plugin loading
- Limit concurrent connections
- Disable unused features
- Use minimal image variant

### CPU Optimization
- Limit webcam resolution/framerate
- Reduce timelapse quality
- Minimize active plugins
- Disable unnecessary logging

### Storage Optimization
- Regular cleanup of old timelapses
- Limit upload retention
- Compress stored GCODE files
- External storage for large files

## Troubleshooting

### Common Issues

#### Printer Connection
- **Device Permissions**: Ensure container has device access
- **Serial Settings**: Match baud rate with printer
- **USB Mapping**: Verify correct device path
- **Driver Issues**: Some printers need specific drivers

#### Webcam Issues
- **Device Access**: Check `/dev/video*` permissions
- **Format Support**: Verify MJPEG compatibility
- **Multiple Cameras**: Ensure unique device paths
- **Stream URL**: Verify internal vs external URLs

#### Plugin Problems
- **Compatibility**: Check Python/OctoPrint version
- **Dependencies**: Some plugins need system packages
- **Permissions**: File system write permissions
- **Network Access**: Some plugins require internet

#### Performance Issues
- **CPU Usage**: Check webcam and plugin load
- **Memory Leaks**: Monitor long-running instances
- **Storage Full**: Check timelapse and upload directories
- **Network Latency**: Verify connection stability

### Log Locations
- **Main Log**: `/octoprint/logs/octoprint.log`
- **Plugin Logs**: `/octoprint/logs/plugin_*.log`
- **Serial Log**: Enable via settings for debugging
- **Webcam Log**: MJPG streamer output in container logs

### Debug Mode
- Set `OCTOPRINT_DEBUG=true` environment variable
- Increases logging verbosity
- Enables development features
- Performance impact when enabled

## Best Practices

### Container Configuration
- Use specific version tags in production
- Mount printer device as read-write
- Configure persistent storage for data
- Set appropriate resource limits

### Security Hardening
- Enable access control immediately
- Use strong passwords and API keys
- Configure HTTPS via reverse proxy
- Limit network exposure

### Maintenance
- Regular backups of configuration
- Monitor disk usage for timelapses
- Update plugins cautiously
- Keep OctoPrint version current

### Multi-Printer Setup
- Use separate containers per printer
- Unique port assignments
- Isolated data volumes
- Centralized reverse proxy

## Migration Notes

### From OctoPi
- Export settings via backup plugin
- Copy plugin configurations
- Migrate user accounts
- Transfer GCODE library

### Version Upgrades
- Backup before upgrading
- Check plugin compatibility
- Review breaking changes
- Test in non-production first

### Container Migration
- Stop source container
- Copy volume data
- Update configuration paths
- Start new container
- Verify printer connection
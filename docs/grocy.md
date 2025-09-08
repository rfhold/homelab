# Grocy Container Requirements Documentation

## Service Overview

Grocy is a web-based, self-hosted ERP (Enterprise Resource Planning) system designed for household management. It helps track groceries, manage chores, track battery life, and reduce food waste through comprehensive inventory management. The application provides features for stock management, shopping lists, meal planning, recipe management, and household task tracking.

## Container Availability

### Official Docker Images

**LinuxServer.io Image (Recommended)**
- **Registry**: Docker Hub
- **Image**: `lscr.io/linuxserver/grocy:latest`
- **Alternative registries**:
  - GitHub Container Registry: `ghcr.io/linuxserver/grocy`
  - GitLab Registry: `registry.gitlab.com/linuxserver.io/docker-grocy`
  - Quay.io: `quay.io/linuxserver.io/grocy`

### Supported Architectures
- `linux/amd64` (x86-64)
- `linux/arm64/v8` (ARM64)

### Version Tags
- `latest` - Latest stable release (currently v4.5.0)
- `4.5.0` - Specific version
- `version-v4.5.0` - Alternative version tag
- `v4.5.0-ls301` - LinuxServer build number

## Environment Variables

### Required Variables
- `PUID` - User ID for file permissions (default: 1000)
- `PGID` - Group ID for file permissions (default: 1000)
- `TZ` - Timezone (e.g., "America/New_York", "Europe/London")

### Optional Variables
- `UMASK` - Override default umask settings (e.g., "022")
- `FILE__<VARIABLE>` - Docker secrets support for any environment variable

### Application-Specific Environment
Grocy configuration is primarily managed through the `config.php` file rather than environment variables. Key settings include:
- `BASE_URL` - Base URL for the application
- `DEFAULT_LOCALE` - Default language (e.g., 'en', 'de')
- `CURRENCY` - Currency symbol
- `FEATURE_FLAG_*` - Various feature toggles

## Configuration Files

### Primary Configuration
- **Location**: `/config/data/config.php`
- **Template**: Based on `config-dist.php` from the application
- **Format**: PHP configuration array

### Key Configuration Options
```php
Setting('BASE_URL', '/');
Setting('DEFAULT_LOCALE', 'en');
Setting('CURRENCY', 'USD');
Setting('DISABLE_URL_REWRITING', false);
Setting('MODE', 'production');
Setting('FEATURE_FLAG_STOCK', true);
Setting('FEATURE_FLAG_SHOPPINGLIST', true);
Setting('FEATURE_FLAG_RECIPES', true);
Setting('FEATURE_FLAG_CHORES', true);
Setting('FEATURE_FLAG_TASKS', true);
Setting('FEATURE_FLAG_BATTERIES', true);
Setting('FEATURE_FLAG_EQUIPMENT', true);
Setting('FEATURE_FLAG_CALENDAR', true);
```

### Custom CSS/JS Support
- `/config/data/custom_css.html` - Custom CSS injected before `</head>`
- `/config/data/custom_js.html` - Custom JavaScript injected before `</body>`

## Resource Requirements

### Minimum Requirements
- **CPU**: 0.5 vCPU
- **Memory**: 256MB RAM
- **Storage**: 500MB for application and database

### Recommended Requirements
- **CPU**: 1 vCPU
- **Memory**: 512MB RAM
- **Storage**: 2GB+ (depending on attachment storage needs)

### Performance Considerations
- SQLite performance improves significantly with version 3.39.4+
- PHP 8.2 or 8.3 recommended
- OPcache enabled for better performance

## Network Configuration

### Ports
- **80/tcp** - HTTP web interface (container internal)
- **443/tcp** - HTTPS web interface (if SSL configured externally)

### Common Port Mappings
- Host port 9283 -> Container port 80 (default recommendation)

### Protocol Requirements
- HTTP/HTTPS for web interface
- WebSocket support not required

## Dependencies

### Internal Dependencies (Included in Container)
- **PHP 8.3** with extensions:
  - `fileinfo`
  - `pdo_sqlite`
  - `gd`
  - `ctype`
  - `intl`
  - `zlib`
  - `mbstring`
  - `ldap`
  - `json`
  - `opcache`
- **SQLite 3.34.0+** (3.39.4+ recommended)
- **Nginx** web server
- **Alpine Linux** base

### External Dependencies
- None required - Grocy is self-contained
- Optional: External reverse proxy for SSL termination

## Storage and Volumes

### Required Volume Mounts
- `/config` - Persistent configuration and data storage
  - Contains SQLite database
  - User configuration files
  - Uploaded files and attachments
  - Application logs

### Directory Structure
```
/config/
├── data/
│   ├── config.php           # Main configuration
│   ├── grocy.db             # SQLite database
│   ├── storage/             # File uploads
│   ├── viewcache/           # Template cache
│   └── backups/             # Backup files
├── log/
│   └── grocy/              # Application logs
└── nginx/
    └── site-confs/         # Nginx configuration
```

### Backup Considerations
- Database file: `/config/data/grocy.db`
- Uploaded files: `/config/data/storage/`
- Configuration: `/config/data/config.php`

## Security Considerations

### Authentication
- Default credentials: `admin` / `admin` (must be changed immediately)
- Supports multiple users with role-based access
- No built-in 2FA support

### File Permissions
- Use PUID/PGID to match host user permissions
- Ensure `/config` directory is writable by the container user
- Sensitive files should be protected at the host level

### Network Security
- Always use HTTPS in production (via reverse proxy)
- Consider implementing authentication at reverse proxy level
- Restrict direct container access to trusted networks

### Secrets Management
- Support for Docker secrets via `FILE__` environment variables
- Database contains sensitive user data - protect accordingly
- No external API keys or secrets required by default

## Deployment Patterns

### Standalone Deployment
- Single container deployment
- SQLite database included
- No external database required
- Suitable for home use and small deployments

### Reverse Proxy Configuration
- Commonly deployed behind Traefik, Nginx, or Caddy
- SSL/TLS termination at proxy level
- Path-based or subdomain routing supported

### High Availability Considerations
- SQLite database limits horizontal scaling
- No built-in clustering support
- Backup and restore for disaster recovery
- Consider read-only replicas for reporting

### Container Orchestration
- **Docker Compose**: Straightforward single-node deployment
- **Kubernetes**: Requires persistent volume for `/config`
- **Docker Swarm**: Similar to Docker Compose with service definitions

## Version Matrix

### Application Versions
- **v4.5.0** - Latest stable (as of August 2024)
- **v4.4.x** - Previous stable branch
- **v4.3.x** - Legacy version

### PHP Compatibility
- v4.5.x requires PHP 8.2 or 8.3
- v4.4.x supports PHP 8.1-8.3
- v4.3.x supports PHP 8.0-8.2

### Database Compatibility
- SQLite 3.34.0 minimum
- SQLite 3.39.4+ recommended for performance
- Migration path available for upgrades

### Container Image Updates
- LinuxServer.io provides regular base image updates
- Application updates require container recreation
- Database migrations run automatically on version changes

## Health Checks

### Endpoints
- `/api/system/info` - System information endpoint
- `/` - Main application page

### Container Health
- HTTP GET request to port 80
- Expected response: HTTP 200 OK
- Startup time: ~10-30 seconds

## Migration and Upgrade Notes

### Database Migrations
- Automatic on container start when version changes
- Visit root URL (`/`) after upgrade to trigger migrations
- Backup recommended before major version upgrades

### Data Persistence
- All data stored in `/config` volume
- Container can be recreated without data loss
- Version upgrades preserve user data

### Breaking Changes
- Check release notes for breaking changes
- Major versions may require configuration updates
- API changes may affect integrations

## Monitoring and Logging

### Application Logs
- Location: `/config/log/grocy/`
- Log level configurable in `config.php`
- Includes error logs and access logs

### Container Logs
- Standard output/error captured by Docker
- View with `docker logs <container_name>`
- Includes startup messages and errors

### Metrics
- No built-in metrics endpoint
- Monitor via reverse proxy metrics
- Database size growth over time
- Storage usage for attachments

## Known Limitations

- Single-user database (SQLite) limits concurrent writes
- No native mobile app (responsive web interface only)
- Limited API rate limiting capabilities
- No built-in backup scheduling (external solution required)
- Barcode scanning requires HTTPS for camera access
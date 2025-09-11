# FreshRSS Container Deployment Guide

## Service Overview

FreshRSS is a free, self-hosted RSS and Atom feed aggregator that allows you to follow and read news from multiple sources in a single interface. It's a lightweight, multi-user application with support for mobile clients via API, WebSub/PubSubHubbub for real-time updates, and extensive customization through extensions and themes.

### Primary Use Cases
- Personal news aggregation and reading
- Team or organization news monitoring
- Content curation and archival
- RSS feed management with categorization and filtering
- Multi-device synchronization via mobile apps

## Container Availability

### Official Docker Images

**Repository**: `freshrss/freshrss`  
**Docker Hub**: https://hub.docker.com/r/freshrss/freshrss

### Image Tags and Variants

- **`:latest`** - Latest stable release (recommended for production)
- **`:edge`** - Rolling release from the edge branch (latest features)
- **`:x.y.z`** - Specific version tags (e.g., `:1.27.0`)
- **`:x`** - Latest release within major version (e.g., `:1` for latest 1.x)
- **`*-alpine`** - Alpine Linux based variants (smaller size, newer packages)

### Architecture Support
- `linux/amd64` (Intel/AMD x64)
- `linux/arm64` (ARM 64-bit)
- `linux/arm/v7` (ARM 32-bit v7)

### Base Image Comparison
- **Debian (default)**: Better performance in tests, larger image size
- **Alpine (`*-alpine`)**: Smaller image, faster build times, newer packages

## Environment Variables

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `UTC` | Server timezone (e.g., `Europe/Paris`, `America/New_York`) |
| `CRON_MIN` | (disabled) | Minutes for cron refresh (e.g., `1,31` for twice hourly) |
| `DATA_PATH` | (empty) | Custom path for writable data directory |
| `FRESHRSS_ENV` | `production` | Set to `development` for enhanced logging |
| `LISTEN` | `80` | Internal Apache listening port (e.g., `0.0.0.0:8080`) |

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `COPY_LOG_TO_SYSLOG` | `On` | Copy logs to syslog |
| `COPY_SYSLOG_TO_STDERR` | `On` | Copy syslog to stderr for Docker logs |

### Auto-Installation Variables

These variables are only used on first run:

| Variable | Default | Description |
|----------|---------|-------------|
| `FRESHRSS_INSTALL` | (empty) | Arguments for `cli/do-install.php` |
| `FRESHRSS_USER` | (empty) | Arguments for `cli/create-user.php` |

### Proxy Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUSTED_PROXY` | (auto) | Space-separated list of trusted proxy IP ranges |

### OpenID Connect (Debian only)

| Variable | Default | Description |
|----------|---------|-------------|
| `OIDC_ENABLED` | `0` | Set to `1` to enable OpenID Connect |

## Configuration Files

### Application Configuration

**Location**: `/var/www/FreshRSS/data/config.php`

Key configuration parameters:
- `environment`: `production` or `development`
- `base_url`: Full URL of FreshRSS instance
- `language`: Default UI language
- `default_user`: Default/anonymous user (typically `_`)
- `auth_type`: Authentication method (`form`, `http_auth`, `none`)
- `api_enabled`: Enable API for mobile apps
- `pubsubhubbub_enabled`: Enable WebSub support

### User Configuration

**Location**: `/var/www/FreshRSS/data/config-user.default.php`

Default user settings:
- `posts_per_page`: Articles per page (default: 20)
- `archiving`: Keep period and limits
- `theme`: UI theme selection
- `shortcuts`: Keyboard shortcuts
- `sharing`: Sharing service configurations

### Custom Configuration Files

Mount custom configuration files:
- `/var/www/FreshRSS/data/config.custom.php` - Global settings override
- `/var/www/FreshRSS/data/config-user.custom.php` - Default user settings

## Resource Requirements

### Minimum Requirements
- **CPU**: 1 vCPU (works on Raspberry Pi 1)
- **Memory**: 256MB RAM minimum
- **Storage**: 100MB for application + data storage needs

### Recommended Resources
- **CPU**: 2+ vCPUs for better performance
- **Memory**: 512MB-1GB RAM
- **Storage**: 1GB+ depending on feed count and retention

### Performance Tuning
- `nb_parallel_refresh`: Number of parallel feed refreshes (default: 10)
- `cache_duration`: SimplePie cache duration (default: 800 seconds)
- `timeout`: HTTP request timeout (default: 20 seconds)

## Network Configuration

### Ports
- **80/tcp**: Default internal HTTP port
- Can be customized via `LISTEN` environment variable

### Service Discovery
- Container name resolution when using Docker networks
- Supports reverse proxy configurations

### WebSub/PubSubHubbub
- Requires `base_url` to be externally reachable
- Instant push notifications from compatible sources

## Dependencies

### Database Options

FreshRSS supports multiple database backends:

1. **SQLite** (Default)
   - Built-in, no external dependencies
   - Good performance for single/small deployments
   - Zero configuration required

2. **PostgreSQL** (10+)
   - Better for multi-user deployments
   - Requires external PostgreSQL container/service
   - Connection via `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_BASE`

3. **MySQL/MariaDB** (MySQL 8.0+ / MariaDB 10.0.5+)
   - Alternative for multi-user deployments
   - Requires external MySQL/MariaDB container/service

### PHP Extensions Required
- cURL, DOM, JSON, XML, session, ctype (included in image)
- PDO with database driver (SQLite/PostgreSQL/MySQL)
- Optional: GMP, IDN, mbstring, iconv, ZIP, zlib

### External Services
- SMTP server (optional, for email notifications)
- OpenID Connect provider (optional, for SSO)

## Security Considerations

### Authentication Methods

1. **Form Authentication** (default)
   - Web-based login form
   - User registration control via `max_registrations`
   - Email validation option

2. **HTTP Authentication**
   - Server-level authentication
   - Protect `/p/i/` directory only
   - Auto-registration option available

3. **OpenID Connect** (Debian image only)
   - SSO integration
   - Requires additional configuration

### API Security
- Separate API password per user
- Google Reader API endpoint: `/api/greader.php`
- Fever API support (limited features)

### Network Security
- Configure `TRUSTED_PROXY` for reverse proxy setups
- HTTPS recommended (configure at reverse proxy)
- CSP (Content Security Policy) warnings for insecure configurations

### File Permissions
- Data directory requires write access for web server user
- Sensitive data stored in `/var/www/FreshRSS/data/`
- Never expose data directory to web

## Deployment Patterns

### Single Container with SQLite
Simplest deployment for personal use:
- Single container
- Built-in SQLite database
- Minimal configuration required

### Multi-Container with PostgreSQL/MySQL
Production deployment for multiple users:
- Separate database container
- Better performance and scalability
- Backup/restore capabilities

### Behind Reverse Proxy
Recommended for production:
- HTTPS termination at proxy
- Multiple FreshRSS instances
- Load balancing capability

### High Availability
- Database replication
- Shared storage for data directory
- Multiple FreshRSS containers

## Version Matrix

### PHP Compatibility
- PHP 8.1+ required for latest versions
- PHP 7.4 support ended with version 1.21.0

### Database Version Requirements
- PostgreSQL: 10+ 
- MySQL: 8.0+
- MariaDB: 10.0.5+
- SQLite: 3.x (bundled)

### Browser Compatibility
- Modern browsers required
- Mobile browser support (with limitations)
- Firefox/Chrome/Safari/Edge latest versions

## Volume Requirements

### Essential Volumes

1. **Data Volume** (`/var/www/FreshRSS/data`)
   - User data and configurations
   - Database files (if using SQLite)
   - Logs and cache
   - **Persistence**: Required

2. **Extensions Volume** (`/var/www/FreshRSS/extensions`)
   - Third-party extensions
   - Custom themes
   - **Persistence**: Optional but recommended

### Volume Permissions
- Owner: `www-data` (Debian) or `apache` (Alpine)
- Mode: 755 for directories, 644 for files

## Health Checks

### Built-in Health Check
- Endpoint: `cli/health.php`
- Checks database connectivity
- Validates configuration

### Monitoring Points
- Container logs via Docker
- Application logs in `/var/www/FreshRSS/data/users/*/log*.txt`
- Shared logs in `/var/www/FreshRSS/data/users/_/`

## Backup Considerations

### Critical Data
- `/var/www/FreshRSS/data/` directory
- Database (if external)
- Custom configurations

### Backup Tools
- Built-in CLI: `cli/db-backup.php` and `cli/db-restore.php`
- Docker volume backup tools
- Database-specific backup tools

## Update Strategy

### Container Updates
1. Pull new image version
2. Stop existing container
3. Create new container with same volumes
4. Verify functionality
5. Remove old container

### Database Migrations
- Automatic on container start
- Manual via `cli/db-optimize.php`
- Backup before major updates

## Common Configuration Examples

### Basic Deployment
```yaml
services:
  freshrss:
    image: freshrss/freshrss:latest
    container_name: freshrss
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - freshrss_data:/var/www/FreshRSS/data
      - freshrss_extensions:/var/www/FreshRSS/extensions
    environment:
      - TZ=America/New_York
      - CRON_MIN=1,31
```

### With PostgreSQL Database
```yaml
services:
  freshrss:
    image: freshrss/freshrss:latest
    container_name: freshrss
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - freshrss_data:/var/www/FreshRSS/data
      - freshrss_extensions:/var/www/FreshRSS/extensions
    environment:
      - TZ=America/New_York
      - CRON_MIN=1,31
      - FRESHRSS_INSTALL=|
          --api-enabled
          --base-url https://freshrss.example.com
          --db-type pgsql
          --db-host freshrss-db
          --db-user freshrss
          --db-password changeme
          --db-base freshrss
          --default-user admin
      - FRESHRSS_USER=|
          --user admin
          --password changeme
          --email admin@example.com
    depends_on:
      - freshrss-db
    networks:
      - freshrss-network

  freshrss-db:
    image: postgres:16
    container_name: freshrss-db
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=freshrss
      - POSTGRES_USER=freshrss
      - POSTGRES_PASSWORD=changeme
    networks:
      - freshrss-network

volumes:
  freshrss_data:
  freshrss_extensions:
  postgres_data:

networks:
  freshrss-network:
```

### Behind Traefik Proxy
```yaml
services:
  freshrss:
    image: freshrss/freshrss:latest
    container_name: freshrss
    restart: unless-stopped
    volumes:
      - freshrss_data:/var/www/FreshRSS/data
      - freshrss_extensions:/var/www/FreshRSS/extensions
    environment:
      - TZ=America/New_York
      - CRON_MIN=1,31
      - TRUSTED_PROXY=172.16.0.0/12
    labels:
      - traefik.enable=true
      - traefik.http.routers.freshrss.rule=Host(`freshrss.example.com`)
      - traefik.http.routers.freshrss.entrypoints=websecure
      - traefik.http.routers.freshrss.tls.certresolver=letsencrypt
      - traefik.http.services.freshrss.loadbalancer.server.port=80
    networks:
      - proxy
      - internal

volumes:
  freshrss_data:
  freshrss_extensions:

networks:
  proxy:
    external: true
  internal:
```

## Troubleshooting

### Common Issues

1. **Permission Errors**
   - Ensure data directory is writable by web server user
   - Check volume ownership (`www-data` or `apache`)

2. **Database Connection Failed**
   - Verify database container is running
   - Check network connectivity between containers
   - Validate database credentials

3. **Feeds Not Updating**
   - Check `CRON_MIN` environment variable
   - Verify `base_url` for WebSub functionality
   - Check logs for HTTP errors

4. **API Not Working**
   - Ensure `api_enabled` is set to true
   - Set user API password
   - Check reverse proxy headers

### Debug Mode
Set `FRESHRSS_ENV=development` for:
- Enhanced error logging
- Detailed error messages
- Performance metrics

### Log Locations
- Container logs: `docker logs freshrss`
- Application logs: `/var/www/FreshRSS/data/users/*/log*.txt`
- Shared logs: `/var/www/FreshRSS/data/users/_/`

## CLI Commands

### User Management
- `cli/list-users.php` - List all users
- `cli/create-user.php` - Create new user
- `cli/delete-user.php` - Delete user
- `cli/update-user.php` - Update user settings

### Feed Management
- `cli/actualize-user.php` - Refresh feeds for user
- `cli/import-for-user.php` - Import OPML
- `cli/export-opml-for-user.php` - Export OPML

### Database Operations
- `cli/db-backup.php` - Backup database
- `cli/db-restore.php` - Restore database
- `cli/db-optimize.php` - Optimize database

### System Maintenance
- `cli/health.php` - Health check
- `cli/do-install.php` - Initial installation
- `cli/reconfigure.php` - Reconfigure instance

## Extension Support

FreshRSS supports extensions for additional functionality:
- Custom themes
- Sharing services
- Content filters
- Feed processors

Extensions directory: `/var/www/FreshRSS/extensions`

## Mobile Client Support

### Google Reader API Compatible
- Readrops (Android)
- FeedMe (Android)
- Fluent Reader (Cross-platform)
- RSS Guard (Desktop)
- Reeder (iOS/macOS)

### Fever API Compatible
- Unread (iOS)
- Fiery Feeds (iOS)

## Performance Optimization

### Feed Refresh
- Adjust `CRON_MIN` for optimal refresh frequency
- Use WebSub for real-time updates where available
- Configure `nb_parallel_refresh` based on server capacity

### Database
- Regular optimization with `cli/db-optimize.php`
- Consider PostgreSQL/MySQL for large deployments
- Implement database connection pooling

### Caching
- Configure `cache_duration` appropriately
- Use reverse proxy caching for static assets
- Enable PHP opcache in container

## References

- Official Website: https://freshrss.org
- GitHub Repository: https://github.com/FreshRSS/FreshRSS
- Documentation: https://freshrss.github.io/FreshRSS/
- Docker Hub: https://hub.docker.com/r/freshrss/freshrss
- Extensions: https://github.com/FreshRSS/Extensions
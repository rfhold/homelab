# Obico Server Container Deployment Documentation

## Service Overview

Obico Server (formerly The Spaghetti Detective) is an open-source, AI-powered failure detection platform for 3D printing. It provides real-time monitoring, failure detection using computer vision, remote printer control, and mobile/web access for OctoPrint and Klipper-based 3D printers. The server uses machine learning models to detect print failures and can automatically pause prints when issues are detected.

## Container Availability

### Official Images
- **Registry**: Docker Hub
  - `thespaghettidetective/web:base-1.18` - Base web container image
  - `thespaghettidetective/ml_api_base:1.4` - Base ML API image
- **Architecture Support**: `amd64`, `arm64` (Nvidia GPU optional)
- **Build Method**: Docker Compose with custom Dockerfiles

### Container Components
The Obico Server consists of multiple containers:
- **web** - Django web application and API server
- **ml_api** - Machine learning API for failure detection
- **tasks** - Celery background task worker
- **redis** - Cache and message broker

### Recommended Deployment
- **Production**: Use release branch with docker-compose
- **Development**: Use docker-compose-dev.yml
- **GPU Support**: Optional Nvidia GPU for enhanced ML performance

## Environment Variables

### Core Configuration
- `DJANGO_SECRET_KEY` - Django secret key (generate with `manage.py gen_site_secret`)
- `DEBUG` - Debug mode (default: `False`, never use `True` in production)
- `SITE_USES_HTTPS` - HTTPS configuration (default: `False`)
- `SITE_IS_PUBLIC` - Public accessibility (default: `False`)
- `ACCOUNT_ALLOW_SIGN_UP` - Enable user registration (default: `False`)

### Email Configuration (SMTP)
- `EMAIL_HOST` - SMTP server hostname
- `EMAIL_HOST_USER` - SMTP username/email address
- `EMAIL_HOST_PASSWORD` - SMTP password
- `EMAIL_PORT` - SMTP port (default: `587`)
- `EMAIL_USE_TLS` - Enable TLS (default: `True`)
- `DEFAULT_FROM_EMAIL` - From address for system emails

### Database Configuration
- `DATABASE_URL` - Database connection string (default: `sqlite:////app/db.sqlite3`)
- `REDIS_URL` - Redis connection URL (default: `redis://redis:6379`)

### Service URLs
- `INTERNAL_MEDIA_HOST` - Internal media server URL (default: `http://web:3334`)
- `ML_API_HOST` - ML API service URL (default: `http://ml_api:3333`)

### Security & Authentication
- `ADMIN_IP_WHITELIST` - IP whitelist for admin access (JSON array)
- `CSRF_TRUSTED_ORIGINS` - Trusted origins for CSRF (JSON array)
- `SOCIAL_LOGIN` - Enable social login providers (default: `False`)

### Tunnel Configuration
- `OCTOPRINT_TUNNEL_PORT_RANGE` - Port range for OctoPrint tunnels (default: `0-0`)

### Third-Party Integrations
- `TELEGRAM_BOT_TOKEN` - Telegram bot integration
- `TWILIO_ACCOUNT_SID` - Twilio SMS account SID
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_FROM_NUMBER` - Twilio sender phone number
- `PUSHOVER_APP_TOKEN` - Pushover notification token
- `SLACK_CLIENT_ID` - Slack OAuth client ID
- `SLACK_CLIENT_SECRET` - Slack OAuth client secret
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `SENTRY_DSN` - Sentry error tracking DSN

### Development Options
- `WEBPACK_LOADER_ENABLED` - Enable webpack loader (default: `False`)
- `SYNDICATE` - Internal syndication flag

## Configuration Files

### Django Settings
- **Location**: `/app/backend/config/settings.py`
- **Purpose**: Core Django application settings
- **Customization**: Environment variables override defaults

### Site Configuration
- **Django Admin**: `/admin/sites/site/`
- **Critical Setting**: Domain name must match access URL (without http://)
- **Format**: `hostname:port` or `domain:port`

### Database
- **SQLite Location**: `/app/db.sqlite3` (default)
- **PostgreSQL Option**: Configurable via `DATABASE_URL`
- **Migrations**: Auto-applied on container start

### Media Storage
- **Location**: `/app/backend/media/`
- **Contents**: User uploads, timelapses, snapshots
- **Persistence**: Must be volume-mounted

### Static Files
- **Location**: `/app/backend/static_build/`
- **Generation**: Auto-collected on container start
- **Serving**: Via Django/Daphne

## Resource Requirements

### Minimum Requirements
- **CPU**: 2 cores (x86_64 or ARM64)
- **Memory**: 4GB RAM
- **Storage**: 10GB for application and data
- **GPU**: Optional (Nvidia recommended for ML)

### Recommended Requirements
- **CPU**: 4+ cores
- **Memory**: 8GB RAM
- **Storage**: 50GB+ (scales with media storage)
- **GPU**: Nvidia GPU with 4GB+ VRAM

### Service-Specific Requirements
- **ML API**: 2GB RAM minimum, benefits from GPU
- **Web**: 1GB RAM per 10 concurrent users
- **Tasks**: 512MB RAM minimum
- **Redis**: 256MB RAM minimum

## Network Configuration

### Required Ports
- **3334/tcp** - Web interface and API (web container)
- **3333/tcp** - ML API service (ml_api container)
- **6379/tcp** - Redis (internal only)

### WebSocket Support
- Required for real-time updates
- Path: `/ws/`
- Handled by Daphne ASGI server

### Service Discovery
- Internal DNS via Docker networking
- Service names: `web`, `ml_api`, `redis`, `tasks`

## Volume Requirements

### Essential Volumes
- `/app/backend/` - Application code and configuration
- `/app/frontend/` - Frontend assets
- `/app/db.sqlite3` - SQLite database (if using)
- `/app/backend/media/` - User media storage

### Recommended Mount Structure
```
/obico-server/
├── backend/
│   ├── media/          # User uploads and media
│   ├── static_build/   # Collected static files
│   └── db.sqlite3      # SQLite database
├── frontend/           # Frontend source
└── ml_api/
    └── model/          # ML model weights
```

### Model Storage
- **Location**: `/app/ml_api/model/`
- **Size**: ~500MB for detection models
- **Auto-download**: Models downloaded on first start

## Dependencies

### Required Services
- **Redis** - Message broker and cache
  - Version: 7.2+ (Alpine variant recommended)
  - Role: Celery broker, Django cache, Channels layer

### Optional Services
- **PostgreSQL** - Production database (recommended)
  - Version: 13+ with extensions
  - Alternative to SQLite for production
- **Nginx/Traefik** - Reverse proxy for HTTPS
- **S3-compatible Storage** - For media offloading

### External Dependencies
- **Email Service** - SMTP server for notifications
- **OctoPrint/Klipper** - 3D printer interfaces to monitor

## Security Considerations

### Authentication & Access
- **Default Admin**: `root@example.com` / `supersecret` (must change)
- **User Registration**: Disabled by default
- **API Authentication**: Token-based for clients
- **Session Security**: Django session framework

### Network Security
- **HTTPS**: Configure via reverse proxy
- **CORS**: Configurable for API access
- **CSRF Protection**: Enabled by default
- **WebSocket Security**: Same-origin policy

### Container Security
- **User Context**: Runs as non-root user
- **Secret Management**: Use environment variables or secrets
- **File Permissions**: Proper ownership for volumes
- **Network Isolation**: Internal services not exposed

### Data Protection
- **Database Encryption**: At-rest encryption recommended
- **Media Access**: URL signing for sensitive content
- **Backup Strategy**: Regular backups essential
- **GDPR Compliance**: User data management features

## Deployment Patterns

### Single-Node Deployment
- All containers on one host
- Docker Compose orchestration
- Shared volumes for data
- Local Redis instance

### Multi-Node Deployment
- Web/Tasks scalable horizontally
- ML API on GPU nodes
- External Redis cluster
- Shared storage for media

### High Availability
- Multiple web container replicas
- Redis Sentinel for failover
- PostgreSQL replication
- Load balancer for web tier

### Reverse Proxy Setup
- Traefik/Nginx/Caddy supported
- WebSocket proxy configuration required
- SSL/TLS termination at proxy
- Path-based or subdomain routing

## Version Matrix

### Obico Server Versions
- **Latest Release**: Track `release` branch
- **Development**: Track `main` branch
- **Stable Tags**: Use specific git tags

### Component Compatibility
- **Django**: 4.0.10
- **Python**: 3.9+ required
- **Celery**: 5.4.0
- **Redis**: 7.2+
- **PostgreSQL**: 13+ (if used)

### Client Compatibility
- **OctoPrint Plugin**: 1.8.0+
- **Klipper Module**: Latest
- **Mobile Apps**: Auto-update recommended
- **Web Browsers**: Modern browsers required

## Integration Capabilities

### 3D Printer Platforms
- **OctoPrint**: Full integration via plugin
- **Klipper/Moonraker**: Native support
- **Multiple Printers**: Unlimited printer connections
- **Printer Groups**: Organizational features

### Notification Channels
- **Email**: SMTP configuration
- **Telegram**: Bot integration
- **Slack**: Workspace integration
- **SMS**: Twilio integration
- **Push**: Mobile app notifications
- **Webhooks**: Custom integrations

### AI/ML Features
- **Failure Detection**: Real-time analysis
- **Detection Sensitivity**: Configurable
- **Model Updates**: Automatic downloads
- **GPU Acceleration**: Optional Nvidia support
- **Custom Models**: Extensible architecture

### API Capabilities
- **RESTful API**: Full CRUD operations
- **WebSocket API**: Real-time updates
- **Authentication**: Token-based
- **Rate Limiting**: Configurable
- **Documentation**: OpenAPI/Swagger

## Backup and Restore

### Backup Scope
- Database (SQLite or PostgreSQL dump)
- Media files (user uploads, timelapses)
- Configuration (environment variables)
- Django secret key
- User accounts and settings

### Backup Methods
- **Database Export**: `manage.py dumpdata`
- **Media Archive**: Tar/zip media directory
- **Volume Snapshot**: Docker volume backup
- **Automated Backups**: Cron-based scripts

### Restore Procedures
1. Stop all containers
2. Restore database from backup
3. Restore media files
4. Update environment configuration
5. Run database migrations
6. Restart services
7. Verify site configuration

## Performance Tuning

### ML API Optimization
- GPU memory allocation
- Batch processing settings
- Model caching strategies
- Inference optimization

### Web Server Tuning
- Worker process count
- Connection pooling
- Static file serving
- Cache configuration

### Database Optimization
- Connection pooling
- Query optimization
- Index management
- Vacuum scheduling (SQLite)

### Redis Configuration
- Memory limits
- Eviction policies
- Persistence settings
- Connection limits

## Troubleshooting

### Common Issues

#### Site Configuration
- **Domain Mismatch**: Ensure Django site matches access URL
- **Port Issues**: Verify port mappings and firewall rules
- **HTTPS Problems**: Check reverse proxy configuration
- **CORS Errors**: Configure trusted origins

#### ML API Issues
- **Model Download**: Check internet connectivity
- **GPU Detection**: Verify Nvidia drivers and CUDA
- **Memory Errors**: Increase container memory limits
- **Slow Detection**: Consider GPU acceleration

#### Database Problems
- **Migration Errors**: Run migrations manually
- **Permission Issues**: Check file ownership
- **Connection Failures**: Verify database URL
- **Performance**: Consider PostgreSQL for production

#### Media Storage
- **Upload Failures**: Check volume permissions
- **Storage Full**: Monitor disk usage
- **404 Errors**: Verify media URL configuration
- **Slow Loading**: Consider CDN or S3 storage

### Log Locations
- **Web Logs**: Container stdout/stderr
- **ML API Logs**: Container logs
- **Celery Logs**: Tasks container output
- **Django Debug**: Enable DEBUG cautiously

### Health Checks
- **Web**: `http://web:3334/hc/`
- **ML API**: `http://ml_api:3333/hc/`
- **Redis**: `redis-cli ping`
- **Celery**: `celery inspect ping`

## Best Practices

### Production Deployment
- Use specific version tags
- Enable HTTPS via reverse proxy
- Configure proper backups
- Monitor resource usage
- Use PostgreSQL over SQLite
- Generate unique DJANGO_SECRET_KEY
- Disable DEBUG mode
- Configure email notifications

### Security Hardening
- Change default admin credentials
- Restrict admin IP access
- Use strong secret keys
- Enable CSRF protection
- Configure firewall rules
- Regular security updates
- Audit user permissions
- Implement rate limiting

### Scaling Considerations
- Horizontal scaling for web tier
- GPU nodes for ML processing
- External Redis for HA
- CDN for static/media files
- Database replication
- Load balancer configuration
- Session affinity for WebSockets
- Monitoring and alerting

### Maintenance Procedures
- Regular backup verification
- Database maintenance
- Log rotation
- Update scheduling
- Performance monitoring
- Security patching
- User management
- Storage cleanup

## Migration Notes

### From Cloud Service
- Export printer configurations
- Migrate user accounts
- Transfer print history
- Update client connections

### Version Upgrades
- Backup before upgrading
- Review release notes
- Test in staging first
- Run migrations
- Update client plugins
- Verify integrations

### Database Migration
- Export data from SQLite
- Configure PostgreSQL
- Import data
- Update DATABASE_URL
- Verify data integrity
- Test performance

## Special Considerations

### GPU Support
- Nvidia Container Toolkit required
- CUDA compatibility important
- Memory allocation tuning
- Multi-GPU configuration possible

### Multi-Tenant Setup
- User isolation built-in
- Printer access control
- Resource quotas configurable
- Billing integration possible

### Compliance Requirements
- GDPR data handling
- User data export
- Right to deletion
- Audit logging
- Data residency

### Development Environment
- Use docker-compose-dev.yml
- Hot reload for development
- Debug mode available
- Frontend development server
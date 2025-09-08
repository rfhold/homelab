# Immich Container Requirements Documentation

## Service Overview

Immich is a high-performance, self-hosted photo and video management solution designed as a privacy-focused alternative to Google Photos. It features automatic mobile backup, intelligent organization with machine learning, facial recognition, object detection, multi-user support with shared albums, and a modern web interface. Immich provides mobile apps for iOS and Android with automatic background backup, smart search capabilities using CLIP models, and comprehensive metadata management.

## Container Availability

### Official Docker Images

**GitHub Container Registry (Primary)**
- **Registry**: ghcr.io
- **Images**:
  - `ghcr.io/immich-app/immich-server:release` - Combined server image (API + microservices)
  - `ghcr.io/immich-app/immich-server:v1.140.1` - Specific version tag
  - `ghcr.io/immich-app/immich-machine-learning:release` - Machine learning service
  - `ghcr.io/immich-app/immich-machine-learning:v1.140.1` - Specific ML version

### Supported Architectures
- `linux/amd64` (x86-64)
- `linux/arm64/v8` (ARM64/aarch64)

### Version Tags
- `release` - Latest stable release
- `v1.140.1` - Current stable version (as of August 2025)
- Version-specific tags (e.g., `v1.139.0`, `v1.138.2`)

### Release Cycle
- Frequent releases (typically weekly)
- Breaking changes documented in release notes
- Database migrations handled automatically

## Environment Variables

### Core Configuration
- `IMMICH_VERSION` - Docker image tag to use (default: `release`)
- `UPLOAD_LOCATION` - Host path for uploaded files storage
- `DB_DATA_LOCATION` - Host path for PostgreSQL database files
- `TZ` - Timezone (e.g., "America/New_York", "Europe/London")
- `IMMICH_ENV` - Environment mode (`production` or `development`)
- `IMMICH_LOG_LEVEL` - Log verbosity (`verbose`, `debug`, `log`, `warn`, `error`)
- `IMMICH_MEDIA_LOCATION` - Media location inside container (default: `/data`)
- `IMMICH_CONFIG_FILE` - Path to optional config file

### Database Configuration
- `DB_HOSTNAME` - PostgreSQL host (default: `database`)
- `DB_PORT` - PostgreSQL port (default: `5432`)
- `DB_USERNAME` - Database username (default: `postgres`)
- `DB_PASSWORD` - Database password (default: `postgres`, should be changed)
- `DB_DATABASE_NAME` - Database name (default: `immich`)
- `DB_URL` - Alternative full database URL
- `DB_VECTOR_EXTENSION` - Vector extension (`vectorchord`, `pgvector`, `pgvecto.rs`)
- `DB_SKIP_MIGRATIONS` - Skip database migrations on startup (`true`/`false`)

### Redis Configuration
- `REDIS_HOSTNAME` - Redis host (default: `redis`)
- `REDIS_PORT` - Redis port (default: `6379`)
- `REDIS_USERNAME` - Redis username (optional)
- `REDIS_PASSWORD` - Redis password (optional)
- `REDIS_DBINDEX` - Redis database index (default: `0`)
- `REDIS_URL` - Alternative full Redis URL
- `REDIS_SOCKET` - Unix socket path (alternative to hostname/port)

### Machine Learning Configuration
- `MACHINE_LEARNING_MODEL_TTL` - Model unload timeout in seconds (default: `300`)
- `MACHINE_LEARNING_CACHE_FOLDER` - Model cache directory (default: `/cache`)
- `MACHINE_LEARNING_REQUEST_THREADS` - Request thread pool size
- `MACHINE_LEARNING_WORKERS` - Number of worker processes (default: `1`)
- `MACHINE_LEARNING_PRELOAD__CLIP__TEXTUAL` - Preload textual CLIP models
- `MACHINE_LEARNING_PRELOAD__CLIP__VISUAL` - Preload visual CLIP models
- `MACHINE_LEARNING_DEVICE_IDS` - GPU device IDs for multi-GPU setups

### Worker Configuration
- `IMMICH_WORKERS_INCLUDE` - Only run specified workers
- `IMMICH_WORKERS_EXCLUDE` - Exclude specified workers
- `IMMICH_API_METRICS_PORT` - Metrics port for API (default: `8081`)
- `IMMICH_MICROSERVICES_METRICS_PORT` - Metrics port for microservices (default: `8082`)

### Network Configuration
- `IMMICH_HOST` - Listening host (default: `0.0.0.0`)
- `IMMICH_PORT` - Server port (default: `2283`)
- `IMMICH_TRUSTED_PROXIES` - Comma-separated list of trusted proxy IPs

## Configuration Files

### Primary Configuration
- **Location**: `/config/immich.yml` (optional)
- **Format**: YAML configuration file
- **Purpose**: Override environment variables and set advanced options

### Configuration Structure
```yaml
# Optional configuration file
machineLearning:
  enabled: true
  url: http://immich-machine-learning:3003
  clip:
    enabled: true
    modelName: ViT-B-32__openai
  facialRecognition:
    enabled: true
    modelName: buffalo_l
    minScore: 0.7

ffmpeg:
  crf: 23
  preset: medium
  targetVideoCodec: h264
  targetAudioCodec: aac
  targetResolution: 720

job:
  backgroundTask:
    concurrency: 5
  smartSearch:
    concurrency: 2
  metadataExtraction:
    concurrency: 5
```

### Database Schema
- PostgreSQL with extensions:
  - `pgvector` or `pgvecto.rs` for vector similarity search
  - `pg_trgm` for text search
  - `btree_gin` for indexing
  - `unaccent` for text normalization
  - `earthdistance` and `cube` for geospatial queries

## Resource Requirements

### Minimum Requirements
- **CPU**: 2 cores (x86_64 or ARM64)
- **Memory**: 4GB RAM
- **Storage**: 10GB for application + space for media
- **Database**: PostgreSQL 14+ with vector extensions

### Recommended Requirements
- **CPU**: 4+ cores
- **Memory**: 6GB+ RAM
- **Storage**: SSD for database, large capacity for media
- **GPU**: Optional for accelerated ML inference

### Performance Considerations
- Machine learning models cached in memory
- Thumbnail generation is CPU-intensive
- Video transcoding benefits from hardware acceleration
- Database requires local SSD storage for optimal performance

## Network Configuration

### Required Ports
- **2283/tcp** - Web UI and API (main interface)
- **3001/tcp** - Machine learning service (internal)
- **5432/tcp** - PostgreSQL database (internal)
- **6379/tcp** - Redis cache (internal)

### Protocol Requirements
- HTTP/HTTPS for web interface
- WebSocket support for real-time updates
- Mobile app connectivity via API

### Internal Networking
- Communication between server and ML service
- Database connectivity required
- Redis for queue management

## Dependencies

### Required Services
- **PostgreSQL 14+**:
  - Vector extension required (pgvector, pgvecto.rs, or vectorchord)
  - Minimum 2GB RAM allocation
  - Local SSD storage strongly recommended
- **Redis 6.2+**:
  - Used for job queue management
  - Session storage
  - Cache layer

### Machine Learning Models
- **CLIP Models**:
  - Text encoder: ViT-B-32__openai
  - Visual encoder for smart search
  - Downloaded automatically on first use
- **Facial Recognition**:
  - buffalo_l model for face detection
  - buffalo_s for lighter deployments
- **Object Detection**:
  - Built-in models for object tagging

### Optional Services
- **Hardware Acceleration**:
  - NVIDIA GPU with CUDA support
  - Intel QuickSync for video transcoding
  - VAAPI for hardware video encoding
- **Reverse Proxy**:
  - Nginx, Traefik, or Caddy
  - SSL/TLS termination

## Storage and Volumes

### Required Volume Mounts
- `/data` - Media storage (mapped from `UPLOAD_LOCATION`)
  - Contains all uploaded photos and videos
  - Thumbnails and transcoded media
  - User profile pictures

### Media Storage Structure
```
/data/
├── library/
│   └── <userID>/           # User media files (if storage template enabled)
├── upload/
│   └── <userID>/           # Uploaded original files
├── thumbs/
│   └── <userID>/           # Generated thumbnails
├── encoded-video/
│   └── <userID>/           # Transcoded videos
├── profile/
│   └── <userID>/           # User avatars
└── backups/                # Automatic database dumps
```

### Cache Storage
- `/cache` - ML model cache (machine learning container)
  - CLIP models (~2GB)
  - Facial recognition models (~1GB)
  - Can be shared between container restarts

### Database Storage
- PostgreSQL data directory
  - Typically 1-3GB for metadata
  - Grows with library size
  - Requires fast storage (SSD recommended)

## Security Considerations

### Authentication
- Local user authentication with bcrypt
- OAuth2/OIDC support for SSO
- API key authentication for mobile apps
- Sharing links with optional passwords

### Data Privacy
- All processing done locally
- No external API calls for ML features
- User data isolation in multi-user setup
- Encrypted storage of sensitive settings

### Network Security
- HTTPS recommended via reverse proxy
- API rate limiting available
- CORS configuration for web security
- JWT tokens for session management

### Secrets Management
- Database passwords should be changed from defaults
- Support for Docker secrets via `_FILE` variables
- Environment variable substitution
- Secure storage of OAuth credentials

## Deployment Patterns

### Standard Deployment
- Multiple containers via Docker Compose
- Separate services for server, ML, database, Redis
- Shared volumes for media storage
- Internal Docker network for service communication

### High Availability Considerations
- Database replication possible with PostgreSQL
- Redis sentinel for cache HA
- Media storage on distributed filesystem
- Load balancing for multiple server instances

### Backup Strategy
- Automatic database dumps to `/data/backups`
- Filesystem backup of media files
- Database-first backup order recommended
- 3-2-1 backup strategy advised

### Container Orchestration
- **Docker Compose**: Recommended for single-node
- **Kubernetes**: Helm charts available
- **Docker Swarm**: Possible with constraints
- **Portainer**: Template available

## Version Matrix

### Immich Versions
- **v1.140.x** - Current stable branch
- **v1.139.x** - Previous stable
- **release** - Rolling release tag

### Compatibility Requirements
- **PostgreSQL**: 14+ (15+ recommended)
- **Redis**: 6.2+ (7.0+ recommended)
- **Node.js**: 20.x (internal)
- **FFmpeg**: 6.x (included)

### Database Migrations
- Automatic on container startup
- Irreversible for major versions
- Backup recommended before upgrades

## Monitoring and Health

### Health Endpoints
- `/api/server/ping` - Server health check
- `/api/server/version` - Version information
- `/api/server/stats` - System statistics

### Metrics
- Job queue status and processing
- Storage usage per user
- API request metrics
- ML inference performance

### Logging
- Structured JSON logging
- Configurable log levels
- Container stdout/stderr
- Error tracking support

## Integration Capabilities

### Mobile Applications
- iOS and Android native apps
- Automatic background backup
- Offline support with sync
- Live photo support

### API Access
- RESTful API with OpenAPI documentation
- WebSocket for real-time updates
- API key authentication
- Rate limiting per key

### External Storage
- External library support (read-only)
- Import from existing folder structure
- Preserve original file paths
- Watch for filesystem changes

## Common Issues and Troubleshooting

### Database Connection Issues
- Verify PostgreSQL extensions installed
- Check vector extension compatibility
- Ensure local storage for database
- Validate connection credentials

### Machine Learning Problems
- Model download failures
- Memory constraints for models
- GPU detection issues
- Timeout during inference

### Upload and Sync Issues
- File permission problems
- Storage space monitoring
- Network connectivity
- Mobile app background restrictions

### Performance Problems
- Enable hardware acceleration
- Tune PostgreSQL settings
- Adjust worker concurrency
- Monitor memory usage

## Migration and Upgrades

### Version Upgrades
- Review release notes for breaking changes
- Backup database before upgrading
- Update docker-compose.yml if needed
- Allow time for migrations

### Data Migration
- Import from Google Photos
- CLI tool for bulk uploads
- External library import
- Preserve metadata and timestamps

### Backup Procedures
- Database dumps to `/data/backups`
- Stop server during backup for consistency
- Include both database and files
- Test restore procedures

## Best Practices

### Initial Setup
- Change default database password
- Configure timezone correctly
- Set up reverse proxy with SSL
- Plan storage capacity

### Storage Management
- Use SSD for database storage
- Separate volumes for different data types
- Monitor disk usage regularly
- Implement backup rotation

### Performance Optimization
- Enable hardware acceleration if available
- Tune PostgreSQL for SSD storage
- Adjust ML model caching
- Configure appropriate concurrency

### Security Hardening
- Use strong passwords
- Enable HTTPS only
- Restrict database access
- Regular security updates

## Known Limitations

- No native Windows support (WSL2 recommended)
- Database must be PostgreSQL (no MySQL/MariaDB)
- ML features require significant memory
- Video transcoding can be resource-intensive
- Large libraries may require database tuning
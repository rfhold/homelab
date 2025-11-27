# Immich - Self-Hosted Photo and Video Management

Immich is a self-hosted photo and video management solution that provides a Google Photos-like experience while keeping data under your control. It's backed by FUTO and is one of the most actively developed self-hosted projects.

## Key Features

- Auto mobile backup from iOS and Android
- Face recognition with AI-powered detection and grouping
- Smart search using CLIP for natural language queries
- Timeline and album organization
- Partner and public sharing
- Map view with GPS metadata
- External library import
- Hardware transcoding support
- OAuth/OIDC authentication

## Architecture

### Core Components

- immich-server (TypeScript/NestJS, port 2283): REST API, background jobs, thumbnail generation, video transcoding
- immich-machine-learning (Python/FastAPI, port 3003): CLIP search, face detection/recognition
- PostgreSQL with VectorChord extension: Data storage and vector search
- Redis/Valkey: Job queue via BullMQ

### Communication Flow

- Clients connect via REST API
- Server communicates with ML service via HTTP
- Background jobs managed through Redis queues

## Requirements

### Hardware

Minimum specs:
- RAM: 4GB minimum, 6GB+ recommended
- CPU: 2 cores minimum, 4+ recommended
- Storage: Unix-compatible filesystem (EXT4, ZFS, BTRFS)

Important considerations:
- PostgreSQL database MUST be on local SSD, not network storage
- Database typically 1-3GB, requires at least 2GB RAM if using Docker limits

### Software

- Linux recommended (Ubuntu, Debian)
- Docker with Compose plugin (use `docker compose` not `docker-compose`)
- Windows/macOS via Docker Desktop has reduced support

## Installation - Docker Compose

```shell
mkdir ./immich-app && cd ./immich-app

wget -O docker-compose.yml https://github.com/immich-app/immich/releases/latest/download/docker-compose.yml
wget -O .env https://github.com/immich-app/immich/releases/latest/download/example.env

# Edit .env file, then start
docker compose up -d
```

Essential .env configuration:

```shell
UPLOAD_LOCATION=./library
DB_DATA_LOCATION=./postgres
DB_PASSWORD=change_this_password
IMMICH_VERSION=release
TZ=America/New_York
```

## Installation - Kubernetes Helm

```shell
helm install --create-namespace --namespace immich immich \
  oci://ghcr.io/immich-app/immich-charts/immich \
  -f values.yaml
```

Example values.yaml:

```yaml
image:
  tag: v1.123.0

immich:
  persistence:
    library:
      existingClaim: immich-library-pvc

env:
  DB_HOSTNAME: postgres-rw
  DB_USERNAME: immich
  DB_DATABASE_NAME: immich
  DB_PASSWORD:
    valueFrom:
      secretKeyRef:
        name: postgres-secret
        key: password

redis:
  enabled: true
```

Kubernetes requirements:
- PVC for library storage
- PostgreSQL with VectorChord extension (recommend CloudNative-PG with tensorchord/cloudnative-vectorchord image)
- Redis (can enable built-in or use external)

## Configuration

### Storage Layout

Default layout (Storage Template OFF):

```
UPLOAD_LOCATION/
├── upload/<userID>/          # Original uploads
├── profile/<userID>/         # User avatars
├── thumbs/<userID>/          # Thumbnails
├── encoded-video/<userID>/   # Transcoded videos
└── backups/                  # Database dumps
```

With Storage Template ON:

```
UPLOAD_LOCATION/
├── library/<userID>/         # All originals organized
├── profile/
├── thumbs/
├── encoded-video/
└── backups/
```

### External Libraries

Mount external folders read-only to import existing photos:

```yaml
immich-server:
  volumes:
    - ${UPLOAD_LOCATION}:/data
    - /mnt/photos:/mnt/media/photos:ro
    - /home/user/pictures:/mnt/media/pictures:ro
```

Configure import paths in Admin settings. Supports exclusion patterns like `**/*.tif` or `**/Raw/**`.

### Reverse Proxy

Requirements:
- Must serve on root path (no sub-path like /immich)
- Allow large uploads: client_max_body_size 50000M
- Increase timeouts for large uploads
- Forward headers: Host, X-Real-IP, X-Forwarded-Proto, X-Forwarded-For

Nginx example:

```nginx
server {
    server_name photos.example.com;
    
    client_max_body_size 50000M;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    
    location / {
        proxy_pass http://immich-server:2283;
    }
}
```

## Mobile Apps

Download sources:
- Android: Google Play Store, F-Droid, or GitHub APK releases
- iOS: App Store or TestFlight for beta

Auto-backup behavior:
- Foreground backup triggers when app opens
- Background backup requires disabling battery optimization (Android) or enabling Background App Refresh (iOS)
- Album sync creates matching albums on server
- One-way sync from device to server

## Feature Details

### Face Recognition

Uses InsightFace for detection and DBSCAN-derived algorithm for clustering.

Configuration in Admin settings:
- Minimum Detection Score: Filter false positives (0.5+)
- Maximum Recognition Distance: Similarity threshold (0.3-0.7)
- Minimum Recognized Faces: Core point threshold (default 3)

### Smart Search

Uses CLIP models for semantic search. Supports natural language queries like "dog on beach" or "birthday party".

Available filters: People, Location, Camera, Date range, File type, Media type, Condition (archived, favorited, etc.)

For non-English languages: Use nllb models for primary language or xlm/siglip2 for mixed language search.

### Sharing Options

Local sharing: Share albums with other users as editor (read-write) or viewer (read-only).

Public sharing: Generate links with optional expiration, password, and download permissions.

Partner sharing: Share entire library with designated partners. Includes all non-archived photos and metadata but not favorite status or face data.

## Backup and Restore

### Database Backup

Automatic dumps stored in UPLOAD_LOCATION/backups/ (default: 14 days retention, daily at 2 AM).

Manual backup:

```shell
docker exec -t immich_postgres pg_dumpall --clean --if-exists \
  --username=postgres | gzip > "/path/to/backup/dump.sql.gz"
```

Manual restore:

```shell
docker compose down -v
docker compose create
docker start immich_postgres
sleep 10
gunzip --stdout "/path/to/backup/dump.sql.gz" \
  | sed "s/SELECT pg_catalog.set_config('search_path', '', false);/SELECT pg_catalog.set_config('search_path', 'public, pg_catalog', true);/g" \
  | docker exec -i immich_postgres psql --dbname=postgres --username=postgres
docker compose up -d
```

### Media Backup

Critical folders:
- library/ or upload/ (original files)
- profile/ (user avatars)

Optional folders (can regenerate):
- thumbs/
- encoded-video/

### Migration from Google Photos

Use immich-go for Google Takeout import:

```shell
immich-go -server=http://immich-server:2283 \
  -key=YOUR_API_KEY \
  upload /path/to/takeout/
```

## Security

### OAuth/OIDC

Supported providers: Authentik, Authelia, Google, Okta, any OIDC provider.

Key settings:
- Issuer URL: OIDC discovery endpoint
- Client ID/Secret: From OAuth provider
- Scope: openid email profile
- Auto Register: Create users on first login
- Auto Launch: Skip login page

Mobile OAuth redirect: app.immich:///oauth-callback or https://your-domain/api/oauth/mobile-redirect

### API Keys

Generate from user settings for CLI and third-party integrations. Scoped to user permissions.

## Maintenance

### Updates

```shell
docker compose pull
docker compose up -d
```

Best practices:
- Read release notes before updating
- Backup database before major updates
- Pin version for stability: IMMICH_VERSION=v1.123.0

### Hardware Transcoding

Supported backends: NVENC (NVIDIA), Quick Sync (Intel), VAAPI (AMD/Intel/NVIDIA), RKMPP (Rockchip).

Setup steps:
1. Download hwaccel.transcoding.yml
2. Uncomment extends in docker-compose.yml
3. Configure device passthrough
4. Enable in Admin > Video Transcoding Settings

### Admin Jobs

Available in Admin > Jobs:
- Thumbnail Generation
- Video Transcoding
- Face Detection
- Smart Search indexing
- Storage Template Migration

## References

- Official docs: https://docs.immich.app/
- GitHub: https://github.com/immich-app/immich
- Helm charts: https://github.com/immich-app/immich-charts
- Migration tool: https://github.com/simulot/immich-go
- FOSS comparison: https://meichthys.github.io/foss_photo_libraries/

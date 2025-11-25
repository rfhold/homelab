# Lobe Chat Deployment

Lobe Chat is an open-source AI chat framework built on Next.js that supports 50+ LLM providers, multi-modal AI, knowledge base with RAG, and multi-user management.

## Deployment Modes

### Client-Side Mode

Simple deployment using browser IndexedDB storage only. No cross-device sync or file uploads.

```bash
docker run -d -p 3210:3210 \
  -e OPENAI_API_KEY=sk-xxxx \
  -e ACCESS_CODE=your-password \
  --name lobe-chat \
  lobehub/lobe-chat
```

### Server-Side Database Mode

Production deployment with PostgreSQL, S3 storage, and authentication. Supports cross-device sync, file uploads, and knowledge base.

Required components:
- PostgreSQL 16+ with pgvector extension
- S3-compatible storage (MinIO, AWS S3, CloudFlare R2)
- Authentication service (NextAuth with Casdoor, Auth0, GitHub, etc.)

### Docker Compose Full Stack

Recommended for self-hosting. Includes all services: LobeChat, PostgreSQL, MinIO, and Casdoor authentication.

## Quick Start with Docker Compose

```bash
mkdir lobe-chat-prod && cd lobe-chat-prod
bash <(curl -fsSL https://lobe.li/setup.sh) -l en
```

Choose deployment mode during setup:
- Local: http://localhost:3210 only
- Port: LAN access via IP address
- Domain: Production with SSL (https://lobe.example.com)

Services and default ports:
- LobeChat: 3210
- Casdoor Auth: 8000
- MinIO API: 9000
- MinIO Console: 9001
- PostgreSQL: 5432 (internal only)

## Production Configuration

### Environment Variables

Create .env file with the following configuration:

```bash
NEXT_PUBLIC_SERVICE_MODE=server
APP_URL=https://lobe.example.com

DATABASE_URL=postgresql://postgres:password@postgresql:5432/lobechat
KEY_VAULTS_SECRET=<generate-32-character-random-string>

NEXT_AUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXT_AUTH_SSO_PROVIDERS=casdoor
AUTH_CASDOOR_ISSUER=https://auth.example.com
AUTH_CASDOOR_ID=<client-id-from-casdoor>
AUTH_CASDOOR_SECRET=<client-secret-from-casdoor>

S3_ENDPOINT=https://minio.example.com
S3_ACCESS_KEY_ID=<minio-access-key>
S3_SECRET_ACCESS_KEY=<minio-secret-key>
S3_BUCKET=lobe
S3_PUBLIC_DOMAIN=https://minio.example.com
S3_ENABLE_PATH_STYLE=1
S3_SET_ACL=1

OPENAI_API_KEY=sk-xxxx
ANTHROPIC_API_KEY=sk-ant-xxxx
```

### LLM Provider Configuration

Configure supported providers using environment variables:

```bash
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL_LIST=-all,+gpt-4,+gpt-4-turbo

ANTHROPIC_API_KEY=sk-ant-xxxx

ENABLED_OLLAMA=1
OLLAMA_PROXY_URL=http://127.0.0.1:11434
```

Supported providers include OpenAI, Anthropic Claude, Google Gemini, AWS Bedrock, Azure OpenAI, Ollama, DeepSeek, Qwen, Mistral, Groq, and 40+ more.

## Storage Setup

### PostgreSQL with pgvector

PostgreSQL stores conversations, user data, file metadata, and vector embeddings for RAG.

```bash
docker run -p 5432:5432 -d --name pg \
  -e POSTGRES_PASSWORD=mysecretpassword \
  pgvector/pgvector:pg16
```

Vector operations are memory-intensive. Allocate 2-4GB RAM minimum.

### S3-Compatible Object Storage

S3 storage handles uploaded files including images, documents, audio, and video.

MinIO configuration example:

```yaml
minio:
  image: minio/minio:RELEASE.2024-04-22T22-12-26Z
  environment:
    - MINIO_ROOT_USER=admin
    - MINIO_ROOT_PASSWORD=password123
    - MINIO_API_CORS_ALLOW_ORIGIN=https://lobe.example.com
  command: server /data --address ":9000" --console-address ":9001"
```

CORS must allow requests from LobeChat domain. Files must be publicly readable for AI vision models.

## Authentication Setup

Supported authentication services:
- NextAuth (recommended for self-hosted)
- Clerk (recommended for cloud)
- Casdoor (default in Docker Compose)

Multi-provider configuration:

```bash
NEXT_AUTH_SSO_PROVIDERS=auth0,github,google
AUTH_GITHUB_ID=<github-oauth-id>
AUTH_GITHUB_SECRET=<github-oauth-secret>
```

## Production Deployment Steps

```bash
mkdir lobe-chat-prod && cd lobe-chat-prod

bash <(curl -fsSL https://lobe.li/setup.sh) -l en
```

Configure domains during setup:
- lobe.example.com (LobeChat)
- auth.example.com (Casdoor)
- minio.example.com (MinIO)
- Protocol: https

```bash
docker compose up -d

docker logs -f lobe-chat
```

Configure Casdoor:
- Login to https://auth.example.com with generated credentials
- Create organization and application
- Configure redirect URLs

Configure MinIO:
- Login to https://minio.example.com:9001
- Create access keys and update .env file
- Restart: docker compose up -d

## Reverse Proxy Configuration

Production deployment requires reverse proxy for SSL termination and domain routing.

Architecture:

```
Internet
    ↓
Reverse Proxy (Nginx/Traefik)
    ↓
├─ lobe.example.com → LobeChat:3210
├─ auth.example.com → Casdoor:8000
└─ minio.example.com → MinIO:9000
    ↓
├─ PostgreSQL:5432 (internal)
└─ MinIO Storage
```

Important reverse proxy requirements:
- Do not block .well-known path (required for OAuth2)
- Disable caching for auth endpoints
- Match protocol (http/https) in environment variables to reverse proxy configuration
- Enable SSL certificates via Let's Encrypt

## Resource Requirements

Minimum for production:

CPU: 4 cores total
- LobeChat: 1-2 cores
- PostgreSQL: 1-2 cores (vector operations are CPU-intensive)
- MinIO: 1 core

Memory: 6-8GB total
- LobeChat: 512MB-2GB
- PostgreSQL: 2-4GB (pgvector requires memory)
- MinIO: 1-2GB

Storage: 100GB+ (depends on file upload volume)

High CPU usage occurs during embedding generation and in PWA mode.

## Production Best Practices

### Security

- Always set ACCESS_CODE for client-mode deployments
- Use strong KEY_VAULTS_SECRET (32+ characters) to encrypt API keys
- Enable HTTPS in production (required for auth callbacks)
- Disable public registration in Casdoor
- Restrict S3 CORS to specific domains only

### Database

- Use separate database for production (not bundled container)
- Enable automated backups for PostgreSQL
- Monitor pgvector performance
- Use connection pooling (pgBouncer) for high traffic

### Storage

- Configure S3 lifecycle policies to manage costs
- Enable CDN for S3 public domain
- Set appropriate bucket policies (public-read for files)
- Monitor storage usage

### Scaling

- Horizontal scaling: Multiple LobeChat containers behind load balancer
- Database replication: PostgreSQL read replicas
- S3 redundancy: Multi-region replication
- Rate limiting: Implement API rate limits

## Kubernetes Deployment

Limited official documentation available. Community Helm chart exists on Artifact Hub.

Considerations:
- No official Helm chart from LobeHub
- Requires external PostgreSQL and S3 setup
- Use Docker images: lobehub/lobe-chat (client) or lobehub/lobe-chat-database (server)
- Implement HorizontalPodAutoscaler for scaling

## Known Issues

- NEXT_PUBLIC_* variables require build-time injection
- High CPU usage in PWA mode and during batch embedding operations
- Limited Kubernetes documentation
- S3 files must be publicly accessible for OpenAI vision models
- Authentication reverse proxy configuration can be complex
- pgvector operations are memory-intensive under load

## References

- Official Documentation: https://lobehub.com/docs
- GitHub Repository: https://github.com/lobehub/lobe-chat
- Docker Hub: https://hub.docker.com/r/lobehub/lobe-chat
- Self-Hosting Guide: https://lobehub.com/docs/self-hosting/start
- Docker Compose Guide: https://lobehub.com/docs/self-hosting/server-database/docker-compose

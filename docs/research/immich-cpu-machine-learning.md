# Immich CPU-Based Machine Learning

Self-hosting Immich with CPU-based machine learning workers.

## Architecture Overview

Immich uses a microservices architecture with these components:

- Backend Server (NestJS, port 2283): REST API, WebSockets, business logic
- ML Service (FastAPI Python, port 3003): AI/ML inference
- Database (PostgreSQL 14, port 5432): Relational data + vector storage
- Cache/Queue (Valkey/Redis, port 6379): Job queue and caching

The ML service is a separate Python FastAPI service that runs independently from the main server. It communicates exclusively via HTTP API calls, uses ONNX Runtime for model inference, and downloads models from Hugging Face hub with local caching.

ML features include Face Recognition, Smart Search (CLIP), Object Detection, and OCR.

## CPU Configuration

By default, Immich ML runs on CPU with no special configuration needed.

### Environment Variables

Core optimization variables:

- MACHINE_LEARNING_REQUEST_THREADS: Request thread pool size (default: CPU core count)
- MACHINE_LEARNING_MODEL_INTER_OP_THREADS: Parallel model operations (default: 1)
- MACHINE_LEARNING_MODEL_INTRA_OP_THREADS: Threads per model operation (default: 2)
- MACHINE_LEARNING_WORKERS: Number of worker processes (default: 1)
- MACHINE_LEARNING_MODEL_TTL: Seconds before unloading inactive models (default: 300, set to 0 to never unload)
- MACHINE_LEARNING_CACHE_FOLDER: Model download directory (default: /cache)

### Model Preloading

Eliminate first-request delay by preloading models:

- MACHINE_LEARNING_PRELOAD__CLIP__TEXTUAL: e.g., "ViT-B-16-SigLIP__webli"
- MACHINE_LEARNING_PRELOAD__CLIP__VISUAL: e.g., "ViT-B-16-SigLIP__webli"
- MACHINE_LEARNING_PRELOAD__FACIAL_RECOGNITION__RECOGNITION: e.g., "buffalo_l"
- MACHINE_LEARNING_PRELOAD__FACIAL_RECOGNITION__DETECTION: e.g., "buffalo_l"

## Model Selection for CPU

Lower MACs means faster performance on CPU.

### Available Models

- ViT-B-32__openai: 7.47B MACs, ~600MB RAM, quality 0.71. Good for low-power devices.
- ViT-B-16-SigLIP__webli: 17.5B MACs, ~700MB RAM, quality 0.77. Best for CPU efficiency.
- ViT-B-16-SigLIP2__webli: ~20B MACs, ~800MB RAM, quality 0.78. Newer, similar efficiency.
- ViT-L-14-quickgelu__dfn2b: ~90B MACs, ~1900MB RAM, quality 0.79. Good multilingual support.
- ViT-H-14-378-quickgelu__dfn5b: 542B MACs, ~4800MB RAM, quality 0.83. Impractical on CPU.

### Recommendation

Use ViT-B-16-SigLIP__webli for the best quality-to-performance ratio on CPU.

## Memory Requirements

- Full Immich stack minimum: 4GB RAM, recommended 6GB+
- ML Service per worker: +1-2GB minimum, +2-4GB recommended
- Model memory varies by model selection (600MB to 5GB)

## Multiple ML Workers

### Option 1: Multiple ML Containers with Load Balancer

Run multiple ML containers behind an external load balancer:

```yaml
services:
  immich-server:
    image: ghcr.io/immich-app/immich-server:${IMMICH_VERSION:-release}
    environment:
      IMMICH_MACHINE_LEARNING_URL: "http://ml-loadbalancer:3003"

  immich-ml-1:
    image: ghcr.io/immich-app/immich-machine-learning:${IMMICH_VERSION:-release}
    volumes:
      - model-cache:/cache
    environment:
      MACHINE_LEARNING_REQUEST_THREADS: "2"
      MACHINE_LEARNING_MODEL_INTRA_OP_THREADS: "2"
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G

  immich-ml-2:
    image: ghcr.io/immich-app/immich-machine-learning:${IMMICH_VERSION:-release}
    volumes:
      - model-cache:/cache
    environment:
      MACHINE_LEARNING_REQUEST_THREADS: "2"
      MACHINE_LEARNING_MODEL_INTRA_OP_THREADS: "2"
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

Multiple ML URLs configured in Immich admin are tried sequentially (failover), not load-balanced. Use an external load balancer (Traefik, nginx, etc.) for true distribution.

### Option 2: Multiple Worker Processes

Set MACHINE_LEARNING_WORKERS > 1 to run multiple worker processes in a single container. Each worker duplicates models in memory, so ensure sufficient RAM.

## Docker Compose Example

CPU-optimized configuration:

```yaml
name: immich

services:
  immich-server:
    container_name: immich_server
    image: ghcr.io/immich-app/immich-server:${IMMICH_VERSION:-release}
    volumes:
      - ${UPLOAD_LOCATION}:/usr/src/app/upload
      - /etc/localtime:/etc/localtime:ro
    env_file:
      - .env
    ports:
      - 2283:2283
    depends_on:
      - redis
      - database
    restart: always

  immich-machine-learning:
    container_name: immich_machine_learning
    image: ghcr.io/immich-app/immich-machine-learning:${IMMICH_VERSION:-release}
    volumes:
      - model-cache:/cache
    environment:
      MACHINE_LEARNING_REQUEST_THREADS: "4"
      MACHINE_LEARNING_MODEL_INTER_OP_THREADS: "1"
      MACHINE_LEARNING_MODEL_INTRA_OP_THREADS: "2"
      MACHINE_LEARNING_MODEL_TTL: "0"
      MACHINE_LEARNING_PRELOAD__CLIP__TEXTUAL: "ViT-B-16-SigLIP__webli"
      MACHINE_LEARNING_PRELOAD__CLIP__VISUAL: "ViT-B-16-SigLIP__webli"
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
    restart: always

  redis:
    container_name: immich_redis
    image: docker.io/valkey/valkey:8-alpine
    restart: always

  database:
    container_name: immich_postgres
    image: ghcr.io/immich-app/postgres:14-vectorchord0.4.3
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_DB: ${DB_DATABASE_NAME}
    volumes:
      - ${DB_DATA_LOCATION}:/var/lib/postgresql/data
    restart: always

volumes:
  model-cache:
```

## Kubernetes Helm Deployment

Install the chart:

```shell
helm install --create-namespace --namespace immich immich \
  oci://ghcr.io/immich-app/immich-charts/immich \
  -f values.yaml
```

Example values.yaml for CPU ML with multiple replicas:

```yaml
image:
  tag: v2.0.0

immich:
  persistence:
    library:
      existingClaim: immich-library-pvc

machine-learning:
  enabled: true
  controllers:
    main:
      replicas: 2
      containers:
        main:
          image:
            repository: ghcr.io/immich-app/immich-machine-learning
          env:
            MACHINE_LEARNING_REQUEST_THREADS: "2"
            MACHINE_LEARNING_MODEL_INTRA_OP_THREADS: "2"
            MACHINE_LEARNING_MODEL_TTL: "0"
          resources:
            requests:
              cpu: "1"
              memory: "2Gi"
            limits:
              cpu: "2"
              memory: "4Gi"
  persistence:
    cache:
      enabled: true
      size: 10Gi
      type: persistentVolumeClaim
      accessMode: ReadWriteMany

valkey:
  enabled: true

server:
  enabled: true
```

## Remote ML Setup

Run ML on a separate, more powerful machine.

### Remote Machine Configuration

```yaml
services:
  immich-machine-learning:
    image: ghcr.io/immich-app/immich-machine-learning:${IMMICH_VERSION:-release}
    volumes:
      - model-cache:/cache
    ports:
      - 3003:3003
    restart: always

volumes:
  model-cache:
```

Configure in Immich Admin under Machine Learning Settings. Add URL: http://<remote-ip>:3003

The ML service has no authentication. Use VPN or internal network only. Keep versions synchronized between ML and main server.

## Common Pitfalls

- Don't set MACHINE_LEARNING_WORKERS > 1 without sufficient RAM (each worker duplicates models)
- Don't use ViT-H models on CPU-only systems (impractical performance)
- Don't forget persistent volume for model cache (prevents re-download on restart)
- Don't expose ML service publicly (no authentication)
- Keep ML container version synchronized with main Immich server

## References

- Official docs: https://docs.immich.app/
- Environment variables: https://docs.immich.app/install/environment-variables/
- Remote ML guide: https://docs.immich.app/guides/remote-machine-learning/
- Scaling guide: https://docs.immich.app/guides/scaling-immich/
- Helm charts: https://github.com/immich-app/immich-charts
- CLIP model guide: https://github.com/immich-app/immich/discussions/11862

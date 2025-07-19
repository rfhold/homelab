# Bitnami PostgreSQL with DocumentDB Extensions

This Docker image combines the reliability of Bitnami PostgreSQL with AWS DocumentDB compatibility extensions.

## Current Versions
- **Bitnami PostgreSQL**: `17.5.0-debian-12-r12` (from git namespace)
- **DocumentDB**: `latest`

## Build Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `BITNAMI_POSTGRES_VERSION` | `17.5.0-debian-12-r12` | Bitnami PostgreSQL image version |
| `DOCUMENTDB_VERSION` | `latest` | AWS DocumentDB PostgreSQL image version |

## Usage

### Build the Image
```bash
docker build -t bitnami-postgres-documentdb:latest .
```

### Build with Custom Versions
```bash
docker build \
  --build-arg BITNAMI_POSTGRES_VERSION=17.5.0-debian-12-r12 \
  --build-arg DOCUMENTDB_VERSION=latest \
  -t bitnami-postgres-documentdb:custom .
```

### Run with Docker Compose
```bash
docker-compose up -d
```

### Run Standalone
```bash
docker run -d \
  --name postgres-documentdb \
  -e POSTGRESQL_ROOT_PASSWORD=rootpassword \
  -e POSTGRESQL_USERNAME=postgres \
  -e POSTGRESQL_PASSWORD=password \
  -e POSTGRESQL_DATABASE=testdb \
  -p 5432:5432 \
  bitnami-postgres-documentdb:latest
```

## Features

- **DocumentDB Extensions**: Includes all extensions from the official AWS DocumentDB PostgreSQL image
- **Bitnami Base**: Built on the reliable Bitnami PostgreSQL image with proper security and optimization
- **Configurable Versions**: Both base images can be customized via build arguments
- **Production Ready**: Maintains Bitnami's security practices and user permissions

## Extensions Included

The image includes all extensions from the AWS DocumentDB PostgreSQL image, providing compatibility with DocumentDB-specific features while running on standard PostgreSQL infrastructure.
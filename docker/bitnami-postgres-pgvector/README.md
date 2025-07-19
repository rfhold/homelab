# Bitnami PostgreSQL with pgvector Extension

This Docker image combines the reliability of Bitnami PostgreSQL with the pgvector extension for vector similarity search.

## Current Versions
- **Bitnami PostgreSQL**: `17.5.0-debian-12-r12` (from git namespace)
- **pgvector**: `0.8.0`

## Build Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `BITNAMI_POSTGRES_VERSION` | `17.5.0-debian-12-r12` | Bitnami PostgreSQL image version |
| `PGVECTOR_VERSION` | `0.8.0` | pgvector extension version |

## Usage

### Build the Image
```bash
docker build -t bitnami-postgres-pgvector:latest .
```

### Build with Custom Versions
```bash
docker build \
  --build-arg BITNAMI_POSTGRES_VERSION=17.5.0-debian-12-r12 \
  --build-arg PGVECTOR_VERSION=0.8.0 \
  -t bitnami-postgres-pgvector:custom .
```

### Run with Docker Compose
```bash
docker-compose up -d
```

### Run Standalone
```bash
docker run -d \
  --name postgres-pgvector \
  -e POSTGRESQL_ROOT_PASSWORD=rootpassword \
  -e POSTGRESQL_USERNAME=postgres \
  -e POSTGRESQL_PASSWORD=password \
  -e POSTGRESQL_DATABASE=testdb \
  -p 5432:5432 \
  bitnami-postgres-pgvector:latest
```

## Features

- **pgvector Extension**: Includes the pgvector extension for vector similarity search and embeddings
- **Bitnami Base**: Built on the reliable Bitnami PostgreSQL image with proper security and optimization
- **Configurable Versions**: Both base images can be customized via build arguments
- **Production Ready**: Maintains Bitnami's security practices and user permissions

## Using pgvector

After connecting to the database, enable the extension:

```sql
CREATE EXTENSION vector;
```

Then you can create tables with vector columns:

```sql
CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
```

For more information on using pgvector, see the [official pgvector documentation](https://github.com/pgvector/pgvector).
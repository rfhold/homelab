# Bitnami PostgreSQL With pgvector

This is an application database image, not a generic [CI helper image](../../docs/deployment/spec/ci-images.md). It copies the pgvector shared library, control file, and extension SQL from the pgvector PostgreSQL 17 image into a Bitnami PostgreSQL runtime.

Repository source describes how to build the image; it does not prove that a corresponding registry tag exists or has been tested.

## Build Inputs

| Argument | Dockerfile default | Use |
| --- | --- | --- |
| `BITNAMI_POSTGRES_VERSION` | `17.5.0-debian-12-r12` | `docker.io/bitnami/postgresql` tag |
| `PGVECTOR_VERSION` | `0.8.0` | `docker.io/pgvector/pgvector:${PGVECTOR_VERSION}-pg17` tag |

These are image tags, not immutable digests. A version-looking tag does not guarantee byte-for-byte reproducibility if an upstream tag is moved.

## Build

From the repository root:

```bash
docker build \
  --build-arg BITNAMI_POSTGRES_VERSION=17.5.0-debian-12-r12 \
  --build-arg PGVECTOR_VERSION=0.8.0 \
  --tag bitnami-postgres-pgvector:local \
  docker/bitnami-postgres-pgvector
```

## Local Check

The checked-in Compose file builds the image and creates a disposable local database and volume:

```bash
docker compose -f docker/bitnami-postgres-pgvector/docker-compose.yml up --build --detach
docker compose -f docker/bitnami-postgres-pgvector/docker-compose.yml exec postgres-pgvector \
  psql -U postgres -d testdb -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname = 'vector'; SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector AS distance;"
```

This creates the extension and exercises a vector-distance operator rather than checking container startup alone. The image otherwise inherits the Bitnami PostgreSQL entrypoint, port 5432, and `/bitnami/postgresql` data path.

Cleanup removes the local test volume and its database data:

```bash
docker compose -f docker/bitnami-postgres-pgvector/docker-compose.yml down --volumes
```

## Publication

[`build-bitnami-postgres-pgvector.yml`](../../.github/workflows/build-bitnami-postgres-pgvector.yml) is manual (`workflow_dispatch`). It builds `linux/amd64` and `linux/arm64`, passes both version inputs, and publishes:

```text
ghcr.io/<repository-owner>/bitnami-postgres-pgvector:<bitnami-postgres-version>
```

The tag contains only the Bitnami version, so dispatching different pgvector versions with the same Bitnami input can replace the same published tag.

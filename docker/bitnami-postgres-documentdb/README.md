# Bitnami PostgreSQL With DocumentDB OSS Artifacts

This is an application database image, not a generic [CI helper image](../../docs/deployment/spec/ci-images.md). It copies PostgreSQL extension libraries, control files, and SQL files from Microsoft DocumentDB OSS into a Bitnami PostgreSQL runtime.

Repository source describes how to build the image; it does not prove that a corresponding registry tag exists or has been tested.

## Build Inputs

| Argument | Dockerfile default | Use |
| --- | --- | --- |
| `BITNAMI_POSTGRES_VERSION` | `17.5.0-debian-12-r12` | `docker.io/bitnami/postgresql` tag |
| `DOCUMENTDB_VERSION` | `0.106.0` | Version in the architecture-specific `ghcr.io/microsoft/documentdb/documentdb-oss:PG17-${TARGETARCH}-${DOCUMENTDB_VERSION}` tag |
| `TARGETARCH` | Set by BuildKit | Selects the DocumentDB source image architecture |

These are image tags, not immutable digests. A version-looking tag does not guarantee byte-for-byte reproducibility if an upstream tag is moved.

## Build

From the repository root:

```bash
docker build \
  --build-arg BITNAMI_POSTGRES_VERSION=17.5.0-debian-12-r12 \
  --build-arg DOCUMENTDB_VERSION=0.106.0 \
  --tag bitnami-postgres-documentdb:local \
  docker/bitnami-postgres-documentdb
```

The Dockerfile copies available extension artifacts but does not automatically create database extensions.

The image inherits the Bitnami PostgreSQL entrypoint, listens on PostgreSQL port 5432, and stores database data under `/bitnami/postgresql` when that path is persisted.

## Local Check

The checked-in Compose file builds the image and creates a disposable local database and volume:

```bash
docker compose -f docker/bitnami-postgres-documentdb/docker-compose.yml up --build --detach
docker compose -f docker/bitnami-postgres-documentdb/docker-compose.yml exec postgres-documentdb \
  psql -U postgres -d testdb -c 'SELECT name, default_version FROM pg_available_extensions ORDER BY name;'
```

The query confirms that PostgreSQL can discover copied control files. Functional acceptance also requires creating the DocumentDB extensions documented for the selected source version and exercising their intended query surface against this disposable database. That service-dependent check was not run for this documentation change.

Cleanup removes the local test volume and its database data:

```bash
docker compose -f docker/bitnami-postgres-documentdb/docker-compose.yml down --volumes
```

## Publication

[`build-bitnami-postgres-documentdb.yml`](../../.github/workflows/build-bitnami-postgres-documentdb.yml) is manual (`workflow_dispatch`). It builds `linux/amd64` and `linux/arm64`, passes both version inputs, and publishes:

```text
ghcr.io/<repository-owner>/bitnami-postgres-documentdb:<bitnami-postgres-version>
```

The tag contains only the Bitnami version, so dispatching different DocumentDB versions with the same Bitnami input can replace the same published tag.

ARG BITNAMI_POSTGRES_VERSION=17.5.0-debian-12-r12
ARG DOCUMENTDB_VERSION=0.106.0
ARG TARGETARCH

FROM ghcr.io/microsoft/documentdb/documentdb-oss:PG17-${TARGETARCH}-${DOCUMENTDB_VERSION} AS documentdb-source

FROM docker.io/bitnami/postgresql:${BITNAMI_POSTGRES_VERSION}

COPY --from=documentdb-source /usr/lib/postgresql/*/lib/*.so /opt/bitnami/postgresql/lib/
COPY --from=documentdb-source /usr/share/postgresql/*/extension/*.control /opt/bitnami/postgresql/share/extension/
COPY --from=documentdb-source /usr/share/postgresql/*/extension/*.sql /opt/bitnami/postgresql/share/extension/


ARG BITNAMI_POSTGRES_VERSION=17.5.0-debian-12-r12
ARG PGVECTOR_VERSION=0.8.0

FROM pgvector/pgvector:${PGVECTOR_VERSION}-pg17 AS pgvector-source

FROM docker.io/bitnami/postgresql:${BITNAMI_POSTGRES_VERSION}

COPY --from=pgvector-source /usr/lib/postgresql/*/lib/*.so /opt/bitnami/postgresql/lib/
COPY --from=pgvector-source /usr/share/postgresql/*/extension/*.control /opt/bitnami/postgresql/share/extension/
COPY --from=pgvector-source /usr/share/postgresql/*/extension/*.sql /opt/bitnami/postgresql/share/extension/

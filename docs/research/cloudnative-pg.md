# CloudNativePG Migration Research Evidence

This is a non-authoritative research record. It does not establish the current database implementation, operator installation, cluster state, backups, or migration approval.

## Provenance

- The research recorded CloudNativePG `1.27.x` as current in October 2025 and cited versioned `1.27` documentation.
- Consulted sources: [CloudNativePG 1.27 documentation](https://cloudnative-pg.io/documentation/1.27/), [repository](https://github.com/cloudnative-pg/cloudnative-pg), [architecture](https://cloudnative-pg.io/documentation/1.27/architecture/), [backup guidance](https://cloudnative-pg.io/documentation/1.27/backup/), and [CNCF listing](https://www.cncf.io/sandbox-projects/).

## Evidence Retained

- CloudNativePG was evaluated for operator-managed PostgreSQL, failover, synchronous replication, declarative databases, pooling, snapshots, and Barman object-storage backups.
- At the time of research, the repository observation was that application databases used Bitnami PostgreSQL components and custom pgvector and DocumentDB images instead.
- A migration promised stronger Kubernetes-native lifecycle and availability behavior but required explicit backup, extension, storage, and cutover planning.

## Repository Relevance

The historical Bitnami observation and migration tradeoffs are retained as decision context, not current implementation proof. Generic CRDs and commands were removed.

## Disposition

Current image evidence is indexed by [deployment documentation](../deployment/README.md). Workload implementation and unresolved adoption state belong in [Kubernetes workloads](../kubernetes-workloads/README.md); no CloudNativePG migration is approved by this record.

# Grafana Loki Research Evidence

This is a non-authoritative research record. It does not establish the current Loki version, mode, object-store configuration, retention, deployment, or health.

## Provenance

- The research recorded chart `6.44.0` and application `3.5.7` as current in October 2025.
- Consulted sources: [Loki documentation](https://grafana.com/docs/loki/latest/), [chart source](https://github.com/grafana/helm-charts/tree/main/charts/loki), [deployment modes](https://grafana.com/docs/loki/latest/get-started/deployment-modes/), [storage guidance](https://grafana.com/docs/loki/latest/configure/storage/), [chart values](https://grafana.com/docs/loki/latest/setup/install/helm/reference/), and a [2024 S3 security notice](https://grafana.com/blog/2024/06/27/grafana-security-update-grafana-loki-and-unintended-data-write-attempts-to-amazon-s3-buckets/).

## Evidence Retained

- Simple Scalable mode was evaluated as a read, write, and backend split with S3-compatible object storage.
- The research preserved the security rationale for unique bucket names rather than upstream defaults.
- Retention, replication, caches, IAM, resource sizing, and migration remain design considerations, not accepted values.

## Repository Relevance

This evidence informed the Loki backend and Ceph object-storage evaluation. Copied chart values and installation steps were removed.

## Disposition

Current repository behavior is defined by [backend specifications](../observability/spec/backends.md) and described from source in [observability implementation](../observability/implementation.md).

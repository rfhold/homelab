# Observability

Specifications define intended behavior. The implementation summary describes tracked source, operations state mutation boundaries, and verification records separate source evidence from historical or live evidence.

| Document | Covers |
| --- | --- |
| [`implementation.md`](implementation.md) | Tracked Grafana, backend, telemetry, and alert implementation |
| [`spec/profiling.md`](spec/profiling.md) | Pyroscope storage, ingestion, and supported runtimes |
| [`spec/grafana.md`](spec/grafana.md) | Grafana runtime, Git Sync, PostgreSQL, and alerting HA |
| [`spec/alerting.md`](spec/alerting.md) | Managed rule ownership, export, and memory alerts |
| [`spec/backends.md`](spec/backends.md) | Mimir, Loki, Tempo, Kafka, object storage, and entry points |
| [`operations/profiling.md`](operations/profiling.md) | Application profiling adoption through Alloy |
| [`operations/alert-rules.md`](operations/alert-rules.md) | Guarded Grafana rule export and reconciliation |
| [`operations/tempo-migration.md`](operations/tempo-migration.md) | Forward-only Tempo 2 to Tempo 3 maintenance policy |
| [`verification.md`](verification.md) | Historical evidence, source drift, and live-state gaps |

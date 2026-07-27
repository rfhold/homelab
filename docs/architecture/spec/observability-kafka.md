# Observability Kafka

## Ownership

- The Grafana observability stack MUST own the Kafka cluster used by Mimir and Tempo backend ingest.
- The observability stack MUST create distinct topics for Mimir metrics and Tempo traces.
- Those topics MUST remain scoped to observability backend use; telemetry clients MUST NOT connect directly to Kafka.

## Availability

- The production default MUST use redundant brokers or equivalent availability settings rather than a single-node topology.
- Replica-related and storage sizing MUST be configurable without changing telemetry client configuration.
- Mimir and Tempo MUST depend on the cluster and their respective topics before their Kafka-backed paths reconcile.

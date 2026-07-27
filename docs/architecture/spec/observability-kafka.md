# Observability Kafka

## Ownership

- The Grafana observability stack MUST own the Kafka cluster used by Mimir and Tempo backend ingest.
- The observability stack MUST create distinct topics for Mimir metrics and Tempo traces.
- Those topics MUST remain scoped to observability backend use; telemetry clients MUST NOT connect directly to Kafka.

## Availability

- The production default MUST use redundant brokers or equivalent availability settings rather than a single-node topology.
- Replica-related and storage sizing MUST be configurable without changing telemetry client configuration.
- Mimir and Tempo MUST depend on the cluster and their respective topics before their Kafka-backed paths reconcile.

## Storage And Runtime

- Pantheon Kafka MUST store broker and KRaft metadata logs on the `database` Ceph RBD StorageClass.
- Each combined broker and controller MUST request `500m` CPU and `2Gi` memory, be limited to `2` CPU and `4Gi` memory, and use `1Gi` for both the initial and maximum JVM heap.
- Pantheon KRaft quorum failure detection MUST use a `10000ms` election timeout, `30000ms` fetch timeout, and `30000ms` broker session timeout so observed bounded storage stalls below ten seconds do not trigger repeated elections or broker fencing.
- `controller.quorum.request.timeout.ms` MUST remain operator-managed because Strimzi 0.48 forbids that Kafka configuration key.
- Changing an existing Kafka persistent volume from CephFS to RBD MUST use an explicitly approved migration or controlled recreation; source configuration MUST NOT imply that a StorageClass changes in place.

## Metrics

- Broker and KRaft metrics MUST be exposed through Strimzi's JMX Prometheus Exporter with a curated rule set that includes controller-quorum signals.
- Kafka Exporter MUST expose topic and consumer-group metrics.
- Topic Operator, User Operator, and Cluster Operator metrics MUST be discoverable through the repository's annotation-based collection path.
- Each endpoint MUST be discovered once. Kafka bootstrap and broker Services MUST NOT duplicate broker pod metrics.

# Observability Backends

## Maintained Charts

The platform MUST use maintained OSS chart sources compatible with the selected backend architectures.

- Grafana MUST use chart `12.8.0` with Grafana `13.1.1`.
- Tempo MUST use Grafana Community `tempo-distributed` chart `3.0.6` with Tempo `3.0.2`.
- Mimir MUST use the selected maintained distributed chart release rather than an older patch when a newer stable patch has been selected.
- Loki MUST use the current OSS-maintained chart source, not a source maintained only for Grafana Enterprise Logs.

## Shared Kafka

The Grafana observability stack MUST own one Strimzi-managed Kafka cluster for backend ingest. It MUST provide distinct `mimir-ingest` and `tempo-traces` topics and MUST NOT expose Kafka as an application telemetry endpoint.

Mimir, Tempo, and Loki MUST continue using Pantheon object storage for durable telemetry. Kafka retention MUST NOT replace object-storage durability.

Pantheon Kafka MUST use the `database` Ceph RBD StorageClass with the resource, JVM, availability, and metrics controls defined by the [observability Kafka contract](../../architecture/spec/observability-kafka.md). A CephFS-to-RBD cutover MUST preserve the existing internal bootstrap and topic names but MAY accept a bounded ingestion outage and loss of buffered telemetry under an explicitly approved maintenance operation.

## Mimir

Mimir MUST enable ingest storage against the shared Kafka cluster. Existing clients MUST continue remote-writing through Alloy and MUST NOT connect directly to Mimir internals or Kafka.

Mimir MUST expose its Prometheus-compatible read API at `https://prometheus.holdenitdown.net/prometheus` for infrastructure dashboards that cannot reach Pantheon cluster-local services. The route MUST accept only `GET` requests and MUST use the Mimir gateway so query, rule, and alert APIs remain available. Consumers of this shared endpoint MUST distinguish cluster data by the `cluster` or `k8s_cluster_name` label.

## Tempo

Tempo 3 MUST use its Kafka-backed distributed write path:

- distributors write to `tempo-traces`;
- block-builder and live-store consume that topic with exactly three replicas each;
- `tempo-traces` has three partitions and three replicas, and automatic topic creation is disabled;
- ingesters and the old compactor are disabled while backend scheduler and backend worker are enabled;
- block-builder persists to the Pantheon object-storage bucket with 168-hour retention; and
- metrics generation remote-writes service graphs and span metrics to Mimir without the removed `local-blocks` processor.

Alloy OTLP ingestion and Grafana query-frontend access MUST remain stable. Applications MUST NOT address Tempo or Kafka internals.

The Tempo 2 to Tempo 3 cutover requires an explicitly approved maintenance outage. Once Tempo 3 starts, recovery MUST fix Tempo 3 forward rather than attempt an unsupported in-place downgrade. Operators MUST accept possible trace loss during the maintenance window.

## Loki

Loki MUST remain in distributed microservices mode with TSDB object storage. Its ingestion, indexing, and storage MUST NOT depend on Kafka, and client log ingestion MUST remain available through Alloy.

## Stable Entry Points

Modernizing backend internals MUST preserve the configured public Grafana hostname and Grafana datasources. The shared Alloy gateway MUST continue accepting metrics, logs, traces, and profiles.

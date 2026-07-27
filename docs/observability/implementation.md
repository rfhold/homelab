# Tracked Observability Implementation

This document describes repository source. It does not prove that the Pantheon stack is deployed, healthy, or drift-free.

## Chart Sources

[`src/helm-charts.ts`](../../src/helm-charts.ts) currently selects these chart artifacts:

| Component | Chart | Version | Repository |
| --- | --- | --- | --- |
| Grafana | `grafana` | `12.8.0` | Grafana Community |
| Mimir | `mimir-distributed` | `6.0.6` | Grafana |
| Loki | `loki` | `6.55.0` | Grafana Community |
| Tempo | `tempo-distributed` | `3.0.6` | Grafana Community |
| Alloy | `alloy` | `1.6.0` | Grafana |
| Pyroscope | `pyroscope` | `2.0.2` | Grafana |

Chart pins do not independently prove the running application versions.

## Grafana

- [`programs/grafana/Pulumi.pantheon.yaml`](../../programs/grafana/Pulumi.pantheon.yaml) configures two Grafana replicas and a three-instance Grafana database with `50Gi` per instance.
- [`src/modules/grafana-stack.ts`](../../src/modules/grafana-stack.ts) creates the database through CloudNativePG, makes Grafana depend on it, and provisions Mimir, Loki, Tempo, and Pyroscope datasources through Grafana proxy access.
- [`src/components/grafana.ts`](../../src/components/grafana.ts) disables pod-local persistence by default, reads PostgreSQL credentials from the CloudNativePG application Secret, configures a headless service, and enables unified-alerting peer coordination.
- [`programs/grafana/index.ts`](../../programs/grafana/index.ts) creates a write-enabled Git Sync repository for `grafana/` using a secret Pulumi Stash output and orders that resource after Grafana.

## Backends And Telemetry

- The Grafana stack creates one Strimzi cluster with distinct `mimir-ingest` and `tempo-traces` topics. Tempo is ordered after its object-storage bucket, Kafka cluster, topic, and Mimir dependency.
- Pantheon config selects the `database` RBD StorageClass and a distinct `database` combined broker/controller node pool with three `100Gi` claims. Each pod requests `500m` CPU and `2Gi` memory, is limited to `2` CPU and `4Gi` memory, and uses `1024M` for both JVM heap bounds.
- Pantheon config sets the KRaft controller election timeout to `10000ms`, fetch timeout to `30000ms`, and broker session timeout to `30000ms`, replacing defaults that were shorter than observed controller write stalls. Strimzi 0.48 forbids configuring `controller.quorum.request.timeout.ms`, so its operator-managed `2000ms` default remains in effect.
- These timeout values tolerate bounded Ceph latency; they do not resolve the underlying BlueStore slow-operation condition.
- The Kafka component enables Strimzi JMX Prometheus Exporter with the Strimzi 0.48 rule set, including KRaft metrics, and enables Kafka Exporter for topic and consumer-group metrics.
- Existing annotation discovery scrapes broker JMX and Kafka Exporter pods. Dedicated Services expose Topic Operator and User Operator metrics without annotating the multi-container Entity Operator pod, and the Strimzi chart annotates the Cluster Operator pod. Kafka bootstrap and broker Services remain unannotated to avoid duplicate broker series.
- Mimir enables external Kafka ingest storage while retaining object storage and its client-facing remote-write path.
- Loki uses distributed mode with TSDB and S3-compatible object storage and has no Kafka dependency.
- Tempo source configures Kafka ingest, three block-builders, three live-stores, backend scheduler and worker components, 168-hour block retention, and object storage.
- Pyroscope source enables v2 storage, disables v1 storage, uses object storage, and exposes separate internal read and write services.
- Alloy source accepts OTLP, Loki push, Prometheus remote write, Faro, and profiling traffic. Profiling listens on port 4040 and forwards to the Pyroscope write service.

## Alert Rules

[`grafana/alert-rules/`](../../grafana/alert-rules/) contains Grafana-native managed resources. The tracked memory rules include a Pantheon Ceph OSD warning above 12 GiB for 10 minutes, node memory above 85 percent for 10 minutes, swap above 50 percent for 10 minutes, and any OOM-kill increase over five minutes.

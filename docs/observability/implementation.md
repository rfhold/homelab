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
- [`src/components/grafana.ts`](../../src/components/grafana.ts) disables pod-local persistence by default, passes explicitly selected plugins to the Helm chart, renders explicitly disabled plugins into Grafana configuration, reads PostgreSQL credentials from the CloudNativePG application Secret, configures a headless service, enables unified-alerting peer coordination, and enables the Kubernetes alerting-rule API required by the content provider resources.
- [`programs/grafana/index.ts`](../../programs/grafana/index.ts) synchronously pins the Explore Traces, Loki Explore, Metrics Drilldown, and Pyroscope app plugins. It disables the other default recommendations for Grafana 13.1.1 and the selected feature set: Elasticsearch, Zipkin, and Grafana Advisor. A Grafana version or feature-toggle change requires reviewing that default recommendation set. The program also exports the ingress API URL and administrator credentials consumed through stack references by the three content programs.
- [`programs/grafana-dashboards/`](../../programs/grafana-dashboards/) owns raw dashboard JSON and the stable shared domain folders. Its provider retains normalized dashboard JSON rather than SHA-only state so content changes update in place, and dashboard resources use delete-before-replace as a fallback for stable UID safety. [`programs/grafana-alerts/`](../../programs/grafana-alerts/) and [`programs/grafana-recording-rules/`](../../programs/grafana-recording-rules/) own direct provider-input JSON and reference those folder UIDs.
- The dashboard program includes CloudNativePG, Valkey, and Kafka folders. Their dashboards use the stable `mimir` datasource and selectors for infrastructure cluster, namespace, and workload identity where those labels are available. Kafka content is split into broker, KRaft, topic and consumer, and operator views for the deployed Strimzi topology.
- Apply the runtime stack first, then dashboards, then alerts and recording rules in either order. Source contains no automatic content apply mechanism.

## Backends And Telemetry

- The Grafana stack creates one Strimzi cluster with distinct `mimir-ingest` and `tempo-traces` topics. Tempo is ordered after its object-storage bucket, Kafka cluster, topic, and Mimir dependency.
- Pantheon config selects the `database` RBD StorageClass and a distinct `database` combined broker/controller node pool with three `100Gi` claims. Each pod requests `500m` CPU and `2Gi` memory, is limited to `2` CPU and `4Gi` memory, and uses `1024M` for both JVM heap bounds.
- Pantheon config sets the KRaft controller election timeout to `10000ms`, fetch timeout to `30000ms`, and broker session timeout to `30000ms`, replacing defaults that were shorter than observed controller write stalls. Strimzi 0.48 forbids configuring `controller.quorum.request.timeout.ms`, so its operator-managed `2000ms` default remains in effect.
- These timeout values tolerate bounded Ceph latency; they do not resolve the underlying BlueStore slow-operation condition.
- The Kafka component enables Strimzi JMX Prometheus Exporter with the Strimzi 0.48 rule set, including KRaft metrics, and enables Kafka Exporter for topic and consumer-group metrics.
- Existing annotation discovery scrapes broker JMX and Kafka Exporter pods. Dedicated Services expose Topic Operator and User Operator metrics without annotating the multi-container Entity Operator pod, and the Strimzi chart annotates the Cluster Operator pod. Kafka bootstrap and broker Services remain unannotated to avoid duplicate broker series.
- Every source-managed CloudNativePG `Cluster` enables its operator-managed PodMonitor. The monitoring stacks discover those PodMonitors cluster-wide; database pods do not add a second annotation-based scrape path.
- [`src/components/k8s-monitoring.ts`](../../src/components/k8s-monitoring.ts) keeps the node-exporter integration allowlist enabled and extends it with the `node_hwmon_chip_names`, `node_hwmon_sensor_label`, and `node_hwmon_temp_celsius` metric families.
- Every native Valkey pod includes Redis Exporter `v1.88.0` as a non-root sidecar. It authenticates to the localhost Valkey process with the existing password Secret and exposes port 9121 under the stable `valkey` annotation-discovery job. Discovery selects only the `redis-exporter` container; the Valkey Services remain protocol-only and unannotated, avoiding duplicate metric series.
- Mimir enables external Kafka ingest storage while retaining object storage and its client-facing remote-write path. Its query frontend disables parallel sharding of shardable queries to bound StoreGateway fanout from managed-rule evaluations. Pantheon StoreGateways request 4 GiB of memory, which the chart also uses for their Go memory limit to increase garbage-collection headroom.
- Loki uses distributed mode with TSDB and S3-compatible object storage and has no Kafka dependency.
- Tempo source configures Kafka ingest, three block-builders, three live-stores, backend scheduler and worker components, 168-hour block retention, and object storage.
- Pyroscope source enables v2 storage, disables v1 storage, uses object storage, and exposes separate internal read and write services.
- Alloy source accepts OTLP, Loki push, Prometheus remote write, Faro, and profiling traffic. Profiling listens on port 4040 and forwards to the Pyroscope write service.
- The NVIDIA DCGM exporter annotates each DaemonSet pod for 15-second collection under the `dcgm-exporter` job. Its Service is not a scrape target, so per-node GPU series do not pass through Service load balancing.
- Host Alloy scrapes loopback-only K3s Scheduler and Controller Manager endpoints on server nodes and Proxy on every managed node. The K3s systemd templates use normal service shutdown and do not invoke `k3s-killall.sh` as a stop hook.

## Alert Rules

The alert and recording-rule programs contain Grafana provider inputs with stable rule and folder UIDs. External Mimir range expressions use a 60-second query interval. Baseline recording rules evaluate every three minutes, while 1d and 3d API burn rates evaluate every 10 minutes to bound scheduler and query-backend load without exceeding their consumers' query windows. Rules for Mimir continuous test, block builder, KEDA autoscaling, and ruler remote evaluation are omitted because those optional features are not configured in the tracked deployment.

The tracked memory rules include a Pantheon Ceph OSD warning above 12 GiB for 10 minutes, node memory above 85 percent for 10 minutes, swap above 50 percent with active paging over the 15-minute evaluation window for 10 minutes, and any OOM-kill increase over five minutes. These four alerts retain one-minute evaluation intervals.

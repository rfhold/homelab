# Observability Verification

Source inspection establishes tracked implementation only. Authorized previews, applies, recovery operations, and read-only checks from 2026-07-27 through 2026-08-01 established the dated observations below.

## 2026-07-31 Database, Cache, And Kafka Pre-Change Evidence

- Authorized read-only checks found source-managed CloudNativePG clusters `authentik/authentik-postgres`, `forgejo/forgejo-postgres`, and `sourcebot/sourcebot-db` on Romulus and `grafana/grafana-stack-grafana-postgres` and `immich/immich-postgres` on Pantheon. Every cluster had `spec.monitoring.enablePodMonitor=false`; only the operator PodMonitor existed. The additional live `kuri-preview/kuri-postgres` cluster is not source-managed by this repository and is outside this change's scope.
- Authorized read-only checks found source-managed native Valkey StatefulSets `forgejo/forgejo-valkey`, `searxng/searxng-cache`, and `sourcebot/sourcebot-redis` on Romulus and `firecrawl/firecrawl-redis` and `immich/immich-redis` on Pantheon. Each ready pod had only the Valkey container and no exporter or monitor.
- Pantheon's `grafana/observability-kafka` cluster was ready with three combined KRaft broker/controllers. Topics `mimir-ingest` and `tempo-traces` were ready with their tracked partition and replication settings.
- Mimir returned healthy targets for `strimzi-cluster-operator`, `strimzi-kafka`, `strimzi-kafka-exporter`, `strimzi-topic-operator`, and `strimzi-user-operator`. Broker, KRaft, topic, consumer-group, reconciliation, resource, certificate, JVM, and process metric families were present under `cluster=pantheon`.
- These observations establish the pre-change telemetry boundary and Kafka query compatibility only. They do not prove that the new CloudNativePG or Valkey telemetry, dashboard resources, or rendered panels have been deployed or verified.

## 2026-08-01 Database, Cache, And Kafka Rollout Evidence

- Broad workload-stack previews exposed unrelated application drift and mixed historical Kubernetes provider versions, so no broad workload apply ran. Exact Pulumi targets updated `searxng-cache` and `grafana-stack-grafana-postgres`; the remaining approved telemetry fields were patched directly after source and live scope were matched. Firecrawl was not mutated because it is being decommissioned and was explicitly removed from rollout scope.
- All five in-scope CloudNativePG clusters were ready with generated PodMonitors. Mimir returned exactly seven healthy `cnpg_collector_up` instance series across Romulus and Pantheon; the ingested infrastructure identity is `k8s_cluster_name`, while workload identity is derived from pod names because collection normalizes the native `cluster` label.
- The four in-scope Valkey StatefulSets completed rollout with both containers ready. Initial pod annotation discovery produced one scrape per container; adding `k8s.grafana.com/metrics.container=redis-exporter` reduced this to exactly four healthy `redis_up{job="valkey"}` series, one per pod and all from the exporter container.
- The authorized `grafana-dashboards.pantheon` preview created only three folders and six dashboards, with 92 resources unchanged. The apply created those nine resources. A later selector repair previewed and applied only four dashboard content updates, with 97 resources unchanged.
- Live Mimir inspection showed three healthy Kafka broker targets and one healthy target for Kafka Exporter and each Strimzi operator job. It also established that broker and KRaft workload identity is carried by `pod`, Kafka Exporter identity by `container`, and CloudNativePG identity by `pod`; the managed dashboards were aligned to those observed contracts.
- Final evaluation of all dashboard expressions returned live series for all 69 queries: 16 CloudNativePG, 14 Valkey, 11 Kafka broker, 10 KRaft, 9 Kafka Exporter, and 8 Strimzi operator queries. Grafana returned all six dashboards in their intended folders and rendered a representative panel from each as `image/png` using explicit workload variables.

## 2026-08-01 Grafana Rule Load Pre-Change Evidence

- Pantheon Mimir namespace CPU increased from approximately one core 72 hours earlier to 11-14 cores. The three zonal StoreGateway pods each consumed approximately 4.2 cores and dominated current cluster CPU growth; the recently added Redis Exporter sidecars consumed only 2-4 millicores and 7-8 MiB each.
- Grafana scheduler logs identified 217 alert rules and 207 recording rules issuing the Mimir requests. All alerts and 191 recording rules evaluated every minute; alert range queries requested ten minutes at one-second resolution. Query-frontend logs showed 16-way sharding, up to 80 subqueries for compound expressions, HTTP 429 responses, retries, dropped evaluations, and one observed query processing approximately 495,000 samples.
- Request metadata identified `grafana_scheduler` and exact managed rule UIDs, and observed expressions mapped to the tracked rule JSON. This attributes the load to managed rule evaluation rather than open dashboards, dashboard rendering, or the database/cache/Kafka telemetry rollout.
- The CPU ramp began after the 2026-07-29 Grafana content rollout: approximately 1.1 cores 70 hours before inspection, 5.75 cores 60 hours before inspection, 8.96 cores 48 hours before inspection, and 11.4 cores 36-30 hours before inspection. This is point-in-time operational evidence and does not establish future behavior.

## 2026-08-01 Grafana Rule Load First-Stage Evidence

- Authorized alert and recording-rule previews matched the intended rule-only scope. Applies reduced the managed inventory to 206 alerts and 207 recording rules, changed retained alert range-query resolution from one second to 60 seconds, changed every recording-rule cadence to three minutes, and removed 11 alerts for absent optional Mimir features. Final previews reported 208 alert-stack and 209 recording-stack resources unchanged.
- Query-frontend logs confirmed that alert range requests used the new 60-second step. Despite that change, the first post-rollout window still showed approximately 13 Mimir namespace CPU cores, StoreGateway pods at approximately 4.1-4.7 cores each, and continuing Grafana scheduler 429 responses, timeouts, retries, and dropped ticks.
- Retained alert and recording queries were still expanded into 16-48 internal shards, with observed queue time reaching approximately 43 seconds. The live ConfigMap and selected chart defaults both enabled `frontend.parallelize_shardable_queries` and allowed query parallelism of 240. This evidence identifies Mimir query sharding as the remaining read-path amplification mechanism; it does not establish that disabling sharding has been deployed or has reduced load.

## 2026-08-01 Mimir Query-Sharding Recovery Evidence

- The authorized `grafana.pantheon` preview contained only the shared Mimir ConfigMap replacement and 14 Mimir workload checksum updates, with 253 unrelated resources unchanged. The apply completed with that scope, and the final preview reported all 268 resources unchanged.
- The live Mimir ConfigMap rendered `frontend.parallelize_shardable_queries: false`. All 20 Mimir pods were Ready with zero restarts after the rollout. The Grafana ruler API returned all 413 managed rules with zero `lastError` and zero unhealthy rules, and Mimir returned 241 current `up` series.
- Mimir namespace CPU declined from the 12-13 core first-stage level to approximately 0.51 cores. StoreGateway CPU declined from approximately 4.1-4.7 cores each to 4-25 millicores each.
- In the latest bounded five-minute window, query-frontend logs contained 2,801 Grafana requests but no `__query_shard__` labels and no 429 responses. Grafana logs contained no scheduler 429s, timeouts, dropped ticks, or rule errors; StoreGateway logs contained no canceled Series calls.
- These observations establish immediate post-rollout recovery. Longer-term behavior remains subject to normal monitoring and does not make the point-in-time CPU values a capacity guarantee.

## 2026-07-27 Pre-Migration Evidence

- Grafana ran two ready replicas using application image `13.1.1`; its three PostgreSQL pods were ready.
- Mimir `3.0.4` and Tempo `3.0.2` workloads were ready with the expected Tempo 3 backend scheduler, backend worker, block-builder, and live-store architecture.
- Strimzi `0.48.0` managed Kafka `4.1.0` in KRaft mode. Three combined broker/controllers were ready with zero restarts, and `mimir-ingest` and `tempo-traces` were ready with replication factor 3, all replicas in sync, and `min.insync.replicas=2`.
- Direct Mimir and Tempo query-frontend probes returned fresh metrics and a recent trace, confirming point-in-time query paths and recent telemetry availability.
- The brokers still used `shared-fs`, were `BestEffort`, and had only `-Xms128M`; the tracked RBD, resource, heap, and metrics changes were not live.
- Repeated KRaft controller events took 2.2-7.3 seconds while the quorum timeout was two seconds. Elections, no-leader periods, and `NotControllerException` errors caused brief Mimir and Tempo Kafka write failures. Instantaneous quorum checks later showed no follower lag, but controller epochs continued advancing and did not prove stability.

## 2026-07-27 RBD Cutover Evidence

- Authorized storage, Strimzi, and Grafana previews and applies created the `database` RBD pool and StorageClass, annotated the Cluster Operator, and replaced only `KafkaNodePool/grafana/observability-kafka-pool` with `KafkaNodePool/grafana/database`.
- The replacement preserved the Kafka cluster ID, Kafka and KafkaTopic identities, bootstrap endpoint, and all three old CephFS claims. Three new `100Gi` RBD claims were bound using `database`; each combined broker/controller had the tracked resources and `1024M` heap.
- RBD alone did not eliminate controller stalls. Strimzi rejected `controller.quorum.request.timeout.ms` as operator-managed, so the final applied mitigation uses election timeout `10000ms`, fetch timeout `30000ms`, and broker session timeout `30000ms` while leaving request timeout at the Strimzi-managed `2000ms` value.
- Destructive topic recreation left long-running Mimir and Tempo clients with stale topic IDs. Authorized ordered restarts of the Tempo distributors, Mimir ingesters, Tempo live-stores, block-builders, and metrics generator restored production and consumption.
- From the final recovery boundary at `18:03:44Z` through `18:27:26Z`, the quorum remained on leader 2 at epoch 89 with all three voters, zero follower lag, and no election, timeout, no-leader, `NotControllerException`, slow-controller warning, or backend ingestion error in bounded logs. This approximately 24-minute window was accepted for close-out instead of the planned 30 minutes.
- Topic offsets continued advancing, Mimir `count(up)` returned 146, and Tempo returned five recent traces. Mimir contained all five intended jobs: `strimzi-cluster-operator`, `strimzi-kafka`, `strimzi-kafka-exporter`, `strimzi-topic-operator`, and `strimzi-user-operator`.
- Ceph still reported `HEALTH_WARN` for BlueStore slow-operation indications on OSD 0 and OSD 2. The timeout changes mitigate bounded stalls; they do not resolve that storage condition.

## 2026-07-27 Grafana Content Cutover Evidence

- Authorized preview and apply of `grafana.pantheon` removed the Git Sync repository and token Stash, enabled `kubernetesAlertingRules`, exported the ingress API URL, and completed the Grafana rollout.
- Git Sync teardown removed the legacy dashboards, alerts, and recording rules. A bounded inventory, dry run, and deletion removed only the nine remaining `alert-rules-*` folders.
- Authorized applies created 12 shared domain folders, 90 dashboards, 217 alert rules, and 210 recording rules in the three new content stacks.
- Initial live evaluation exposed native-format differences that source-only provider typing did not catch. Alert `noDataState` was normalized from `OK` to `Ok`; all 644 expression payloads were normalized to `datasource_uid`, `relative_time_range`, and `query_type`. Reapplies updated all 427 rules.
- Final previews were no-op: 104 dashboard-stack resources, 219 alert-stack resources, and 212 recording-stack resources were unchanged. The Grafana ruler API returned 427 rules and no `lastError` after a full evaluation interval.
- The out-of-band dashboard `agent-gateway-traffic`, observed immediately after Git Sync removal, disappeared during subsequent cleanup. It was not present in repository history, another Pulumi stack, or recoverable Grafana database rows, so it was not recreated as managed source.

## 2026-07-28 Dashboard Lifecycle Recovery Evidence

- An authorized content apply replaced 11 dashboards after their default ranges changed. SHA-only dashboard state made those content changes appear as replacements; create-before-delete combined with stable UIDs and overwrite behavior deleted the dashboards during replacement cleanup.
- Live API inspection found 79 dashboards while Pulumi still tracked all 90. A program-aware refresh preview identified exactly the 11 absent dashboard resources as stale state, plus the provider state change that disabled SHA-only dashboard storage.
- The authorized refresh removed those 11 stale records with 103 resources unchanged. The following update preview contained exactly 11 creates and 93 unchanged resources, with no updates, replacements, or deletes.
- The authorized recovery apply recreated all 11 dashboards. Live API verification returned 90 dashboards, and each recovered node and Velero dashboard used `now-24h` through `now` in its intended folder.
- A temporary source-only range change previewed as one in-place `configJson` update with 103 resources unchanged and no replacement. The temporary value was not applied; restoring source produced a final preview with all 104 resources unchanged.

## 2026-07-28 Inapplicable Dashboard Removal Evidence

- Source and read-only live inspection identified 12 dashboards for features absent from the shared observability environment: five Windows-only Kubernetes dashboards, four Loki bloom, deletion, and ruler-WAL dashboards, and three Mimir remote-ruler read dashboards. Pantheon nodes were all Linux; the corresponding Loki and Mimir workloads and metrics were absent.
- Faro remained because frontend instrumentation is planned. Cloudflared and MKTXP dashboards remained because live Pantheon Mimir queries returned telemetry exported by Romulus. Mimir rollout dashboards remained because its rollout operator was deployed; missing rollout metrics were classified for dashboard repair rather than removal.
- Source validation parsed 78 remaining dashboards, 217 alert rules, and 210 recording rules. All folder references resolved, no duplicate UIDs were present, and the Kubernetes, Loki, and Mimir folders remained unchanged for their alert and recording-rule consumers.
- The authorized `grafana-dashboards.pantheon` preview reported exactly 12 dashboard deletions and 92 unchanged resources, with no folder changes, creates, updates, or replacements. The authorized apply completed with that same scope.
- Live Grafana API verification returned 78 dashboards, none of the 12 removed UIDs, and all explicitly retained Faro, cloudflared, MKTXP, and Mimir rollout UIDs. The final `--expect-no-changes` preview reported 92 unchanged resources.

## 2026-07-29 Dashboard And DCGM Repair Evidence

- Authorized applies reconciled the annotated telemetry producers and collectors, backup safeguards, Mimir capacity controls, central Alloy replay bounds, 23 repaired dashboards, and three obsolete Scheduler recording-rule deletions. Host-local K3s and Alloy changes were initially deferred and completed later under exact-host approval.
- Live metric inspection replaced the Faro Receiver dashboard's obsolete `app_agent_receiver_*` expectations with confirmed Alloy `faro_receiver_*` metrics. All 17 retained Kubernetes dashboards now default their Prometheus datasource variable to `Mimir`/`mimir`.
- The Kubernetes Compute Resources Cluster dashboard timed out when its heavy 22-panel default selected all clusters. Saving `pantheon` as its default while retaining Romulus and All as selectable values produced a successful no-override render.
- Initial NVIDIA inspection found one healthy annotated Service target with 20 scrapes over five minutes, but Service load balancing split those scrapes irregularly between Athena and Mars. The authorized monitoring update moved annotations to the two DCGM DaemonSet pods and aligned exporter collection with the 15-second scrape interval.
- After the DCGM rollout, both pods were ready with no restarts, Mimir returned two healthy pod-IP targets, and each GPU had exactly four samples in the latest minute. The NVIDIA dashboard rendered successfully without variable overrides.
- GCX rendered all 78 managed dashboards as full-page PNG snapshots over a one-hour range without variable overrides. The output directory contained exactly 78 non-empty images, including the Kubernetes cluster and NVIDIA dashboards.
- Final Pulumi previews were no-op: `monitoring.pantheon` reported 43 unchanged resources and `grafana-dashboards.pantheon` reported 92 unchanged resources. Root TypeScript validation and `git diff --check` passed.
- A later authorized host canary deployed Alloy to agent nodes Polaris and `tmp-node`; no K3s deploy ran. Both nodes remained ready, Alloy stayed active without warning logs, Proxy remained bound to `127.0.0.1:10249`, and Mimir returned `up=1` for the expected Romulus/Polaris and Pantheon/`tmp-node` series after one scrape interval.
- The authorized full rollout then applied K3s serially to the six server nodes and Alloy serially to the remaining eight nodes, with API, etcd, node-readiness, service, listener, and metric gates between clusters. Scheduler and Controller Manager remained HTTPS and loopback-only on ports 10259 and 10257; Proxy remained loopback-only on port 10249.
- The first Sol restart exposed a tracked systemd defect: both K3s templates invoked the destructive `k3s-killall.sh` cleanup script as `ExecStopPost`, causing recursive unit shutdown and a temporary Romulus API outage. The stuck systemd control process was terminated without invoking further cleanup, K3s recovered, and the invalid hook was removed from both server and agent templates before rollout resumed. Corrected serial restarts succeeded on all six servers and all four agents; every installed unit now has an empty `ExecStopPost`.
- Final live verification returned all 10 nodes ready and exactly 22 healthy Mimir targets: six Scheduler, six Controller Manager, and 10 Proxy series at `up=1`, with the expected cluster, namespace, job, and node-instance labels. Representative Scheduler and Controller Manager metric families were present, current Mimir distributor logs had no errors, and central Alloy logged only normal remote-storage resharding.
- Host Alloy continues to log periodic 2xx receiver response-stat warnings reporting fewer written samples than sent. The warnings predated this rollout; current control-plane targets and representative metrics are present, while central Alloy and Mimir report no corresponding write errors or rejections.
- A concurrent Kafka KRaft controller stall caused broad Mimir write failures from approximately `16:54:54Z` through `16:55:38Z`. Ingestion recovered, but broker 0 logged later controller-heartbeat timeouts. Separate ongoing Mimir HTTP 400 responses reject MKTXP `dst_addresses` label values longer than the configured 2,048-byte limit; these errors are not DCGM failures.

## 2026-07-29 Grafana Plugin Incident And Repair Evidence

- The two ready Grafana `13.1.1` replicas used the same container image digest but independently downloaded plugins into pod-local `emptyDir` storage. The older replica contained `grafana-pyroscope-app` `2.1.1`; the newer replica contained `2.2.0`.
- The newer replica's startup logs showed Grafana's background installer resolving and installing the unversioned recommended Pyroscope app. No repository plugin declaration, plugin version, shared plugin storage, or plugin init container governed that installation.
- The `2.2.0` runtime referenced `411.js`, which existed only on the newer replica, while the `2.1.1` runtime referenced `176.js`, which existed only on the older replica. Bounded public requests to `411.js` alternated between HTTP 200 and 404, and each pod logged 404 responses for the other version's chunk.
- This evidence confirmed that load balancing across incompatible pod-local frontend assets caused the intermittent Profiles Drilldown `ChunkLoadError`.
- An authorized `grafana.pantheon` preview and apply synchronously pinned Explore Traces `2.1.0`, Loki Explore `2.4.0`, Metrics Drilldown `2.3.0`, and Pyroscope `2.2.0`, and disabled the other Grafana 13.1.1 default recommendations. The apply changed only the Grafana component metadata, Grafana ConfigMap, Grafana Deployment, and image-renderer Deployment.
- Both replacement Grafana pods became ready with zero restarts. Their startup logs showed the four exact-version synchronous installations before server startup and no unversioned plugin installation. Both replicas reported the selected versions, and SHA-256 hashes matched for each plugin's `plugin.json` and `module.js` and for Pyroscope `411.js`.
- Twenty consecutive public requests to the formerly intermittent `411.js` URL returned HTTP 200 after the rollout. Bounded post-rollout Grafana logs contained no plugin-asset HTTP 404 responses.

## Open Verification

| Concern | Tracked or historical evidence | Verification still required |
| --- | --- | --- |
| Kafka quorum stability | The accepted 2026-07-27 observation was clean for approximately 24 minutes, but a new 2026-07-29 controller stall caused Mimir write failures and later heartbeat timeouts | Continue observing controller epochs, slow events, ingestion errors, and Ceph latency; treat timeout tuning as mitigation rather than resolution |
| Retained CephFS Kafka claims | The three pre-migration claims remain bound and are not used by the `database` node pool | Delete them only under separate explicit cleanup approval after a longer stable operating period |
| Grafana PostgreSQL storage class | Pantheon source requests three `50Gi` volumes using storage class `shared-fs`; the intended contract requires durable block storage | Establish the storage class semantics or align source and contract through a separately approved change |
| Grafana content drift | The dashboard repair is live, all 78 dashboards rendered without overrides, and the final dashboard preview reported 92 unchanged resources | Continue normal drift detection and verify future changes through separately authorized previews |
| Workload-stack drift | The 2026-08-01 telemetry rollout used exact Pulumi targets or direct Kubernetes patches because broad previews included unrelated application drift and targeted operations encountered mixed historical provider versions | Reconcile each affected workload stack before a future broad apply; keep Firecrawl decommissioning as a separate approved change |
| Host remote-write response statistics | All 22 control-plane targets are healthy and representative metrics are present, but host Alloy logs periodic 2xx responses whose write-count headers report fewer samples than sent | Trace the response headers through the central Alloy Prometheus receiver and reconcile receiver accounting before treating the host warning counters as reliable loss evidence |
| MKTXP connection labels | Mimir rejects `mktxp_connection_stats` samples whose `dst_addresses` label exceeds 2,048 bytes | Bound or remove the high-cardinality label in a separately approved telemetry repair rather than raising the Mimir limit without analysis |
| Pyroscope and Alloy | Source enables Pyroscope v2-only object storage and Alloy forwarding on port 4040 | Verify endpoint reachability, ingestion from one supported SDK, datasource queries, and absence of unintended direct backend clients |
| Current memory alerts | Four managed rules were included in the successful cutover and ruler evaluation returned no errors | Verify notification delivery separately before treating routing as proven |

## Historical Alert Evidence

The `protect-apollo-memory` lifecycle record dated 2026-07-26 reports that all four memory rule files in the retired `gcx` source tree parsed, Grafana reconciled them, the provisioning API returned the expected pending periods and warning severity, and the three new PromQL expressions evaluated successfully. It also reported no active OSD or OOM series and one active swap series at that point in time.

That record is historical evidence, not current Grafana state or notification-delivery proof.

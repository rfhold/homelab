# Observability Verification

Source inspection establishes tracked implementation only. Authorized Pantheon previews, applies, recovery operations, and read-only checks on 2026-07-27 established the dated observations below.

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

## Open Verification

| Concern | Tracked or historical evidence | Verification still required |
| --- | --- | --- |
| Kafka quorum stability | The accepted post-recovery observation was clean for approximately 24 minutes, but Ceph still reports BlueStore slow-operation indications | Continue observing controller epochs, slow events, ingestion errors, and Ceph latency; treat timeout tuning as mitigation rather than resolution |
| Retained CephFS Kafka claims | The three pre-migration claims remain bound and are not used by the `database` node pool | Delete them only under separate explicit cleanup approval after a longer stable operating period |
| Grafana PostgreSQL storage class | Pantheon source requests three `50Gi` volumes using storage class `shared-fs`; the intended contract requires durable block storage | Establish the storage class semantics or align source and contract through a separately approved change |
| Grafana content drift | The authorized cutover applied all three content stacks, final previews were no-op, and the ruler API reported no evaluation errors | Continue normal drift detection and verify future changes through separately authorized previews |
| Pyroscope and Alloy | Source enables Pyroscope v2-only object storage and Alloy forwarding on port 4040 | Verify endpoint reachability, ingestion from one supported SDK, datasource queries, and absence of unintended direct backend clients |
| Current memory alerts | Four managed rules were included in the successful cutover and ruler evaluation returned no errors | Verify notification delivery separately before treating routing as proven |

## Historical Alert Evidence

The `protect-apollo-memory` lifecycle record dated 2026-07-26 reports that all four memory rule files in the retired `gcx` source tree parsed, Grafana reconciled them, the provisioning API returned the expected pending periods and warning severity, and the three new PromQL expressions evaluated successfully. It also reported no active OSD or OOM series and one active swap series at that point in time.

That record is historical evidence, not current Grafana state or notification-delivery proof.

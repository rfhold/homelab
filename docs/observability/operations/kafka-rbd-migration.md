# Kafka RBD Migration

This is a guarded maintenance procedure, not evidence that the migration ran. It does not authorize a preview, apply, deletion, restart, or PVC cleanup.

## Scope

- Target: Pantheon storage, Strimzi, and Grafana Pulumi stacks and the `grafana/observability-kafka` resources.
- Stable identities: Kafka cluster `observability-kafka`, bootstrap endpoint, and topics `mimir-ingest` and `tempo-traces`.
- Accepted maintenance impact: bounded Mimir and Tempo ingestion interruption and possible loss of Kafka-buffered telemetry.
- Retained recovery material: existing CephFS PVCs remain retained until the RBD-backed cluster and telemetry paths are verified.

## Preconditions

1. Identify the exact Pantheon stack, backend, provider, and Kubernetes context before every Pulumi or Kubernetes operation.
2. Inspect current Ceph health. Stop for active slow operations, unavailable OSDs, degraded placement groups, or an unexplained health warning unless the operator explicitly accepts that risk.
3. Record current Kafka broker count, node-pool identity, PVC names and StorageClasses, quorum status, topic replication and ISR, consumer lag, and recent Mimir and Tempo ingestion errors.
4. Confirm fresh Mimir metrics and Tempo traces are queryable so post-cutover behavior has a baseline.
5. Confirm `deleteClaim: false` remains rendered and establish that the old CephFS claims will not be deleted by the reviewed operation.

## Storage Stage

1. Run and review a preview for the explicit Pantheon storage stack.
2. Stop if the preview changes existing CephFS resources, the default StorageClass, or unrelated Ceph resources.
3. Obtain explicit approval and apply only the reviewed storage change.
4. Confirm the `database` block pool is ready and the StorageClass uses RBD CSI, the intended pool, `ext4`, image format 2, `layering`, expansion, `WaitForFirstConsumer`, and the `Delete` reclaim policy.
5. Under explicit approval, prove bounded claim provisioning, mount, write, expansion, and deletion before placing Kafka on the class.

## Cutover Stage

1. Run and review explicit Pantheon Strimzi and Grafana previews.
2. Confirm the Grafana preview preserves the Kafka cluster, bootstrap, and topic identities while replacing `KafkaNodePool/grafana/observability-kafka-pool` with `KafkaNodePool/grafana/database` under the existing Pulumi logical resource. The replacement MUST be delete-before-create and add only the approved resource, heap, exporter, ConfigMap, annotation, metrics-Service, and timeout changes.
3. Confirm the Kafka config sets controller election timeout to `10000ms`, controller fetch timeout to `30000ms`, and broker session timeout to `30000ms`. The Strimzi-forbidden `controller.quorum.request.timeout.ms` setting MUST remain absent.
4. Stop for replacement or deletion of object-storage buckets, Mimir or Tempo durable data, Grafana PostgreSQL claims, or unrelated resources.
5. Obtain explicit maintenance approval for the concrete deletion and apply sequence.
6. Apply the reviewed Grafana change so Pulumi deletes only `KafkaNodePool/grafana/observability-kafka-pool` before creating `KafkaNodePool/grafana/database`. Do not manually delete resources or remove them from Pulumi state.
7. Preserve `Kafka/grafana/observability-kafka`, both KafkaTopic resources, their stable bootstrap and topic identities, and all retained CephFS claims throughout the replacement.
8. Stop if the old node pool disappears from Pulumi state without the reviewed replacement or if any Kafka or KafkaTopic CR is selected for deletion.

## Validation

1. Confirm three `database` RBD PVCs are bound and three combined brokers/controllers are ready with the configured requests, limits, and `1024M` heap bounds.
2. Confirm one stable KRaft leader, three voters, no follower lag, and no repeated election or slow-controller events.
3. Confirm both topics are ready at replication factor 3 with all replicas in sync and `min.insync.replicas=2`.
4. Confirm Mimir and Tempo consumers advance with bounded lag and no Kafka write errors.
5. Submit and query fresh metrics and traces through the supported entry points.
6. Confirm Mimir contains broker JMX, Kafka Exporter, Topic Operator, User Operator, and Cluster Operator jobs, with one target per intended endpoint and no duplicate broker series.
7. Observe at least 30 minutes with no controller election churn, slow controller events, Kafka write failures, or Mimir and Tempo ingestion errors.
8. Review a subsequent non-mutating preview for unexplained drift.

## Stale Topic-ID Recovery

Destructive cluster recreation can recreate topics under the same names with different Kafka topic IDs. If producers write but consumers report `UNKNOWN_TOPIC_ID`, use this bounded recovery path:

1. Confirm the recreated topics are ready and advancing, then identify the exact producer or consumer workloads retaining old topic IDs from bounded logs.
2. Obtain explicit restart approval naming every affected workload. Do not restart unrelated backend or storage workloads.
3. Restart affected producers before consumers and wait for readiness and advancing topic offsets. The observed Tempo recovery required only `Deployment/tempo/grafana-stack-tempo-chart-distributor`; restart other producers only when their logs show the same stale-client condition.
4. Restart Mimir ingesters one zone at a time in the order `StatefulSet/mimir/grafana-stack-mimir-chart-ingester-zone-a`, `-zone-b`, then `-zone-c`, waiting for each pod to become ready. These StatefulSets use `OnDelete`, so a pod must be explicitly replaced after its template is updated.
5. Restart and wait for `StatefulSet/tempo/grafana-stack-tempo-chart-live-store`, `StatefulSet/tempo/grafana-stack-tempo-chart-block-builder`, and `Deployment/tempo/grafana-stack-tempo-chart-metrics-generator` in that order when their logs show stale topic IDs.
6. Repeat topic-offset, consumer-error, fresh-query, metrics-target, and stability-window validation from the beginning.

## Recovery And Cleanup

If the RBD-backed cluster cannot stabilize, stop the maintenance operation and preserve both old and new claims. Any return to the retained CephFS claims requires a separately reviewed recovery preview and explicit approval; do not improvise resource names or attach claims to a different cluster identity.

Delete retained CephFS PVCs only after the full validation window and under separate explicit approval. Record the target, date, observed result, and limitations in [`../verification.md`](../verification.md) without copying credentials or secret-bearing output.

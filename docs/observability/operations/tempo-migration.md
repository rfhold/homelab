# Tempo 3 Migration

This is a forward-only maintenance policy, not evidence that the migration ran. Do not execute a cutover without explicit approval for the Pantheon maintenance outage and the concrete deployment diff.

## Preconditions

1. Inspect live state read-only to determine whether Tempo 2 or Tempo 3 is running. If Tempo 3 is already active, do not repeat the cutover.
2. Confirm Strimzi and the `tempo-traces` topic are ready, with three partitions and three replicas.
3. Confirm the existing Tempo object-storage bucket is retained and establish baseline Alloy OTLP ingestion and Grafana query behavior.
4. Run and review a full Pantheon Grafana-stack preview. Stop for unrelated changes, replacement of durable storage, or removal of stable service identities.
5. Obtain explicit approval for the outage and acceptance of possible trace loss.

## Cutover Boundary

The approved sequence is to stop the Tempo 2 write path, deploy the reviewed Tempo 3 source, and validate the new path before ending maintenance. Do not improvise an overlapping dual-write architecture or expose Kafka to telemetry clients.

After Tempo 3 starts, an in-place downgrade to Tempo 2 is unsupported. Recovery MUST proceed by correcting Tempo 3 configuration or dependencies, reviewing a new preview, and applying the forward fix. Preserve the Kafka topic and object-storage bucket while recovering.

## Validation

With explicit live-query authorization, verify all of the following before closing maintenance:

- Alloy can submit OTLP traces to the Tempo distributor;
- block-builder and live-store consume `tempo-traces` with three replicas each;
- backend scheduler and backend worker are ready, with no old ingester or compactor workloads;
- Grafana can query recent traces through the Tempo query frontend;
- generated service-graph and span metrics reach Mimir; and
- a subsequent non-mutating preview reports no drift.

Record normalized outcomes without credentials or raw secret-bearing output. The current missing evidence is tracked in [`../verification.md`](../verification.md).

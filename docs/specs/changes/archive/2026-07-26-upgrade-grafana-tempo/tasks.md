# Upgrade Grafana And Tempo Implementation Plan

## Change Summary

Upgrade Grafana to chart 12.8.0 and Tempo distributed to chart 3.0.6, migrate Tempo to its Kafka-backed architecture, and preserve existing telemetry and query entry points.

## Contract Boundary Assessment

- Status: required
- Surfaces: `TempoArgs`, `OBSERVABILITY_KAFKA_TOPICS`, `GrafanaStackArgs.observabilityKafka.topics`, and `ObservabilityKafkaConfig`
- Contract file: `docs/specs/changes/upgrade-grafana-tempo/contracts.md`

## Tasks

1. Update stable and delta specifications for the released Tempo 3 architecture.
2. Upgrade Grafana and Tempo chart pins.
3. Restore the distinct `tempo-traces` contract and create the three-partition topic.
4. Replace Tempo ingester and compactor values with Kafka ingest, backend scheduler/worker, block-builder, and live-store values.
5. Run type checking, whitespace validation, delegated review, and a full Pantheon preview.
6. Gate the maintenance outage and deployment on explicit preview approval.
7. Scale Tempo 2 down, deploy Tempo 3, validate runtime behavior, and confirm zero drift.

All implementation tasks are dispatched inline because the contracts and rendered chart values are tightly coupled.

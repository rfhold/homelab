# Grafana Mimir Research Evidence

This is a non-authoritative research record. It does not define the current Mimir contract, tracked configuration, deployment state, or health.

## Provenance

- The research named the official `mimir-distributed` chart and recorded `6.0.0-rc.0` as the latest version "as of documentation"; no research or retrieval date was recorded.
- Consulted sources: [Mimir documentation](https://grafana.com/docs/mimir/latest/), [chart documentation](https://grafana.com/docs/helm-charts/mimir-distributed/latest/), [chart source](https://github.com/grafana/mimir/tree/main/operations/helm/charts/mimir-distributed), [production guidance](https://grafana.com/docs/mimir/latest/manage/run-production-environment/production-tips/), and [capacity planning](https://grafana.com/docs/mimir/latest/manage/run-production-environment/planning-capacity/).

## Evidence Retained

- The evaluation distinguished monolithic, microservices, and then-experimental read-write modes.
- It identified object storage, replication, caching, multi-tenancy, and Kafka-backed ingest storage as design concerns.
- It recorded that chart `6.0.0+` displaced older simple-scalable assumptions with ingest storage defaults. This upstream claim requires reverification.

## Repository Relevance

The research informed evaluation of Mimir as the metrics backend and of Kafka and S3-compatible storage dependencies. Generic manifests, IAM policy examples, sizing, and installation steps were removed because they were neither repository contracts nor verified live configuration.

## Disposition

Current source-backed behavior and intended backend contracts are in [observability implementation](../observability/implementation.md) and [backend specifications](../observability/spec/backends.md). Those documents supersede this record for repository behavior.

# Grafana Kubernetes Monitoring Chart Research Evidence

This is a non-authoritative research record. It does not establish installed chart versions, collector topology, destinations, labels, or live telemetry.

## Provenance

- The research recorded chart `3.5.5`, Alloy `v1.10.1`, Alloy Operator `1.2.1`, kube-state-metrics `v2.16.0`, and node-exporter `v1.9.1`; no research or retrieval date was recorded.
- The source collection named the Grafana `k8s-monitoring` Helm chart but did not record a source URL in this file.

## Evidence Retained

- The chart was evaluated for separate metrics, logs, receiver, singleton, and profiles Alloy roles managed by the Alloy Operator.
- It considered self-hosted Mimir, Loki, Tempo, and Pyroscope destinations, OTLP application receivers, Prometheus Operator discovery, and multi-cluster labels.
- The research identified duplicate exporter deployment, resource use, label conventions, and migration from existing monitoring as decision concerns.

## Repository Relevance

This versioned snapshot informed the repository's Kubernetes telemetry implementation. Copied values and resource recommendations were removed because tracked source now supplies the implementation evidence.

## Disposition

Use [observability implementation](../observability/implementation.md), [backend specifications](../observability/spec/backends.md), and [observability verification](../observability/verification.md).

# Grafana Alloy Pipeline Research Evidence

This is a non-authoritative research record. It does not define valid current Alloy syntax, enabled receivers, endpoint addresses, tenant policy, or deployed pipelines.

## Provenance

- No Alloy version, research date, or retrieval date was recorded.
- Consulted sources: [Alloy documentation](https://grafana.com/docs/alloy/latest/), [OpenTelemetry specifications](https://opentelemetry.io/docs/specs/otel/), [Loki push API](https://grafana.com/docs/loki/latest/api/#push-log-entries-to-loki), [Prometheus remote write](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#remote_write), and [Mimir documentation](https://grafana.com/docs/mimir/latest/).

## Evidence Retained

- The evaluation covered OTLP gRPC and HTTP receivers, native Loki and Prometheus inputs, batching, relabeling, span metrics, service graphs, and backend exporters.
- Multi-tenancy headers, TLS, queues, retries, memory limiting, and Kubernetes service discovery were identified as design concerns.
- The original examples mixed speculative syntax and endpoints; they were removed rather than preserved as runnable configuration.

## Repository Relevance

The research supplied options for the shared telemetry collection architecture but cannot override tracked generated Alloy configuration.

## Disposition

Use [observability implementation](../observability/implementation.md), [backend specifications](../observability/spec/backends.md), and [profiling specifications](../observability/spec/profiling.md) for current repository contracts.

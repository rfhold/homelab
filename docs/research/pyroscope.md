# Pyroscope Profiling Guide

## Overview

The homelab observability stack now exposes continuous profiling for selected custom applications through the shared Alloy gateway on `pantheon`.

- Cluster: `pantheon`
- Alloy profiling endpoint: `https://telemetry.holdenitdown.net:4040`
- Pyroscope read endpoint: `http://grafana-stack-pyroscope-chart-read.pyroscope:80`
- Pyroscope write endpoint: `http://grafana-stack-pyroscope-chart-write.pyroscope:80`
- Grafana datasource: `Pyroscope`

Applications must send profiling traffic to the shared Alloy endpoint. They should not be configured to talk directly to the Pyroscope backend services.

## Supported Runtime Matrix

| Runtime | Status | Supported profiles | Notes |
| --- | --- | --- | --- |
| Go | Supported | CPU, alloc, inuse, goroutine, mutex, block | Use the Grafana Pyroscope Go SDK against the Alloy endpoint. |
| Node.js | Supported | wall, CPU, heap | Use the Grafana Pyroscope Node.js SDK against the Alloy endpoint. CPU collection depends on enabling `wall.collectCpuTime`. |
| Bun | Not supported | none | Bun is not supported by the Node.js SDK path. A separate profiling approach is required before Bun services are added. |
| Rust | Supported | CPU, optional memory | Use the Rust Pyroscope SDK against the Alloy endpoint. Memory profiling depends on allocator integration such as jemalloc. |

## Application Endpoint Contract

Use the shared Alloy profiling endpoint as the SDK server address:

```text
https://telemetry.holdenitdown.net:4040
```

This keeps profiling traffic on the same gateway model already used for telemetry ingestion and avoids exposing backend internals to applications.

## Adoption Rules

- Profiling is for selected custom applications only.
- Uninstrumented applications can remain unmodified.
- Third-party applications are out of scope unless they have a maintained SDK integration path.
- Bun-based JavaScript services remain out of scope for this SDK path.

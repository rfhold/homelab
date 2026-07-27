# Continuous Profiling

## Backend

The Pantheon observability platform MUST provide a production profiling backend with:

- durable shared object storage rather than ephemeral pod storage;
- distinct read and write endpoints;
- a Grafana Pyroscope datasource using proxy access to the read endpoint; and
- Pyroscope v2 storage enabled with v1 storage disabled.

The v2 cutover MUST NOT require dual-writing. Historical v1 profiles are not required to remain queryable after v1 components are disabled.

## Ingestion

SDK-generated profiles MUST enter through the shared Alloy telemetry gateway and be forwarded to the Pyroscope write endpoint. Applications MUST NOT need to address Pyroscope internals or use a separate application-facing profiling ingress.

## Runtime Support

| Runtime | Required support |
| --- | --- |
| Go | Continuous CPU and memory-oriented profiles |
| Node.js | Wall, CPU, and heap profiles |
| Rust | CPU profiles; memory profiles MAY be supported with the required allocator integration |
| Bun | Not supported by the Node.js SDK path; a separate approved approach is required |

Adoption MUST remain selective. Applications without maintained SDK support, third-party applications outside the selected scope, and applications not chosen for profiling MAY remain uninstrumented.

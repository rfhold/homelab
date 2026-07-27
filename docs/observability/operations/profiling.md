# Profiling Applications

This operation enables selected applications to send profiles through Alloy. It changes application configuration but does not deploy or modify the observability stack.

## Configured Endpoints

These values are derived from tracked source and do not prove reachability:

| Use | Configured value |
| --- | --- |
| Application SDK endpoint | `https://telemetry.holdenitdown.net:4040` |
| Internal Pyroscope read service | `http://grafana-stack-pyroscope-chart-read.pyroscope:80` |
| Internal Pyroscope write service | `http://grafana-stack-pyroscope-chart-write.pyroscope:80` |
| Grafana datasource | `Pyroscope` |

Applications MUST use the Alloy endpoint. The internal read and write services are backend boundaries for Alloy and Grafana, not application endpoints.

## Runtime Matrix

| Runtime | Status | Profiles | Adoption note |
| --- | --- | --- | --- |
| Go | Supported | CPU, allocation, in-use memory, goroutine, mutex, and block | Configure the maintained Grafana Pyroscope Go SDK with the Alloy URL |
| Node.js | Supported | Wall, CPU, and heap | CPU collection requires the SDK's wall CPU-time option |
| Rust | Supported | CPU and optional memory | Memory profiling requires allocator integration such as jemalloc |
| Bun | Unsupported by this path | None | Do not assume Node.js SDK compatibility |

## Adoption Guard

1. Confirm the application runtime is supported and that profiling has an owner.
2. Configure the SDK server address to the Alloy endpoint, not a Pyroscope service.
3. Use a stable application or service name that lets operators distinguish profile series.
4. Roll out to the selected application only; do not make profiling a platform-wide requirement.
5. With authorization to query the live system, confirm recent profiles through the `Pyroscope` datasource before broadening adoption.

Do not add unsupported third-party or Bun services without a separate approved profiling approach.

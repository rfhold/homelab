# Pyroscope Historical Evidence

This is a non-authoritative, superseded operational record. It does not prove that any profiling endpoint, backend service, datasource, cluster placement, or application integration is currently live.

## Provenance

- The original record named Pantheon, a shared external Alloy profiling endpoint, internal Pyroscope read and write services, and a Grafana datasource.
- It recorded no Pyroscope, Alloy, SDK, or runtime versions and no observation or retrieval date.
- No external source URLs were recorded.

## Evidence Retained

- The intended integration sent application profiles through Alloy rather than directly to Pyroscope backends.
- Go, Node.js, and Rust SDK paths were considered supported; Bun was explicitly excluded from the Node.js SDK path.
- Profiling was limited to selected custom applications rather than unmodified third-party workloads.

## Repository Relevance

This record preserves the prior operational contract and runtime rationale only. Its endpoint and deployment statements are historical observations, not current authority.

## Disposition

Active guidance moved to [profiling operations](../observability/operations/profiling.md), with intended behavior in [profiling specifications](../observability/spec/profiling.md) and unresolved state in [observability verification](../observability/verification.md).

# CloudNativePG Extension Research Evidence

This is a non-authoritative research record. It does not establish installed PostgreSQL extensions, versions, database contents, or operator behavior.

## Provenance

- The source referenced CloudNativePG `1.27+`, PostgreSQL `18+`, Kubernetes `1.33+`, and pgvector `0.8.0` and `0.8.1`; no research or retrieval date was recorded.
- It noted Microsoft's DocumentDB extension announcement in January 2025 but recorded no source URL. No other consulted source URLs were preserved.

## Evidence Retained

- The evaluation compared extension image volumes with custom PostgreSQL images and considered declarative extension lifecycle through a Database custom resource.
- pgvector was evaluated for vector similarity search; native JSONB was preferred over an extension for general document storage in this research.
- Extension version pinning, preload requirements, index-build memory, backups, recovery tests, and compatibility across upgrades were identified as design concerns.

## Repository Relevance

This evidence informed custom pgvector and DocumentDB image evaluation. Claims of production readiness or bundled extensions require current upstream and source verification.

## Disposition

Current custom database image documentation is linked from [deployment](../deployment/README.md). No CloudNativePG extension contract exists; any workload decision belongs in [Kubernetes workloads](../kubernetes-workloads/README.md).

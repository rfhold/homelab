# Kopia Backup Research Evidence

This is a non-authoritative research record. It does not establish a Kopia repository, credentials, retention policy, backup schedule, deployment, or successful restore.

## Provenance

- No Kopia version, research date, or retrieval date was recorded.
- Consulted sources: [Kopia](https://kopia.io), [repository](https://github.com/kopia/kopia), [documentation](https://kopia.io/docs/), [community forum](https://kopia.discourse.group/), and [container image](https://hub.docker.com/r/kopia/kopia).

## Evidence Retained

- Kopia was evaluated for encrypted, compressed, deduplicated, incremental file-level snapshots across filesystem, S3-compatible, and network storage.
- Standalone clients, a repository server, Kubernetes jobs, and node-level agents were compared.
- Repository-password custody, TLS, access control, retention, maintenance, integrity verification, and restore testing were identified as essential concerns.
- The research treated Kopia as complementary to Kubernetes resource backup rather than a complete replacement for it.

## Repository Relevance

This evidence informed backup-tool comparison. Sample cloud credentials, speculative charts, manifests, schedules, and implementation recommendations were removed.

## Disposition

No canonical Kopia deployment contract exists. Current Ceph and recovery documentation is under [storage](../storage/README.md); any backup adoption must be represented there with verified restore evidence.

# Velero and Kopia Research Evidence

This is a non-authoritative research record. It does not establish a Velero installation, backup location, repository password, schedule, completed backup, or successful restore.

## Provenance

- The research described Velero `v1.14.x` as latest stable and `v1.13.x` as previous stable; no research or retrieval date was recorded.
- No external source URLs were recorded in the original file.

## Evidence Retained

- Velero was evaluated for Kubernetes resource backup and restore, with node agents using Kopia for filesystem volume data.
- Object-storage metadata, volume backup, restore initialization, schedules, namespace mapping, hooks, and repository maintenance were evaluated.
- Kopia supplied client-side encryption, deduplication, compression, and incremental data transfer; repository-password custody and first-use initialization were identified as critical.
- The source proposed NFS behind an S3 gateway, but this was not recorded as an approved homelab design.

## Repository Relevance

This evidence preserves the rationale for evaluating a combined Kubernetes-resource and file-data backup path. Secret-bearing commands, full CRDs, generic schedules, and unverified recovery procedures were removed.

## Disposition

No canonical Velero contract exists. Current storage behavior and recovery evidence belong under [storage](../storage/README.md). A future backup decision must include independently verified restore outcomes.

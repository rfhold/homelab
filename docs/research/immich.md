# Immich Research Evidence

This is a non-authoritative research record. It does not establish an approved Immich version, storage layout, database, authentication, deployment, backup, or live library state.

## Provenance

- The source used `v1.123.0` as an example image pin but did not state that it was the researched or deployed version. No research or retrieval date was recorded.
- Consulted sources: [Immich documentation](https://docs.immich.app/), [repository](https://github.com/immich-app/immich), [Helm charts](https://github.com/immich-app/immich-charts), [immich-go](https://github.com/simulot/immich-go), and a [FOSS photo-library comparison](https://meichthys.github.io/foss_photo_libraries/).

## Evidence Retained

- Immich was evaluated as a server, machine-learning service, PostgreSQL vector database, and Redis or Valkey job queue.
- Original media, database placement, generated media, model cache, reverse-proxy upload behavior, OIDC, hardware transcoding, and independent database and media recovery were identified as concerns.
- The research distinguished critical originals and profiles from regenerable thumbnails and encoded video.

## Repository Relevance

This evidence supports workload and storage evaluation but records no adoption decision. Generic installation, migration, and destructive restore procedures were removed.

## Disposition

No canonical Immich contract exists. Any implemented workload belongs under [Kubernetes workloads](../kubernetes-workloads/README.md), with storage and recovery contracts under [storage](../storage/README.md).

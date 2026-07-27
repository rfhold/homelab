# Immich CPU Machine-Learning Research Evidence

This is a non-authoritative research record. It does not establish selected models, worker counts, resources, cache storage, service exposure, deployment, or measured performance.

## Provenance

- The source included examples using Immich `v2.0.0` and a PostgreSQL 14 VectorChord image, but did not identify a single researched or deployed version. No research or retrieval date was recorded.
- Consulted sources: [Immich documentation](https://docs.immich.app/), [environment variables](https://docs.immich.app/install/environment-variables/), [remote ML](https://docs.immich.app/guides/remote-machine-learning/), [scaling](https://docs.immich.app/guides/scaling-immich/), [Helm charts](https://github.com/immich-app/immich-charts), and [CLIP model discussion](https://github.com/immich-app/immich/discussions/11862).

## Evidence Retained

- CPU inference was evaluated as the default path, with ONNX thread controls, worker count, model lifetime, preloading, and persistent model cache as tuning dimensions.
- The research preferred `ViT-B-16-SigLIP__webli` for a CPU quality and cost balance, but this was not a homelab benchmark or approved selection.
- Multiple worker processes duplicate model memory; multiple service URLs provide failover rather than load balancing without an external balancer.
- The unauthenticated machine-learning service should remain on a trusted internal path.

## Repository Relevance

This is decision input for CPU-only photo inference, not current workload evidence. Generic Compose and Kubernetes examples were removed.

## Disposition

No canonical Immich ML contract exists. Any future resource or placement decision belongs in [Kubernetes workload specifications](../kubernetes-workloads/README.md) and unresolved state in [workload verification](../kubernetes-workloads/verification.md).

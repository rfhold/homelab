# Tracked Deployment Implementation

This document summarizes repository source. It is not evidence that a build ran, an image exists in a registry, or a rendered resource matches a live cluster.

## Image Classes

| Class | Tracked source | Publishing path |
| --- | --- | --- |
| Generic CI helpers | [`docker/bun-ci/Dockerfile`](../../docker/bun-ci/Dockerfile), [`docker/tauri-e2e-ci/Dockerfile`](../../docker/tauri-e2e-ci/Dockerfile) | Path-filtered Tekton BuildKit pipelines are configured to publish `bun-ci:latest` and `tauri-e2e-ci:latest` |
| Application images | The four image guides indexed in [`README.md`](README.md) | Three manual GitHub workflows are configured to publish version-tagged GHCR images; no workflow references `docker/vllm/` |

The CI helpers provide workflow tooling and follow the Dockerfile-only Tekton pattern. The application images package database extensions, NVR models, or an inference runtime and are not generic CI environments.

## Tekton

- [`programs/tekton/index.ts`](../../programs/tekton/index.ts) passes configured repositories and deployment credentials into the Tekton component.
- [`src/components/tekton.ts`](../../src/components/tekton.ts) creates PAC `Repository` resources and per-cluster deployer access.
- The deployer `ClusterRole` grants the existing CRUD verb set to both `jobs` and `cronjobs` in the `batch` API group.
- [`programs/tekton/Pulumi.pantheon.yaml`](../../programs/tekton/Pulumi.pantheon.yaml) includes `rfhold/kokoro` and `rfhold/whisperx` in the PAC repository list.

## BuildKit

[`programs/buildkit/Pulumi.pantheon.yaml`](../../programs/buildkit/Pulumi.pantheon.yaml) selects Artemis for the amd64 builder and Mars for the arm64 builder. Their node-local hostPath caches are `/var/lib/buildkit-cache/amd64` and `/var/lib/buildkit-cache/arm64`. [`programs/buildkit/index.ts`](../../programs/buildkit/index.ts) constructs and exports both architecture-specific service endpoints through the same component path.

[`src/components/buildkit.ts`](../../src/components/buildkit.ts) creates one-replica StatefulSets backed by those hostPath caches. Each BuildKit daemon holds `buildkitd.lock` for its cache lifetime, so node maintenance must terminate the pinned builder cleanly before K3s restarts.

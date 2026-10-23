# Tracked Deployment Implementation

This document summarizes repository source. It is not evidence that a build ran, an image exists in a registry, or a rendered resource matches a live cluster.

## Image Classes

| Class | Tracked source | Publishing path |
| --- | --- | --- |
| Generic CI helpers | [`docker/bun-ci/Dockerfile`](../../docker/bun-ci/Dockerfile), [`docker/tauri-e2e-ci/Dockerfile`](../../docker/tauri-e2e-ci/Dockerfile), [`docker/tauri-release-ci/Dockerfile`](../../docker/tauri-release-ci/Dockerfile) | Path-filtered Tekton BuildKit pipelines are configured to publish the mutable Bun and Tauri E2E images and the version-tagged Tauri release image |
| Application images | The four image guides indexed in [`README.md`](README.md) | Three manual GitHub workflows are configured to publish version-tagged GHCR images; no workflow references `docker/vllm/` |

The CI helpers provide workflow tooling and follow the Dockerfile-only Tekton pattern. The application images package database extensions, NVR models, or an inference runtime and are not generic CI environments.

## CI Toolchain Contracts

- [`docker/general-ci/Dockerfile`](../../docker/general-ci/Dockerfile) installs `protoc-gen-prost` 0.5.0 and `protoc-gen-tonic` 0.5.0 with exact-version `cargo install --locked` commands.
- [`docker/general-ci/versions.sh`](../../docker/general-ci/versions.sh) checks both plugins and Buf 1.47.2.
- [`docker/rust-ci/Dockerfile`](../../docker/rust-ci/Dockerfile), [`docker/android-ci/Dockerfile`](../../docker/android-ci/Dockerfile), and both Tauri Dockerfiles pin Rust 1.96.0 with explicit Clippy and rustfmt components.
- Each native image's final Dockerfile copies and executes its adjacent `verify.sh`; the current publication pipeline uses that final build context.
- [`docker/tauri-release-ci/verify.sh`](../../docker/tauri-release-ci/verify.sh) checks release tools, SDK packages, Java 17, and Rust targets. It also compiles, links, and executes an ALSA C probe without audio hardware.
- The release image uses NDK 29.0.14206865 and build-tools 36.0.0. `android-ci` retains NDK 29.0.13846066 and build-tools 35.0.0.

The visible Kuri release consumer retains its version-tagged builder reference and `Always` pull policy. Source inspection does not establish other repositories' consumers or registry contents. See [verification.md](verification.md#ci-toolchain-verification) for local evidence and unresolved image checks.

## Focused Rust/Web And Browser Images

| Source | Tracked behavior |
| --- | --- |
| [`docker/rust-web-ci/Dockerfile`](../../docker/rust-web-ci/Dockerfile) and [`verify.sh`](../../docker/rust-web-ci/verify.sh) | Bookworm toolchain; native/offline WASM checks; web glue execution with a locked, tool-owned fixture |
| [`.tekton/build-rust-web-ci.yaml`](../../.tekton/build-rust-web-ci.yaml) | Native amd64/arm64 builds, architecture-matched verification, unique manifest tag, and digest result; no `latest` |
| [`docker/playwright-ci/Dockerfile`](../../docker/playwright-ci/Dockerfile) and [`verify.mjs`](../../docker/playwright-ci/verify.mjs) | amd64-only Bookworm browser tools, exact Playwright metadata contract, nonroot sandboxed Chromium local-page check |
| [`.tekton/build-playwright-ci.yaml`](../../.tekton/build-playwright-ci.yaml) | Unique candidate tag, restricted amd64 verification with memory-backed shared memory, and digest promotion to a unique final tag |

The Rust/web image supplies tools, not Kuri application dependencies or caches. Kuri's Dockerfile retains its current provisioning; digest-based adoption remains deferred.

Kuri's `scripts/test-browser-image.mjs` validates repository-local Playwright/core metadata against the image contract. Its configuration imports the current Apps browser harness, forces the Chromium sandbox, and adds `--locked --offline` to Cargo commands. This opt-in launcher does not alter current Kuri CI adoption.

## AppImage Main Dependency Inspection

[`tauri-release-build.yaml`](../../src/components/tekton-tasks/tauri-release-build.yaml) extracts the actual AppImage without FUSE or application startup. It resolves the main executable through the single root desktop entry and requires a safe `usr/bin` amd64 ELF64 binary.

Before APK signature operations and final asset installation, the Task checks the main ELF dependency closure with `ldd`. Resolution uses AppDir `usr/lib`, ELF RPATH/RUNPATH, and builder-host defaults. Any unresolved direct, transitive, or version dependency fails the check; unrelated plugins do not define this closure.

If the closure links `libasound.so.2`, the Task requires resolution and reports `bundled` or `builder-host`. A valid application without that dependency reports `not-linked` and passes.

The Task requires `timeout` and `realpath` from coreutils, `readelf` from binutils, and `ldd` from libc-bin. It bounds execution time and private output, clears probe environments, and cleans temporary extraction data. This checks builder resolution, not target-OS portability, application startup, dynamic plugin loads, devices, Wayland, permissions, or audio acceptance.

## Tekton

- [`programs/tekton/index.ts`](../../programs/tekton/index.ts) passes configured repositories and deployment credentials into the Tekton component.
- [`src/components/tekton.ts`](../../src/components/tekton.ts) creates PAC `Repository` resources and per-cluster deployer access.
- The deployer `ClusterRole` grants the existing CRUD verb set to both `jobs` and `cronjobs` in the `batch` API group.
- The deployer `ClusterRole` grants the deployment CRUD verb set to cert-manager `certificates` while retaining get and list access to `clusterissuers`.
- [`programs/tekton/Pulumi.pantheon.yaml`](../../programs/tekton/Pulumi.pantheon.yaml) configures the shared component to provision deployer access for Romulus and Pantheon.
- [`programs/tekton/Pulumi.pantheon.yaml`](../../programs/tekton/Pulumi.pantheon.yaml) includes `rfhold/kokoro-server`, `rfhold/whisperx-server`, `rfhold/smarthome-mcp`, and `rfhold/esp-wifi-cam` in the tracked PAC repository list.
- [`programs/tekton/index.ts`](../../programs/tekton/index.ts) reads the optional plain `tekton:kuri-android-signing-cert-sha256` configuration value, and [`src/components/tekton.ts`](../../src/components/tekton.ts) maps it to `KURI_ANDROID_SIGNING_CERT_SHA256` only on the exact `rfhold/kuri` PAC `Repository`.
- [`src/components/tekton-tasks/tauri-release-build.yaml`](../../src/components/tekton-tasks/tauri-release-build.yaml) references the shared OpenBao login StepAction, builds and signs Kuri APK and AppImage assets, and confines signing material to memory-backed Task storage.
- [`src/components/tekton-tasks/forgejo-release-upsert.yaml`](../../src/components/tekton-tasks/forgejo-release-upsert.yaml) references the same login StepAction and reconciles Forgejo release metadata and replacement assets using a token read into memory-backed Task storage.
- [`src/components/tekton-tasks/kustomization.yaml`](../../src/components/tekton-tasks/kustomization.yaml) registers both release Tasks without changing the existing `forgejo-release` resource.

## BuildKit

[`programs/buildkit/Pulumi.pantheon.yaml`](../../programs/buildkit/Pulumi.pantheon.yaml) selects Artemis for the amd64 builder and Mars for the arm64 builder. Their node-local hostPath caches are `/var/lib/buildkit-cache/amd64` and `/var/lib/buildkit-cache/arm64`. [`programs/buildkit/index.ts`](../../programs/buildkit/index.ts) constructs and exports both architecture-specific service endpoints through the same component path.

[`src/components/buildkit.ts`](../../src/components/buildkit.ts) creates one-replica StatefulSets backed by those hostPath caches. Each BuildKit daemon holds `buildkitd.lock` for its cache lifetime, so node maintenance must terminate the pinned builder cleanly before K3s restarts.

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
- [`src/components/tekton-tasks/tauri-release-build.yaml`](../../src/components/tekton-tasks/tauri-release-build.yaml) references the shared OpenBao login StepAction and confines credentials to memory-backed Task storage.
- Its `artifact-prefix` parameter selects the APK and AppImage filename prefix, defaults to `kuri`, and requires a portable lowercase slug. Waltr consumers explicitly pass `waltr`.
- [`src/components/tekton-tasks/forgejo-release-upsert.yaml`](../../src/components/tekton-tasks/forgejo-release-upsert.yaml) references the same login StepAction and reconciles Forgejo release metadata and replacement assets using a token read into memory-backed Task storage.
- [`src/components/tekton-tasks/kustomization.yaml`](../../src/components/tekton-tasks/kustomization.yaml) registers both release Tasks without changing the existing `forgejo-release` resource.

### Shared Release Contracts

[`programs/tekton/index.ts`](../../programs/tekton/index.ts) adds shared release identities through the current OpenBao attachment gate. They supplement the legacy Kuri and ESP contracts; this source change does not migrate those consumers.

| Contract | Shared value |
| --- | --- |
| Build ServiceAccount, role, policy, audience | `tauri-release-build-v1` |
| Publication ServiceAccount, role, policy, audience | `forgejo-release-v1` |
| Build KV v2 API path | `kv/data/ci/signing/android/release` |
| Publication KV v2 API path | `kv/data/ci/forgejo/release` |
| Public trust Secret and key | `pipelines-as-code/release-trusted-signers`, `signing-key.asc` |

Both ServiceAccounts disable automatic token mounts. Each role binds its exact ServiceAccount, namespace, and audience, suppresses `default`, and issues non-renewable batch tokens with 900-second TTL and maximum TTL. Each policy reads only its exact secret path and `auth/token/lookup-self`. The shared publisher has no ESP firmware private-key permission.

The Tekton program accepts optional public armored key configuration `tekton:release-trusted-signers` for the public trust Secret. It does not import secret payloads or create Forgejo credentials.

The optional `tekton:android-signing-cert-sha256-by-repository` map supplies fingerprints by exact enrolled repository name. [`src/components/tekton.ts`](../../src/components/tekton.ts) emits `ANDROID_SIGNING_CERT_SHA256` only on the matching PAC repository, never globally. The legacy Kuri configuration and `KURI_ANDROID_SIGNING_CERT_SHA256` parameter remain independent.

These statements describe the source target, not an applied release platform. Live identity readback, secret bootstrap, negative authorization checks, and consumer release canaries require separate authorization. See the [shared bootstrap runbook](../operations/shared-release-secret-bootstrap.md).

## Shared Service Deployment v1 API

The four additive Tasks reside in [`src/components/tekton-tasks/`](../../src/components/tekton-tasks/kustomization.yaml). Legacy Tasks remain unchanged. These are source contracts, not evidence of cluster installation or registry publication. Consumer execution requires separate installation approval.

All parameters below have string type. JSON inputs have an 8192-character limit. Task scripts validate allowed fields and reject shell fragments as executable input. Registry operations use HTTPS and Docker auth from `/tekton/home/.docker/config.json`, or the `DOCKER_CONFIG` directory. Docker credential helpers, identity tokens, and cross-host bearer-token endpoints fail closed. Config-blob reads allow at most three HTTPS storage redirects without forwarding registry credentials. Other redirects fail. No Task creates an application `latest` alias.

### `service-build-v1`

| Parameter | Contract |
| --- | --- |
| `repository` | Untagged registry/repository |
| `revision` | Exactly 40 lowercase hexadecimal characters |
| `arch` | `amd64` or `arm64` |
| `builder-address` | `tcp://HOST:PORT`; caller selects the native builder |
| `context` | Workspace-relative build context; default `.` |
| `dockerfile` | Context-relative regular Dockerfile; default `Dockerfile` |
| `target` | Required named stage; test targets fail |
| `revision-arg` | `REVISION` default, or `OCI_REVISION` |
| `expected-user` | `65532:65532`, `10001:10001`, or `node` |

Workspace `source` is required. Optional read-only workspace `git-credentials` requires a Secret binding. Files `.gitconfig` and `.git-credentials` become BuildKit secret mounts `gitconfig` and `git-credentials`. Files `GIT_AUTH_TOKEN` and `GIT_AUTH_HEADER` use matching secret IDs. Credentials never become build arguments.

Result `image` contains `repository@sha256:DIGEST`. Result `platform` contains `linux/ARCH`. The Task copies the client from the consumer-pinned `docker.io/moby/buildkit:v0.26.3@sha256:5601811fde88bb9e8a577bfe804af82bccb712e1cd07ff94663bded5e628cf75` into a pod-local tool volume. The execution step uses `general-ci:latest` with `Always`.

BuildKit publishes by digest. The Task checks actual config architecture, OS, revision label, and user, then creates `<SHA>-<arch>`. A verified current architecture alias serves retries without another build. The caller owns checkout integrity and native builder selection.

### `service-manifest-v1`

Parameters: `repository`, `revision`, `expected-user`, and `sources`. Repository, revision, and user follow the build contract. No workspace is required. Result `image` contains the immutable joined index.

`sources` contains an explicit immutable array in amd64, arm64 order:

```json
[
  {"arch":"amd64","image":"registry.example/org/app@sha256:AMD64_DIGEST"},
  {"arch":"arm64","image":"registry.example/org/app@sha256:ARM64_DIGEST"}
]
```

The placeholders require actual 64-character lowercase digests. Every image must use the supplied repository. Only Faktory visual-renderer uses the explicit one-entry amd64 array. Metadata checks compare exact descriptor media types, sizes, platforms, user, and revision. The Task publishes `repository:<SHA>` without another architecture-alias lookup.

### `service-promote-v1`

Parameters: `revision`, `version`, and `images`. Version accepts stable `vX.Y.Z`, without prerelease, build metadata, or leading zeroes. No workspace is required. Result `images` contains a JSON object whose keys identify Pulumi image configuration.

`images` contains one through three entries:

```json
[
  {"key":"image","repository":"registry.example/org/app","platforms":["amd64","arm64"],"user":"65532:65532"},
  {"key":"visualRendererImage","repository":"registry.example/org/renderer","platforms":["amd64"],"user":"node"}
]
```

Keys and repositories must be unique. Each source is `repository:<SHA>`. The Task resolves every source once and verifies all sources before any publication. It also prechecks all destination version tags before the first write. A structured `MANIFEST_UNKNOWN` 404 permits creation; auth, network, and other registry errors fail.

Copies preserve the source index bytes and digest. The Task verifies destination digests and returns immutable references. Same-digest destinations pass; conflicts fail. Multi-repository publication is not atomic. A restart accepts identical completed aliases and completes absent aliases after the full precheck. Registry immutable-tag protection or exclusive writers must protect against external concurrent writers; OCI Distribution has no conditional tag-create operation.

### `service-pulumi-up-v1`

| Parameter | Contract |
| --- | --- |
| `source-subdir` | Required workspace-relative program directory |
| `stack` | Explicit Pulumi stack |
| `image-config` | JSON object with one through three config keys and immutable image values |
| `authentik-enabled` | `true` or `false`; default `false` |
| `grafana-enabled` | `true` or `false`; default `false` |
| `openbao-enabled` | `true` or `false`; default `false`; exclusively homelab preview |

Workspace `source` is required. There are no Results. The Task guards Bun `1.3.5` and Pulumi `v3.253.0`, then runs frozen dependency installation. It invokes `pulumi up --stack STACK --yes --skip-preview` with one `--config KEY=IMMUTABLE_IMAGE` argument per map entry.

| Fixed credential source | Keys and behavior |
| --- | --- |
| Secret `tekton-cluster-kubeconfig` | Key `kubeconfig`; read-only `/etc/kubeconfig/kubeconfig` |
| Secret `pulumi-credentials` | `PULUMI_CONFIG_PASSPHRASE`, `PULUMI_BACKEND_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; required |
| Secret `authentik-credentials` | `AUTHENTIK_URL`, `AUTHENTIK_TOKEN`; optional references; enable flag requires both |
| Secret `grafana-credentials` | `GRAFANA_URL`, `GRAFANA_TOKEN`; optional references; enable flag requires both |

Disabled optional flags remove those credentials before subprocess execution. Grafana retains `GRAFANA_URL` and translates `GRAFANA_TOKEN` to `GRAFANA_AUTH`. There is no arbitrary `envFrom`, secret-name, or script parameter.

Only the homelab preview consumer enables OpenBao. Its PipelineRun uses `taskRunSpecs` to select `taskServiceAccountName: openbao-pulumi-admin-v1` for this Task. An authority guard requires that ServiceAccount and `stack: preview` before the login StepAction. Standard consumers retain their non-admin identity and leave OpenBao disabled.

The fixed StepAction role is `openbao-pulumi-admin-v1`; the exact policy is `openbao-pulumi-admin`; the maximum accepted lease is 1800 seconds. The Task projects audience `openbao-pulumi-admin-v1` into `openbao-ci-jwt`. A memory-backed `openbao-ci-session` volume holds the fixed token path. The script clears inherited `BAO_*` and `VAULT_*` values, then guards token mode, length, and whitespace. It reads the token after dependency installation. It removes the token and memory-backed CLI homes on exit. No JWT or token enters a workspace, Result, or log. This Task adds no ServiceAccount, role, or policy.

### Consumer Composition

Every independent image/platform build runs concurrently. Separate amd64 and arm64 Tasks can select different builder addresses without an accidental matrix Cartesian product. A caller can also use one architecture matrix per image when its builder selection preserves that association.

```yaml
matrix:
  params:
    - name: arch
      value: [amd64, arm64]
```

A matrix consumer must pair each immutable image Result with its platform Result. It must not reconstruct mutable architecture aliases. A caller with explicit build Tasks can supply manifest `sources` directly:

```yaml
- name: sources
  value: >-
    [{"arch":"amd64","image":"$(tasks.build-amd64.results.image)"},
     {"arch":"arm64","image":"$(tasks.build-arm64.results.image)"}]
```

Main deploys consume immutable manifest Results:

```yaml
- name: image-config
  value: >-
    {"image":"$(tasks.manifest-app.results.image)",
     "companionImage":"$(tasks.manifest-companion.results.image)"}
```

Stable-tag deploys pass `$(tasks.promote.results.images)` directly as `image-config`. Promotion entry keys must match the program's image config keys. Six services use main-preview and tag-prod; Codex and Claude proxies retain main-prod only. Repository checkout, scans, signed-tag trust, and repository-specific version validation remain consumer-local. Common build, index, promotion, and Pulumi mechanisms use shared `taskRef` names.

Local fixtures can verify protocol and command behavior without a registry or cluster. They do not prove native image execution, registry compatibility, or live Task admission.

## BuildKit

[`programs/buildkit/Pulumi.pantheon.yaml`](../../programs/buildkit/Pulumi.pantheon.yaml) selects Artemis for the amd64 builder and Mars for the arm64 builder. Their node-local hostPath caches are `/var/lib/buildkit-cache/amd64` and `/var/lib/buildkit-cache/arm64`. [`programs/buildkit/index.ts`](../../programs/buildkit/index.ts) constructs and exports both architecture-specific service endpoints through the same component path.

[`src/components/buildkit.ts`](../../src/components/buildkit.ts) creates one-replica StatefulSets backed by those hostPath caches. Each BuildKit daemon holds `buildkitd.lock` for its cache lifetime, so node maintenance must terminate the pinned builder cleanly before K3s restarts.

# Deployment Verification

Source inspection establishes tracked configuration only. The dated recovery evidence below records separately authorized live inspection and mutation.

## 2026-07-29 BuildKit Recovery Evidence

- Both Pantheon BuildKit pods entered `CrashLoopBackOff` after K3s maintenance. Each new daemon failed to acquire its node-local `buildkitd.lock` because an old BuildKit process and detached containerd shim survived outside the current CRI task inventory.
- The amd64 orphan on Artemis and arm64 orphan on Mars were separately identified through their process ancestry, sandbox labels, pod identity, cache lock ownership, and absence from current CRI records. Cache filesystems had ample capacity and were not the cause.
- Recovery scaled one StatefulSet to zero at a time, waited for current pod deletion, sent `SIGTERM` only to the verified orphan BuildKit daemon, confirmed the cache lock was free, terminated the detached shim, and restored one replica. No cache data or lock file was deleted.
- Both pods returned ready with zero restarts. Direct and Service-address `buildctl debug workers` checks returned the expected amd64 and arm64 workers. The retained caches measured 992 MiB and 12 GiB respectively.
- PipelineRun `kuri-preview-dmxnx` had failed both architecture tasks with BuildKit Service connection refusals before recovery. It was not rerun as part of infrastructure recovery.

## CI Toolchain Verification

Local contract checks cover source and verifier behavior, not actual image contents:

- Five native CI contract tests passed with source assertions and mock tools. These cover final-stage verifier execution, version drift, absent components or targets, and ALSA probe failures.
- Four protobuf contract tests passed. These compare General CI plugin pins with Kuri's preflight and exercise accepted, mismatched, and absent tools.
- Local plugin metadata confirms generator versions 0.5.0. Cached plugin locks use Prost 0.14.1 and Tonic 0.14.2; runtime crate versions do not identify generator versions.
- An offline regeneration check used local Buf 1.73.0, not the image's Buf 1.47.2. Eighteen of 24 generated files matched exactly; six differed only in Prost attribute `=` spacing.
- A comparison that normalized only that spacing matched all 25 committed files, including `mod.rs`. This does not establish raw byte-exact regeneration.

| Concern | Local evidence | Verification still required |
| --- | --- | --- |
| Native CI image execution | Final Dockerfiles invoke their verifiers; mock-backed checks pass | Build each image and execute real package, SDK, compiler, and linker assertions |
| General CI protobuf generation | Exact plugin pins and preflight agree; local regeneration differs only in attribute spacing | Regenerate with the image's Buf 1.47.2 and pinned plugins; compare raw committed bytes |
| Image publication and adoption | Tracked pipelines and the visible Kuri release consumer retain their references | Separate publication approval, a verified image digest, and consumer-specific validation before adoption |
| Older native image consumers | This repository defines `rust-ci`, `android-ci`, and `tauri-e2e-ci` | Inventory external consumers before a compatibility claim |

No image build, registry check, SDK assertion, publication, or release retry forms part of this local verification. Historical publication evidence below does not validate these toolchain changes.

## Focused Image And AppImage Verification

- Rust/web source and mock-backed checks passed: eight tests, with the functional fixture test skipped by default.
- The opt-in functional run passed all nine tests with host Rust 1.96.0 and wasm-bindgen CLI 0.2.122. Host Node.js was 26.9.0, not image-pinned 24.18.0.
- Five browser image contract tests and three Kuri launcher tests passed without an image build or browser launch.
- Nineteen AppImage fixture tests passed. These cover the actual extracted main dependency closure and conditional ALSA resolution, not a real release artifact.

| Concern | Local evidence | Verification still required |
| --- | --- | --- |
| Rust/web native image contract | Source checks and actual host fixture/glue execution pass | Build and verify both native image architectures with their pinned Node.js and full toolchain |
| Rust/web publication and Kuri adoption | Pipeline returns a unique multi-architecture digest; Kuri retains current Dockerfile provisioning | Separately approved publication, verified digest, and later consumer adoption with unchanged runtime ABI/cache contracts |
| Browser image and sandbox | Source and mock-backed contract tests pass; candidate verification uses restricted amd64 execution | Build the image and launch sandboxed Chromium on the intended kernel with `RuntimeDefault` seccomp; fail closed if incompatible |
| Browser consumer adoption | Kuri provides an opt-in offline launcher; current CI does not adopt it | Verify repository dependencies, writable UID/GID `10001:10001` checkout/cache, shared memory, and actual harness execution |
| AppImage builder resolution | Fixture tests cover main ELF links and ALSA provider reports | Confirm required commands inside the actual builder and inspect a real release AppImage |
| AppImage runtime acceptance | The link check resolves through builder-host libraries as well as bundled libraries | Test supported target systems, startup, dynamic plugins, device access, Wayland, permissions, and audio separately |

No local result authorizes publication, consumer adoption, or an RC retry. No current image digest or successful external build follows from these checks.

## Open Verification

| Concern | Tracked or historical evidence | Verification still required |
| --- | --- | --- |
| Deployer CronJob RBAC | [`src/components/tekton.ts`](../../src/components/tekton.ts) includes `jobs` and `cronjobs` with the intended verbs | Render or query each configured cluster before claiming the live role is current |
| PAC repository enrollment | Pantheon configuration contains `rfhold/kokoro-server`, `rfhold/whisperx-server`, `rfhold/smarthome-mcp`, and `rfhold/esp-wifi-cam`; it omits the replaced `rfhold/kokoro` and `rfhold/whisperx` names. The component creates one PAC resource per configured repository. The 2026-09-06 evidence below confirms the ESP repository resource after apply. | Confirm webhook delivery with the first `rfhold/esp-wifi-cam` PipelineRun. |
| OpenBao administration attachment | Tracked source assigns the backend, configuration, TokenReview delegation, and policy to the [OpenBao program](../../programs/openbao/index.ts), and the ServiceAccount plus role attachment to the [Tekton program](../../programs/tekton/index.ts). OpenBao-owned resources and recovery-key denies were applied and checked on 2026-08-16. On 2026-08-17, exact inventory found the Tekton identity and role absent. The reviewed `tekton/pantheon` preview was create-only: a stack-local Vault provider `7.11.0` targeting the canonical OpenBao URL with `skipChildToken: true`, ServiceAccount `pipelines-as-code/openbao-pulumi-admin-v1` with automatic token mounting disabled, and AuthBackendRole `openbao-pulumi-admin-v1`; 257 resources were unchanged, with no deletion, replacement, or unrelated change. The role bound the exact backend, ServiceAccount, namespace, and audience; attached only `openbao-pulumi-admin` without `default`; and selected 1800-second TTL and maximum TTL with batch tokens. Apply completed in 15 seconds with three created and 257 unchanged. Exact reads confirmed both resources, and the final no-change preview returned 260 unchanged. Guarded canaries verified a non-renewable 1800-second batch token with exactly the administrator policy, broad management capabilities, the complete documented deny set, wrong-audience rejection, and rejection of unbound existing ServiceAccount `pipelines-as-code/pac-pruner`; no JWT or token was printed, and cleanup ran. | The shared platform attachment is deployed and verified. Repository PipelineRuns, including `homelab-mcp`, have not selected the ServiceAccount, projected the exact audience, or logged in, so application use remains unverified. |
| OpenBao Kubernetes login StepAction | Pinned Tekton Pipelines v1.10.1 release source includes the `tekton.dev/v1beta1` StepAction CRD plus controller and webhook support. A read-only live CRD query on 2026-08-17 returned storage version `v1beta1`. Server-side dry-runs first rejected unsupported `imagePullPolicy` and then fixed `volumeMount` names; tracked source removed the unsupported field and supplies both volume names through parameters with conventional defaults while retaining fixed same-pod token-file paths. The corrected manifest passed server-side admission. The reviewed `tekton/pantheon` preview contained only the StepAction create with 260 resources unchanged, apply completed in 12 seconds with the same result, an exact read confirmed the expected API version, image, and parameterized mounts, and the final no-change preview returned 261 unchanged. | The shared StepAction is deployed and converged. No consuming Task or PipelineRun uses it, so projected-audience wiring, memory `emptyDir` wiring, OpenBao login, and same-pod Pulumi token use remain unverified. |
| CI helper publication | Dockerfiles and path-filtered Tekton pipelines exist. The 2026-09-06 evidence below confirms a successful multi-architecture `general-ci` publication after runtime checks. | Consumer builds must still validate each required tool against their own source and target. |
| Application image publication | Three GitHub workflows are manual-only; no publishing workflow references `docker/vllm/` | Inspect workflow runs and registries only with explicit authorization |
| BuildKit pipeline recovery | Both builders and service paths were healthy after targeted recovery, but the failed `kuri-preview-dmxnx` run was not retried | Rerun or replace the failed build only under separate pipeline-dispatch approval |

## 2026-08-16 Certificate RBAC Evidence

- An authorized `tekton/pantheon` apply updated only the `tekton-deployer` ClusterRoles on Romulus and Pantheon; 255 resources were unchanged.
- Impersonated authorization checks on both clusters confirmed that the deployer can create and delete namespaced cert-manager Certificates, can get ClusterIssuers, and cannot create ClusterIssuers.
- A subsequent `ftp-to-immich` production PipelineRun created its Certificate and Deployment successfully, confirming the Pantheon deployment path can use the permission.

## Historical Build Evidence

Lifecycle records report successful local Bun CI and Tauri E2E CI image builds on 2026-05-13 and 2026-05-21. Those point-in-time results do not prove that current Dockerfiles build or that published tags contain those builds.

## 2026-09-06 ESP Release Preparation Evidence

- An authorized `tekton/pantheon` apply created PAC Repository `pac-rfhold-esp-wifi-cam`, updated the existing Forgejo publication policy, added the ESP signing contract output, and left 269 resources unchanged.
- A live read confirmed that `pac-rfhold-esp-wifi-cam` targets `https://git.holdenitdown.net/rfhold/esp-wifi-cam`. The resource reported no status conditions; the first repository webhook remains the end-to-end enrollment test.
- PipelineRun `homelab-build-general-ci-n7578` exposed one incorrect Rust version assertion after both architecture builds installed the ESP tools. Commit `3d6d4f8` corrected only that assertion.
- PipelineRun `homelab-build-general-ci-lbzfp` then built and verified amd64 and arm64 images and created the multi-architecture manifest. It succeeded at revision `3d6d4f885f0bc8349415e550b596d3662d4a9e99` on 2026-09-06 at 17:49:42 UTC.

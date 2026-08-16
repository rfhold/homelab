# Deployment Verification

Source inspection establishes tracked configuration only. The dated recovery evidence below records separately authorized live inspection and mutation.

## 2026-07-29 BuildKit Recovery Evidence

- Both Pantheon BuildKit pods entered `CrashLoopBackOff` after K3s maintenance. Each new daemon failed to acquire its node-local `buildkitd.lock` because an old BuildKit process and detached containerd shim survived outside the current CRI task inventory.
- The amd64 orphan on Artemis and arm64 orphan on Mars were separately identified through their process ancestry, sandbox labels, pod identity, cache lock ownership, and absence from current CRI records. Cache filesystems had ample capacity and were not the cause.
- Recovery scaled one StatefulSet to zero at a time, waited for current pod deletion, sent `SIGTERM` only to the verified orphan BuildKit daemon, confirmed the cache lock was free, terminated the detached shim, and restored one replica. No cache data or lock file was deleted.
- Both pods returned ready with zero restarts. Direct and Service-address `buildctl debug workers` checks returned the expected amd64 and arm64 workers. The retained caches measured 992 MiB and 12 GiB respectively.
- PipelineRun `kuri-preview-dmxnx` had failed both architecture tasks with BuildKit Service connection refusals before recovery. It was not rerun as part of infrastructure recovery.

## Open Verification

| Concern | Tracked or historical evidence | Verification still required |
| --- | --- | --- |
| Deployer CronJob RBAC | [`src/components/tekton.ts`](../../src/components/tekton.ts) includes `jobs` and `cronjobs` with the intended verbs | Render or query each configured cluster before claiming the live role is current |
| PAC repository enrollment | Pantheon configuration contains `rfhold/kokoro`, `rfhold/whisperx`, and `rfhold/smarthome-mcp`, and the component creates one PAC resource per configured repository | Verify the live PAC resources and webhook discovery before claiming enrollment is operational |
| CI helper publication | Dockerfiles and path-filtered Tekton pipelines exist | Verify current pipeline success and registry availability before directing consumers to either `latest` tag |
| Application image publication | Three GitHub workflows are manual-only; no publishing workflow references `docker/vllm/` | Inspect workflow runs and registries only with explicit authorization |
| BuildKit pipeline recovery | Both builders and service paths were healthy after targeted recovery, but the failed `kuri-preview-dmxnx` run was not retried | Rerun or replace the failed build only under separate pipeline-dispatch approval |

## 2026-08-16 Certificate RBAC Evidence

- An authorized `tekton/pantheon` apply updated only the `tekton-deployer` ClusterRoles on Romulus and Pantheon; 255 resources were unchanged.
- Impersonated authorization checks on both clusters confirmed that the deployer can create and delete namespaced cert-manager Certificates, can get ClusterIssuers, and cannot create ClusterIssuers.
- A subsequent `ftp-to-immich` production PipelineRun created its Certificate and Deployment successfully, confirming the Pantheon deployment path can use the permission.

## Historical Build Evidence

Lifecycle records report successful local Bun CI and Tauri E2E CI image builds on 2026-05-13 and 2026-05-21. Those point-in-time results do not prove that current Dockerfiles build or that published tags contain those builds.

# Deployment Verification

Source inspection establishes tracked configuration only. No CI dispatch, registry query, Pulumi operation, or cluster query was performed for this documentation conversion.

## Open Verification

| Concern | Tracked or historical evidence | Verification still required |
| --- | --- | --- |
| Grafana alert trigger scope | [`.tekton/grafana-alert-rules.yaml`](../../.tekton/grafana-alert-rules.yaml) uses `.tekton/**`, so any Tekton-file change can trigger reconciliation; the contract permits only the reconciliation definition and alert-rule changes | Narrow the source trigger or explicitly revise the contract; then inspect a PAC event result |
| Deployer CronJob RBAC | [`src/components/tekton.ts`](../../src/components/tekton.ts) includes `jobs` and `cronjobs` with the intended verbs | Render or query each configured cluster before claiming the live role is current |
| PAC repository enrollment | Pantheon configuration contains `rfhold/kokoro` and `rfhold/whisperx`, and the component creates one PAC resource per configured repository | Verify the live PAC resources and webhook discovery before claiming enrollment is operational |
| CI helper publication | Dockerfiles and path-filtered Tekton pipelines exist | Verify current pipeline success and registry availability before directing consumers to either `latest` tag |
| Application image publication | Three GitHub workflows are manual-only; no publishing workflow references `docker/vllm/` | Inspect workflow runs and registries only with explicit authorization |
| BuildKit placement | Source selects Artemis and the lifecycle record dated 2026-05-27 reported a successful rollout on Artemis | Query the current StatefulSet and pod before treating that historical result as current state |

## Historical Build Evidence

Lifecycle records report successful local Bun CI and Tauri E2E CI image builds on 2026-05-13 and 2026-05-21. Those point-in-time results do not prove that current Dockerfiles build or that published tags contain those builds.

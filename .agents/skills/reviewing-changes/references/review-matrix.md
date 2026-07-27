# Review Matrix

Apply the common rows, then the rows matching the changed paths. Links in this file resolve from the reference file to repository authority.

## Common Checks

| Concern | Inspect | Review requirement |
| --- | --- | --- |
| Comparison | Requested base, merge relationship, tracked diff, staged diff, unstaged files, untracked files | Name the base and include every state in scope; do not substitute the latest commit for a branch or worktree review. |
| Instructions | Root and nearest scoped `AGENTS.md` files | Apply all governing rules by path and call out cross-boundary changes. |
| Contract agreement | Affected feature `README.md`, `spec/`, implementation, operations, verification, source, and tests | Report source-contract drift and claims that confuse desired, tracked, historical, or live state. |
| Evidence | Relevant local checks and specifically authorized read-only inspections | State what each check covers and record required checks that did not run as not verified. |
| Secrets and mutation | Stack files, logs, examples, automation, scripts, operational docs | Reject exposed values and unattended preview, apply, deployment, restart, workflow, publication, commit, push, or external-mutation paths. |

## Path Routing

| Changed path | Authority and adjacent surfaces | Repository-specific review focus |
| --- | --- | --- |
| `programs/**` | [`programs/AGENTS.md`](../../../../programs/AGENTS.md), owning `Pulumi.yaml`, stack file, entry point, consumed `src/` layers | Program target, provider, config, outputs, `StackReference` contracts, secrets, and replacements. Root typecheck excludes `programs/**`; never cite it as entry-point coverage. `programs/media-server/` is a separate submodule and repository boundary. |
| `src/adapters/**` | [`src/adapters/README.md`](../../../../src/adapters/README.md), all consumers | Shared type shape, `Input`/`Output` and secret propagation, defaults, encoding, and boundary-resource ownership. |
| `src/components/**` | [`src/components/README.md`](../../../../src/components/README.md), modules and programs | Parentage, child dependencies, providers, focused input surface, type tokens, logical names, outputs, and replacement behavior. |
| `src/modules/**` | [`src/modules/README.md`](../../../../src/modules/README.md), consuming programs | Cross-component ordering, policy ownership, stable arguments and handles, and incidental-detail leakage. |
| `src/helm-charts.ts`, `src/docker-images.ts` | Every catalog consumer and affected feature contract | Pin ownership, repository or registry source, application-versus-chart distinction, architecture support, and coordinated consumers. |
| `packages/authentik-provider/**` | [`packages/authentik-provider/AGENTS.md`](../../../../packages/authentik-provider/AGENTS.md), root local dependency | `Pulumi.yaml` is the generation input; `sdks/authentik/` is generated and must not be hand-edited. Generation and installation need separate authorization. |
| `.tekton/**` | [`.tekton/AGENTS.md`](../../../../.tekton/AGENTS.md), invoked task, script, context, and Pulumi owner | Joint trigger/filter/task behavior, secret substitutions, publishing or reconciliation effects, and interface changes. The checked-in PR validation currently only lists files, so a run is not test, type, lint, or render evidence. |
| `.github/workflows/**`, `docker/**` | Workflow triggers, Docker context, image guide, catalog consumers | Release side effects, version/tag consistency, build context, architecture, and whether the workflow actually covers the image class. |
| `grafana/**` | [`docs/observability/spec/alerting.md`](../../../../docs/observability/spec/alerting.md), guarded operations | `grafana/alert-rules/` is the version-controlled authority. Review deletion as remote deletion on successful reconciliation; do not infer current Grafana state or mutate it. |
| `docs/**` | [`docs/AGENTS.md`](../../../../docs/AGENTS.md), [`docs/quality/documentation.md`](../../../../docs/quality/documentation.md) | Authority labels, indexes, links, current source support, no secret output, and explicit unresolved verification. |
| `deploys/**` | Nearest guidance and installed PyInfra skill | Idempotence, host scope, facts, check limitations, secret handling, and explicit deployment authorization. |
| `.opencode/**`, `.agents/skills/**`, `opencode.jsonc` | [`.opencode/AGENTS.md`](../../../../.opencode/AGENTS.md), Agent Skills or OpenCode schema | Treat Markdown as behavior, preserve approval gates, check discovery and links, and require restarted-session validation where applicable. |

## Kubernetes And Pulumi Checks

| Surface | Check |
| --- | --- |
| Typed propagation | Follow config through program, module, component, adapter, and rendered resource; update every public interface and consumer. |
| Pulumi values | Preserve `Input` and `Output` semantics, secret taint, parentage, providers, dependencies, aliases, protection, and replacement behavior. |
| Labels | Apply the [`workload-labels` contract](../../../../docs/kubernetes-workloads/spec/workload-labels.md) to resource metadata and pod templates without overriding existing labels. |
| Routing and storage | Compare routes, hostnames, namespaces, classes, claims, access modes, and durable-state changes with the owning feature specifications. |
| Validation | [`docs/quality/testing.md`](../../../../docs/quality/testing.md) defines local and credentialed evidence boundaries. Preview is external access and is never apply authorization. |

## Severity And Evidence

Order concrete findings by impact: behavior or safety defects first, then contract and maintainability defects that can cause future failures. Do not inflate style preferences into findings.

Every finding must answer:

- What exact behavior is wrong or unsafe?
- Under what changed path or execution condition does it occur?
- What is the user, infrastructure, security, or maintenance consequence?
- Which precise `path:line` location best identifies the defect?

After findings, identify validation omissions, inaccessible external evidence, uncertain live state, and assumptions separately. Absence of live inspection is a not-verified risk, not automatically a defect.

# Ownership And Validation Matrix

Use this matrix to select one owner before editing. Links resolve from this reference file to repository authority.

## Ownership Routing

| Concern | Owning layer | Required propagation |
| --- | --- | --- |
| Environment value, stack selection, cluster target, provider instance, top-level composition, exported output | Owning `programs/<project>/` entry point and `Pulumi.<stack>.yaml` | Parse configuration with an explicit type, pass it to reusable layers, and preserve exported output names or update every `StackReference` consumer. |
| Cross-component orchestration, shared capability policy, implementation selection, dependency order | [`src/modules/`](../../../../src/modules/README.md) | Update stable module arguments, handles, outputs, and all consuming programs without leaking incidental child construction. |
| Cohesive reusable provider-resource graph and implementation defaults | [`src/components/`](../../../../src/components/README.md) | Update focused arguments, child parentage, registered outputs, resource-level dependencies, and module or program consumers. |
| Shared connection, storage, webhook, or stack-reference shape and derived value | [`src/adapters/`](../../../../src/adapters/README.md) | Preserve `Input`/`Output` and secret behavior, update all layer consumers, and keep complete service orchestration out. |
| Shared Helm chart name, repository, or version | [`src/helm-charts.ts`](../../../../src/helm-charts.ts) | Confirm every consumer uses the catalog and distinguish chart version from rendered application version. |
| Shared container image reference | [`src/docker-images.ts`](../../../../src/docker-images.ts) | Confirm architecture, tag or digest policy, build ownership, and every consuming component or program. |
| Focused custom provider lifecycle or API mapping | `src/providers/` | Keep provider-specific semantics here, preserve secret inputs and resource identity, and update the component, module, or program that owns composition. |
| Generated Authentik provider schema or version | [`packages/authentik-provider/Pulumi.yaml`](../../../../packages/authentik-provider/Pulumi.yaml) | Do not edit generated SDK files; generation and installation are separate, explicitly authorized operations. |

If two layers appear to own the same choice, prefer the layer already responsible for that policy. Do not introduce a new abstraction merely to avoid a small owning-layer edit.

## Kubernetes Concern Routing

| Change | Inspect together | Preserve or prove |
| --- | --- | --- |
| Generic labels | [`docs/kubernetes-workloads/spec/workload-labels.md`](../../../../docs/kubernetes-workloads/spec/workload-labels.md), config type, reusable arguments, chart transformations, controller templates | Supplied labels reach resource metadata and pod-template metadata; existing labels win; omission changes nothing. |
| Container resources | Owning stack config, program config type and arguments, reusable component input, rendered container `resources`, node selectors, affinity, tolerations, and runtime class | Keep workload-specific requests and limits in the owning stack, propagate them without loss, and verify extended resources such as GPUs remain compatible with scheduling. Omitted values must preserve existing behavior rather than invent defaults. |
| Route or hostname | Edge-networking specs, Gateway or route resource, Service port, certificate and ExternalDNS behavior | Namespace references, listener and parent names, hostnames, ports, TLS ownership, and DNS effects remain consistent. |
| Storage | Storage feature specs, PVC or chart values, storage class, access mode, mount, retention, backup assumptions | Capacity and class changes are intentional; durable data is not replaced or orphaned unexpectedly. |
| Secret | Secrets-management specs, Pulumi config, adapter, Kubernetes Secret, consuming workload | Values remain secret-tainted and absent from source, logs, ConfigMaps, non-secret outputs, and previews captured as evidence. |
| Chart values | Catalog pin, component wrapper, chart values, generated resources described by the chart contract | Values are at the correct chart path and preserve service identity, selectors, persistence, and dependencies. |
| Image pin | Image catalog, architecture, component, deployment strategy, image builder when repository-owned | The pin is reproducible and compatible with the target architecture and workload contract. |
| Dependency | Producer resource, consumer input, `dependsOn`, parent/provider inheritance, cross-stack contract | Dataflow or explicit ordering exists where Kubernetes readiness or CRD availability requires it. |
| Rendered resource identity | Logical name, Kubernetes metadata name, namespace, aliases, protect/retain/delete behavior | Replacement and deletion consequences are understood and limited to the approved contract. |

## Pulumi Semantics

| Semantics | Requirement |
| --- | --- |
| Inputs and outputs | Accept `pulumi.Input<T>` where values can be deferred. Transform with `pulumi.output`, `pulumi.all`, interpolation, or `apply` without forcing deployment-time values into planning-time code. |
| Secrets | Preserve secret taint through transformations and outputs. Do not stringify or log secret values. |
| Parentage | Parent reusable children to their component or module and retain provider inheritance unless a deliberate provider boundary is required. |
| Dependencies | Prefer actual input/output edges; retain explicit `dependsOn` where availability, CRDs, controller ordering, or side-effectful resources require it. |
| Public contracts | Treat component and module arguments, public properties, registered outputs, type tokens, logical names, and stack output names as migration-sensitive. |
| Replacement | Inspect metadata names, immutable Kubernetes fields, aliases, protection, retention, and provider changes before accepting a replacement. |

## Validation Matrix

| Scope | Local evidence | Limitation |
| --- | --- | --- |
| Shared `src/**` TypeScript | `bun run typecheck` when dependencies are already available and the changed source is included | Root [`tsconfig.json`](../../../../tsconfig.json) includes `src/**` and `stacks/**`, not `programs/**`. |
| Workload-label propagation | Inspect the shared helper, changed program entry points, and affected stack configuration | Source inspection does not prove provider rendering or cluster state. |
| Program entry point | Source inspection of imports, config types, calls, and outputs plus any existing program-specific local check. Parse changed stack YAML without Pulumi or infrastructure access: `bun -e 'import { parse } from "yaml"; import { readFileSync } from "node:fs"; for (const file of Bun.argv.slice(2)) parse(readFileSync(file, "utf8"));' programs/<project>/Pulumi.<stack>.yaml` | YAML parsing proves syntax only. A passing root typecheck is not evidence for `programs/**`; do not invent coverage. |
| Documentation and whitespace | Resolve changed relative links and run a scoped whitespace check | This does not prove Pulumi resource semantics or live behavior. |
| Affected stack | Separately authorized `pulumi preview` for the explicitly identified project, stack, backend, provider, and target | Preview contacts external systems, can expose operational context, and never authorizes apply. Record replacement, deletion, secret, and unknown-value risks without capturing sensitive output. |

Do not broaden a preview to unrelated stacks for confidence. If target authorization or safe credentials are unavailable, record preview and rendered-resource behavior as not verified.

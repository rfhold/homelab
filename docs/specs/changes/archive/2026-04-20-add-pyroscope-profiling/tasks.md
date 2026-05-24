# Tasks: add-pyroscope-profiling

**Status**: draft

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `observability` ADDED: `Production Profiling Backend` | 1.1, 2.1 |
| `observability` ADDED: `Alloy-Mediated Profile Ingestion` | 2.1 |
| `observability` ADDED: `Supported SDK Profiling Runtimes` | 2.1, 3.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Do not add code comments unless explicitly requested. Follow neighboring file patterns, check imports before using libraries, avoid exposing secrets, and specify return types for public functions.
- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Use Bun for package and script commands. Prefer existing Pulumi and component patterns over refactoring.
- No deeper `AGENTS.md` files exist under `docs/specs/`, `src/`, `src/components/`, `src/modules/`, or `programs/grafana/`.

---

## Stage 1: Pyroscope Component

### Task 1.1: Add the Pyroscope component and chart metadata

- **Implements**: `observability` ADDED Requirement: `Production Profiling Backend`
- **Depends on**: (none)
- **Files**: `src/helm-charts.ts`, `src/components/pyroscope.ts`
- **Approach**: Add the Pyroscope Helm chart registry entry and create a dedicated component modeled on the existing distributed observability components. The component should encapsulate S3-backed Pyroscope deployment defaults, expose read and write endpoints, and follow existing secret injection patterns for object storage credentials.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: TypeScript completes successfully with no errors after adding the new component and Helm chart entry.
- **Evidence artifact**: inline in this stage's Evidence block.

### Evidence

- **Date**: 2026-04-20
- **Commands**:
  ```
  bun run typecheck
  ```
- **Output**:
  ```
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `src/helm-charts.ts`
  - `src/components/pyroscope.ts`
- **AGENTS.md notes applied**: `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Do not add code comments unless explicitly requested"; `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Follow neighboring file patterns, check imports before using libraries, avoid exposing secrets, and specify return types for public functions"; `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Use Bun for package and script commands. Prefer existing Pulumi and component patterns over refactoring."
- **Subagent statuses**:
  - Task 1.1: DONE
- **Concerns**: none

- [x] Stage 1 complete

---

## Stage 2: Stack Wiring

### Task 2.1: Wire Pyroscope through the Grafana stack and Alloy gateway

- **Implements**: `observability` ADDED Requirement: `Production Profiling Backend`
- **Implements**: `observability` ADDED Requirement: `Alloy-Mediated Profile Ingestion`
- **Implements**: `observability` ADDED Requirement: `Supported SDK Profiling Runtimes`
- **Depends on**: Task 1.1
- **Files**: `src/components/alloy.ts`, `src/modules/grafana-stack.ts`, `programs/grafana/index.ts`
- **Approach**: Extend the Alloy component with a profiling receive-and-forward path, then wire Pyroscope into `GrafanaStack` with Ceph bucket provisioning, datasource creation, namespace creation, and exported endpoints for both the shared profiling ingress and the backend query path. The exported profiling endpoint becomes the supported application-facing contract for Go, Node.js, and Rust SDK integrations.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/grafana -s pantheon --non-interactive
  ```
- **Expected outcome**: TypeScript completes successfully and the Grafana stack preview succeeds, showing the Pyroscope backend, datasource, and Alloy profiling relay changes without compile or configuration errors.
- **Evidence artifact**: inline in this stage's Evidence block.

### Evidence

- **Date**: 2026-04-20
- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/grafana -s pantheon --non-interactive
  ```
- **Output**:
  ```
  $ tsc --noEmit
  Previewing update (pantheon):

  @ previewing update............
   +  kubernetes:core/v1:Namespace pyroscope create
   +  kubernetes:core/v1:Namespace pyroscope create
   ~  homelab:modules:GrafanaStack grafana-stack update [diff: +pyroscope~namespaces]
   +  homelab:components:RookCephObjectStoreUser grafana-stack-pyroscope-user create
   +  kubernetes:ceph.rook.io/v1:CephObjectStoreUser grafana-stack-pyroscope-user-user create
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-mimir-user-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-tempo-user-secret
   +  kubernetes:ceph.rook.io/v1:CephObjectStoreUser grafana-stack-pyroscope-user-user create
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-loki-user-secret
   +  homelab:components:RookCephBucket grafana-stack-pyroscope-profiles create
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-mimir-blocks-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-mimir-ruler-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-mimir-alertmanager-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-mimir-blocks-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-mimir-ruler-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-mimir-alertmanager-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-mimir-user-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-tempo-user-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-tempo-traces-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-tempo-traces-secret
   +  kubernetes:objectbucket.io/v1alpha1:ObjectBucketClaim grafana-stack-pyroscope-profiles-bucketclaim create
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-loki-user-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-loki-chunks-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-loki-chunks-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-loki-admin-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-loki-admin-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-loki-ruler-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-loki-ruler-secret
   +  homelab:components:Pyroscope grafana-stack-pyroscope create
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-mimir-alertmanager-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-mimir-blocks-secret
   +  kubernetes:core/v1:Secret grafana-stack-pyroscope-s3-credentials create
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-mimir-ruler-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-mimir-ruler-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-tempo-traces-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-mimir-alertmanager-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-tempo-traces-configmap
   +  kubernetes:helm.sh/v4:Chart grafana-stack-pyroscope-chart create
   +  kubernetes:helm.sh/v4:Chart grafana-stack-pyroscope-chart create warning: Input properties have unknown values. Preview is incomplete.
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-mimir-blocks-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-loki-ruler-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-loki-ruler-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-loki-admin-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-loki-chunks-secret
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:ConfigMap grafana-stack-loki-chunks-configmap
      pulumi:pulumi:Stack grafana-pantheon running read kubernetes:core/v1:Secret grafana-stack-loki-admin-secret
  @ previewing update....
   ~  kubernetes:rbac.authorization.k8s.io/v1:Role grafana-stack-grafana-chart:grafana/grafana-stack-grafana-chart update [diff: +rules]
   ~  kubernetes:rbac.authorization.k8s.io/v1:ClusterRole grafana-stack-grafana-chart:grafana-stack-grafana-chart-clusterrole update [diff: +rules]
   +  grafana:oss:DataSource grafana-stack-datasource-pyroscope create
  @ previewing update......
   ~  homelab:components:Alloy grafana-stack-alloy update [diff: ~telemetryEndpoints]
  @ previewing update....
   -- kubernetes:core/v1:ConfigMap grafana-stack-alloy-chart:alloy/grafana-stack-alloy-chart delete original
   +- kubernetes:core/v1:ConfigMap grafana-stack-alloy-chart:alloy/grafana-stack-alloy-chart replace [diff: ~data]
   ++ kubernetes:core/v1:ConfigMap grafana-stack-alloy-chart:alloy/grafana-stack-alloy-chart create replacement [diff: ~data]
   ~  kubernetes:core/v1:Service grafana-stack-alloy-chart:alloy/grafana-stack-alloy-chart update [diff: ~spec]
   ~  kubernetes:apps/v1:Deployment grafana-stack-alloy-chart:alloy/grafana-stack-alloy-chart update [diff: ~spec]
   ++ kubernetes:core/v1:ConfigMap grafana-stack-alloy-chart:alloy/grafana-stack-alloy-chart create replacement [diff: ~data];
      pulumi:pulumi:Stack grafana-pantheon
  Diagnostics:
    kubernetes:helm.sh/v4:Chart (grafana-stack-pyroscope-chart):
      warning: Input properties have unknown values. Preview is incomplete.

  Outputs:
    + alloyProfilingEndpoint            : "https://telemetry.holdenitdown.net:4040"
    + pyroscopeNamespaceName            : "pyroscope"
    + pyroscopeReadUrl                  : "http://grafana-stack-pyroscope-chart-read.pyroscope:80"
    + pyroscopeWriteUrl                 : "http://grafana-stack-pyroscope-chart-write.pyroscope:80"

  Resources:
      + 9 to create
      ~ 6 to update
      +-1 to replace
      16 changes. 300 unchanged
  ```
- **Files changed (across the stage)**:
  - `src/components/alloy.ts`
  - `src/modules/grafana-stack.ts`
  - `programs/grafana/index.ts`
  - `programs/grafana/Pulumi.yaml`
  - `package.json`
  - `.opencode/package.json`
- **AGENTS.md notes applied**: `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Do not add code comments unless explicitly requested"; `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Follow neighboring file patterns, check imports before using libraries, avoid exposing secrets, and specify return types for public functions"; `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Use Bun for package and script commands. Prefer existing Pulumi and component patterns over refactoring."
- **Subagent statuses**:
  - Task 2.1: DONE_WITH_CONCERNS — initial concerns about Pyroscope service naming and datasource wiring were resolved by stage verification; an unrelated repo-level OpenCode plugin module conflict was fixed by isolating the plugin under `.opencode/` so the exact Pulumi verification command could execute.
- **Concerns**: `pulumi preview` reported the standard Helm chart warning `Input properties have unknown values. Preview is incomplete.` for the new Pyroscope chart, but the preview otherwise succeeded and showed the expected Pyroscope, datasource, and Alloy profiling changes.

- [x] Stage 2 complete

---

## Stage 3: Runtime Integration Guide

### Task 3.1: Document the supported profiling runtime matrix and endpoint usage

- **Implements**: `observability` ADDED Requirement: `Supported SDK Profiling Runtimes`
- **Depends on**: Task 2.1
- **Files**: `docs/research/pyroscope.md`
- **Approach**: Add an operator-facing guide that records the supported SDK paths for Go, Node.js, and Rust against the shared Alloy profiling endpoint, notes the Bun exclusion from the Node.js SDK path, and documents selective adoption for custom applications only.
- **Dispatch**: inline
- **Dispatch rationale**: This is a single bounded documentation update that directly captures the research already established in the coordinator context.

### Stage Verification

- **Commands**:
  ```
  test -f docs/research/pyroscope.md
  rg -n "Go|Node.js|Rust|Bun|Alloy" docs/research/pyroscope.md
  ```
- **Expected outcome**: The runtime guide exists and includes the supported runtime matrix, Bun exclusion, and Alloy endpoint guidance.
- **Evidence artifact**: inline in this stage's Evidence block.

### Evidence

- **Date**: 2026-04-20
- **Commands**:
  ```
  test -f docs/research/pyroscope.md
  rg -n "Go|Node.js|Rust|Bun|Alloy" docs/research/pyroscope.md
  ```
- **Output**:
  ```
  5:The homelab observability stack now exposes continuous profiling for selected custom applications through the shared Alloy gateway on `pantheon`.
  8:- Alloy profiling endpoint: `https://telemetry.holdenitdown.net:4040`
  13:Applications must send profiling traffic to the shared Alloy endpoint. They should not be configured to talk directly to the Pyroscope backend services.
  19:| Go | Supported | CPU, alloc, inuse, goroutine, mutex, block | Use the Grafana Pyroscope Go SDK against the Alloy endpoint. |
  20:| Node.js | Supported | wall, CPU, heap | Use the Grafana Pyroscope Node.js SDK against the Alloy endpoint. CPU collection depends on enabling `wall.collectCpuTime`. |
  21:| Bun | Not supported | none | Bun is not supported by the Node.js SDK path. A separate profiling approach is required before Bun services are added. |
  22:| Rust | Supported | CPU, optional memory | Use the Rust Pyroscope SDK against the Alloy endpoint. Memory profiling depends on allocator integration such as jemalloc. |
  26:Use the shared Alloy profiling endpoint as the SDK server address:
  39:- Bun-based JavaScript services remain out of scope for this SDK path.
  ```
- **Files changed (across the stage)**:
  - `docs/research/pyroscope.md`
- **AGENTS.md notes applied**: `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Do not add code comments unless explicitly requested"; `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Follow neighboring file patterns, check imports before using libraries, avoid exposing secrets, and specify return types for public functions"; `/home/rfhold/repos/rfhold/homelab/AGENTS.md` "Use Bun for package and script commands. Prefer existing Pulumi and component patterns over refactoring."
- **Concerns**: none

- [x] Stage 3 complete

---

## Follow-ups

None.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: none
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

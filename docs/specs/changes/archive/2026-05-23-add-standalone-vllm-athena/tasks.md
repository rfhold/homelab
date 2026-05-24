# Tasks: add-standalone-vllm-athena

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `kubernetes-workloads` ADDED: `Standalone Configurable vLLM Program` | 2.1 |
| `kubernetes-workloads` ADDED: `Qwen3 Embedding Model Workload` | 2.1 |
| `kubernetes-workloads` ADDED: `Athena GPU Scheduling` | 1.1, 2.1 |
| `kubernetes-workloads` ADDED: `Internal-Only vLLM Service` | 2.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `AGENTS.md`: no comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets; always specify return types for public functions; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/`, `programs/`, or `src/`.

---

## Stage 1: vLLM Component Capability

### Task 1.1: Allow GPU resource keys

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Athena GPU Scheduling`
- **Depends on**: (none)
- **Files**: `src/components/vllm.ts`, `src/modules/ai-inference.ts` if shared config types require the same resource shape
- **Approach**: Extend the existing vLLM resource typing to allow extended Kubernetes resource keys such as `nvidia.com/gpu` while preserving existing CPU and memory configuration. Keep the implementation minimal and follow the current component API instead of adding a new abstraction.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: TypeScript completes with exit code 0.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bun run typecheck
  bun run typecheck
  ```
- **Output**:
  ```
  $ tsc --noEmit
  src/components/vllm.ts:418:15 - error TS2322: Type '{ requests?: Input<{ [key: string]: Input<string | number>; }> | undefined; limits?: Input<{ [key: string]: Input<string | number>; }> | undefined; } | undefined' is not assignable to type 'Input<ResourceRequirements> | undefined'.
  src/modules/ai-inference.ts:297:11 - error TS2322: Type 'string | number | undefined' is not assignable to type 'string | number'.
  src/modules/ai-inference.ts:298:11 - error TS2322: Type 'string | number | undefined' is not assignable to type 'string | number'.
  src/modules/ai-inference.ts:301:11 - error TS2322: Type 'string | number | undefined' is not assignable to type 'string | number'.
  src/modules/ai-inference.ts:302:11 - error TS2322: Type 'string | number | undefined' is not assignable to type 'string | number'.

  Found 5 errors in 2 files.

  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `src/components/vllm.ts`
  - `src/modules/ai-inference.ts`
  - `docs/specs/changes/add-standalone-vllm-athena/tasks.md`
- **AGENTS.md notes applied**: `AGENTS.md` notes from plan-review: no comments added; followed neighboring TypeScript patterns; used Bun for verification.
- **Subagent statuses**: none; Task 1.1 was executed inline.

- [x] Stage 1 complete

---

## Stage 2: Standalone vLLM Program

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Add configurable vLLM program and Qwen3 stack

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Standalone Configurable vLLM Program`; `kubernetes-workloads` ADDED Requirement: `Qwen3 Embedding Model Workload`; `kubernetes-workloads` ADDED Requirement: `Athena GPU Scheduling`; `kubernetes-workloads` ADDED Requirement: `Internal-Only vLLM Service`
- **Depends on**: Task 1.1
- **Files**: `programs/vllm/Pulumi.yaml`, `programs/vllm/index.ts`, `programs/vllm/Pulumi.qwen3-embedding.yaml`
- **Approach**: Create a generic `programs/vllm/` Pulumi program that reads model, inference, image, namespace, resources, runtime class, tolerations, node placement, and optional cache settings from stack config, then deploys one `Vllm` instance. Add `Pulumi.qwen3-embedding.yaml` as the model-specific stack for `Qwen/Qwen3-Embedding-4B` on Athena using the standard `DOCKER_IMAGES.VLLM` image unless overridden by config, runner `pooling`, fit-oriented limits for 16GB VRAM, NVIDIA runtime class, `nvidia.com/gpu: 1`, the `workload-type=gpu-inference:NoSchedule` toleration, and internal ClusterIP Service only; omit HTTPRoute, Ingress, and Agent Gateway resources.
- **Dispatch**: subagent
- **Dispatch rationale**: The task has a well-bounded new program file set and should stay isolated from existing `ai-inference` and `agent-gateway` changes.

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/vllm -s qwen3-embedding --non-interactive
  ```
- **Expected outcome**: TypeScript completes with exit code 0; Pulumi preview succeeds and shows the standalone vLLM Kubernetes resources without HTTPRoute, Ingress, or Agent Gateway resources.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/vllm -s qwen3-embedding --non-interactive
  pulumi stack ls -C programs/vllm
  pulumi stack init -C programs/vllm qwen3-embedding
  pulumi preview -C programs/vllm -s qwen3-embedding --non-interactive
  ```
- **Output**:
  ```
  $ tsc --noEmit

  error: no stack named 'qwen3-embedding' found

  NAME         LAST UPDATE   RESOURCE COUNT
  qwen3-coder  7 months ago  0

  error: could not create secrets manager for new stack: incorrect passphrase

  Created stack 'qwen3-embedding'

  Previewing update (qwen3-embedding):

   +  pulumi:pulumi:Stack vllm-qwen3-embedding create
   +  homelab:components:Vllm qwen3-embedding create
   +  kubernetes:core/v1:Namespace vllm create
   +  kubernetes:core/v1:Service qwen3-embedding-service create
   +  kubernetes:core/v1:PersistentVolume qwen3-embedding-model-cache-pv create
   +  kubernetes:core/v1:PersistentVolumeClaim qwen3-embedding-model-cache create
   +  kubernetes:apps/v1:Deployment qwen3-embedding-deployment create

  Outputs:
      modelName  : "Qwen/Qwen3-Embedding-4B"
      serviceName: "qwen3-embedding"
      serviceUrl : "http://qwen3-embedding.vllm.svc.cluster.local:8000"

  Resources:
      + 7 to create
  ```
- **Files changed (across the stage)**:
  - `programs/vllm/Pulumi.yaml`
  - `programs/vllm/index.ts`
  - `programs/vllm/Pulumi.qwen3-embedding.yaml`
  - `docs/specs/changes/add-standalone-vllm-athena/tasks.md`
- **AGENTS.md notes applied**: `AGENTS.md` notes from plan-review: no comments added; followed neighboring Pulumi program patterns; used Bun for verification.
- **Subagent statuses**:
  - Task 2.1: DONE

- [x] Stage 2 complete

---

## Follow-ups

`<!-- FOLLOW-UP(2026-05-23): Agent Gateway backend wiring is intentionally out of scope for this standalone vLLM program. Reference: Internal-Only vLLM Service / Gateway integration remains separate. -->`

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: (none — CRITICAL findings return the change to `writing-specs` before planning)
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

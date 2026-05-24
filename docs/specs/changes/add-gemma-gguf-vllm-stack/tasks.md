## Review Summary

No CRITICAL findings.

No WARNING findings.

No SUGGESTION findings.

## AGENTS.md Notes

- `AGENTS.md`: Do not add comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets; always specify return types for public functions; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/specs/`, `src/`, or `programs/`.

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| `kubernetes-workloads` ADDED Requirement: Gemma GGUF Model Workload | 2.1 |
| `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable vLLM Program | 1.1, 2.1 |
| `kubernetes-workloads` MODIFIED Requirement: Athena GPU Scheduling | 2.1 |

## Stage 1: Tokenizer Plumbing

### Task 1.1: Add tokenizer configuration support

- **Implements**: `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable vLLM Program
- **Depends on**: none
- **Files**: `src/components/vllm.ts`, `programs/vllm/index.ts`
- **Approach**: Add optional tokenizer input to the reusable vLLM component and standalone stack config, and render `--tokenizer <value>` only when stack configuration provides it. Preserve existing behavior for stacks without a tokenizer.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  ```
- **Expected outcome**: TypeScript compilation exits successfully with no errors.
- **Evidence artifact**: Inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  bun run typecheck
  ```
- **Output**:
  ```text
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `src/components/vllm.ts`
  - `programs/vllm/index.ts`
- **AGENTS.md notes applied**: Used Bun for verification; followed neighboring optional argument patterns; did not add comments.
- **Subagent statuses**: none; Task 1.1 executed inline.

- [x] Stage 1 complete

## Stage 2: Gemma GGUF Stack

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Add Gemma GGUF standalone stack

- **Implements**: `kubernetes-workloads` ADDED Requirement: Gemma GGUF Model Workload; `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable vLLM Program; `kubernetes-workloads` MODIFIED Requirement: Athena GPU Scheduling
- **Depends on**: 1.1
- **Files**: `programs/vllm/Pulumi.gemma-4-e2b.yaml`
- **Approach**: Add a new standalone vLLM stack named `gemma-4-e2b` in namespace `vllm` using model `unsloth/gemma-4-E2B-it-GGUF:Q6_K`, tokenizer `google/gemma-4-E2B-it`, official vLLM image default, NVIDIA runtime, Athena placement, GPU inference toleration, NFS model cache, and CPU/memory resources without default `nvidia.com/gpu` requests or limits.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/vllm" -s gemma-4-e2b --non-interactive
  ```
- **Expected outcome**: TypeScript compilation exits successfully; Pulumi preview renders the Gemma GGUF stack with an internal Service and vLLM Deployment arguments including `--model unsloth/gemma-4-E2B-it-GGUF:Q6_K` and `--tokenizer google/gemma-4-E2B-it`, without HTTPRoute, Agent Gateway resources, or default `nvidia.com/gpu` resources.
- **Evidence artifact**: Inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  bun run typecheck
  pulumi stack init gemma-4-e2b -C "programs/vllm" --non-interactive
  pulumi preview -C "programs/vllm" -s gemma-4-e2b --non-interactive
  ```
- **Output**:
  ```text
  $ tsc --noEmit

  Created stack 'gemma-4-e2b'

  Previewing update (gemma-4-e2b):

   +  pulumi:pulumi:Stack vllm-gemma-4-e2b create
   +  homelab:components:Vllm gemma-4-e2b create
   +  kubernetes:core/v1:Namespace vllm create
   +  kubernetes:core/v1:PersistentVolume gemma-4-e2b-model-cache-pv create
   +  kubernetes:core/v1:Service gemma-4-e2b-service create
   +  kubernetes:core/v1:PersistentVolumeClaim gemma-4-e2b-model-cache create
   +  kubernetes:apps/v1:Deployment gemma-4-e2b-deployment create

  Outputs:
      modelName  : "unsloth/gemma-4-E2B-it-GGUF:Q6_K"
      serviceName: "gemma-4-e2b"
      serviceUrl : "http://gemma-4-e2b.vllm.svc.cluster.local:8000"

  Resources:
      + 7 to create
  ```
- **Files changed (across the stage)**:
  - `programs/vllm/Pulumi.gemma-4-e2b.yaml`
- **AGENTS.md notes applied**: Used Bun for verification; followed neighboring stack configuration patterns; did not add comments or secrets.
- **Subagent statuses**: none; Task 2.1 executed inline.

- [x] Stage 2 complete

## Evidence

### Stage 1 Evidence

Recorded inline under Stage 1.

### Stage 2 Evidence

Recorded inline under Stage 2.

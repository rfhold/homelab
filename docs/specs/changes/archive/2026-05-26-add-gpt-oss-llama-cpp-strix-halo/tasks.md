# Tasks: add-gpt-oss-llama-cpp-strix-halo

**Status**: draft

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `kubernetes-workloads` ADDED: `GPT-OSS llama.cpp Strix Halo Workload` | 2.1 |
| `kubernetes-workloads` ADDED: `llama.cpp AMD Device Scheduling` | 1.1, 2.1 |
| `kubernetes-workloads` ADDED: `Agent Gateway Routing for GPT-OSS llama.cpp` | 2.2 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Follow neighboring patterns, do not add comments unless explicitly requested, never expose secrets, use Bun instead of npm/yarn/node package-manager workflows, and specify return types for public functions.
- No nested `AGENTS.md` files exist under `docs/`, `src/`, `programs/llama-cpp/`, or `programs/agent-gateway/`.

---

## Contract Boundary Assessment

- **Status**: required
- **Surfaces**: `src/components/llama-cpp.ts` `LlamaCppArgs`; `programs/llama-cpp/index.ts` `LlamaCppStackConfig`
- **Rationale**: The change adds an optional host-device configuration surface between stack YAML, the standalone llama.cpp Pulumi program, and the shared llama.cpp component.
- **Contract file**: `docs/specs/changes/add-gpt-oss-llama-cpp-strix-halo/contracts.md`

If status is `required`, `contracts.md` MUST contain the exact approved contract changes and Stage 1 MUST be contract-boundary-only. Implementation stages depend on Stage 1 evidence proving the changed contract surfaces match `contracts.md`.

---

## Stage 1: Contract Boundaries

### Task 1.1: Add llama.cpp host device contract

- **Implements**: `kubernetes-workloads` ADDED Requirement: `llama.cpp AMD Device Scheduling`
- **Depends on**: approved `contracts.md`
- **Files**: `src/components/llama-cpp.ts`, `programs/llama-cpp/index.ts`
- **Approach**: Add only the optional `hostDevices` fields defined in `contracts.md` and pass the stack field through to the component constructor. Do not add volume or mount rendering in this stage.
- **Dispatch**: inline
- **Dispatch rationale**: The contract edit is small and exact, and it must be verified against `contracts.md` before implementation wiring.

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: TypeScript compilation succeeds and the changed interfaces match `docs/specs/changes/add-gpt-oss-llama-cpp-strix-halo/contracts.md`.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path

#### Evidence

- **Date**: 2026-05-26
- **Commands**:
  ```
  bun run typecheck
  ```
- **Exit status**: 0
- **Result summary**: TypeScript compilation passed after adding the optional `hostDevices` fields to `LlamaCppArgs` and `LlamaCppStackConfig` and passing the stack value through to the component constructor.
- **Meaningful warnings/errors**: none
- **Raw output**: omitted; passing output contained only the invoked `tsc --noEmit` command.
- **Files changed (across the stage)**:
  - `src/components/llama-cpp.ts`
  - `programs/llama-cpp/index.ts`
  - `docs/specs/changes/add-gpt-oss-llama-cpp-strix-halo/tasks.md`
- **AGENTS.md notes applied**: `/home/rfhold/repos/rfhold/homelab/AGENTS.md` no-comments guidance and existing pattern preservation applied.
- **Subagent statuses**: none; Task 1.1 executed inline.

- [x] Stage 1 complete

---

## Stage 2: Implementation

Batch execute tasks that can be run in parallel sub agents.

- **Depends on**: Stage 1 complete

### Task 2.1: Add GPT-OSS ROCm llama.cpp stack

- **Implements**: `kubernetes-workloads` ADDED Requirement: `GPT-OSS llama.cpp Strix Halo Workload`; `kubernetes-workloads` ADDED Requirement: `llama.cpp AMD Device Scheduling`
- **Depends on**: Stage 1 complete
- **Files**: `src/components/llama-cpp.ts`, `programs/llama-cpp/Pulumi.gpt-oss-120b.yaml`
- **Approach**: Render optional `hostDevices` as hostPath volumes and container volume mounts in the llama.cpp component. Add a new `gpt-oss-120b` stack using `ghcr.io/ggml-org/llama.cpp:server-rocm`, `ggml-org/gpt-oss-120b-GGUF`, `gpt-oss-120b-mxfp4-00001-of-00003.gguf`, alias `gpt-oss-120b`, context size `131072`, single parallel slot, `/dev/kfd` and `/dev/dri` host device mounts, GPU-inference toleration, Strix Halo node selector, and the shared model cache.
- **Dispatch**: subagent

### Task 2.2: Route GPT-OSS through Agent Gateway

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Agent Gateway Routing for GPT-OSS llama.cpp`
- **Depends on**: Stage 1 complete
- **Files**: `programs/agent-gateway/Pulumi.pantheon.yaml`
- **Approach**: Add an OpenAI-compatible Agent Gateway provider for the internal GPT-OSS llama.cpp Service and preserve existing llama.cpp provider routes.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi --cwd programs/llama-cpp preview --stack gpt-oss-120b --non-interactive
  pulumi --cwd programs/agent-gateway preview --stack pantheon --non-interactive
  ```
- **Expected outcome**: TypeScript compilation succeeds; the llama.cpp preview renders the GPT-OSS stack using the available `HF_TOKEN`; the Agent Gateway preview renders with the added `gpt-oss-120b` provider and preserves existing providers.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path

#### Evidence

- **Date**: 2026-05-26
- **Commands**:
  ```
  bun run typecheck
  pulumi --cwd programs/llama-cpp preview --stack gpt-oss-120b --non-interactive
  pulumi --cwd programs/agent-gateway preview --stack pantheon --non-interactive
  ```
- **Exit status**: 0
- **Result summary**: TypeScript compilation passed. The first llama.cpp preview attempt failed because the new `gpt-oss-120b` Pulumi stack did not exist; `pulumi --cwd programs/llama-cpp stack init gpt-oss-120b` created it, then the approved preview passed and rendered 9 resources to create with outputs `modelName: gpt-oss-120b`, `serviceName: gpt-oss-120b`, and `serviceUrl: http://gpt-oss-120b.llama-cpp.svc.cluster.local:8000`. Agent Gateway preview passed, adding backend `llama-cpp-gpt-oss-120b` and updating the HTTPRoute while preserving existing backend names.
- **Meaningful warnings/errors**: initial llama.cpp preview reported `error: no stack named 'gpt-oss-120b' found`; resolved by initializing the Pulumi stack before rerunning preview.
- **Raw output**: omitted; passing output summarized above and the only failure was the resolved missing-stack initialization issue.
- **Files changed (across the stage)**:
  - `src/components/llama-cpp.ts`
  - `programs/llama-cpp/Pulumi.gpt-oss-120b.yaml`
  - `programs/agent-gateway/Pulumi.pantheon.yaml`
  - `docs/specs/changes/add-gpt-oss-llama-cpp-strix-halo/tasks.md`
- **AGENTS.md notes applied**: `/home/rfhold/repos/rfhold/homelab/AGENTS.md` existing-pattern guidance, no-comments guidance, and Bun workflow guidance applied.
- **Subagent statuses**:
  - Task 2.1: DONE
  - Task 2.2: DONE

- [x] Stage 2 complete

---

## Follow-ups

None.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan and any required `contracts.md` (written). If Contract Boundary Assessment is `required`, execution starts with the contract-boundary stage and implementation stages remain blocked until Stage 1 evidence proves the changed contract surfaces match `contracts.md`.

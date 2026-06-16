# Restore GPT-OSS Stack To 120B Tasks

## Approval

- [x] Approved for execution

## AGENTS.md Notes

- Root `AGENTS.md`: no comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets or expose sensitive data; always specify return types for public functions; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/`, `src/`, or `programs/`; `docker/AGENTS.md` is not relevant because this change does not touch Docker build files.

## Contract Boundary Assessment

- **Status**: not applicable
- **Rationale**: This change updates existing Pulumi stack configuration values and shared component runtime defaults for persistent Hugging Face cache paths. It does not change APIs, schemas, generated types, persisted data, event contracts, or shared TypeScript interfaces.

## Requirements

- `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable vLLM Program
- `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable llama.cpp Program
- `kubernetes-workloads` MODIFIED Requirement: GPT-OSS llama.cpp Strix Halo Workload
- `kubernetes-workloads` MODIFIED Requirement: llama.cpp AMD Device Scheduling

## Stage 1: Model Source, ROCm Access, And Cache Persistence

### Task 1.1: Point GPT-OSS stack at GGUF 120B

- **Implements**: `kubernetes-workloads` MODIFIED Requirement: GPT-OSS llama.cpp Strix Halo Workload; `kubernetes-workloads` MODIFIED Requirement: llama.cpp AMD Device Scheduling
- **Depends on**: approved `tasks.md`
- **Files**: `programs/llama-cpp/Pulumi.gpt-oss-120b.yaml`
- **Approach**: Change the backend Hugging Face model source to `ggml-org/gpt-oss-120b-GGUF` with file `gpt-oss-120b-mxfp4-00001-of-00003.gguf` and persist privileged container access for ROCm device cgroup access; preserve stack name, namespace, service name, client-facing alias, ROCm image, context size, parallelism, scheduling, host device mounts, and model cache configuration.
- **Dispatch**: inline

### Task 1.2: Set component-managed Hugging Face cache paths

- **Implements**: `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable vLLM Program; `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable llama.cpp Program
- **Depends on**: approved `tasks.md`
- **Files**: `src/components/llama-cpp.ts`, `src/components/vllm.ts`, `programs/llama-cpp/Pulumi.gpt-oss-120b.yaml`
- **Approach**: When a model cache PVC exists, make the shared llama.cpp and vLLM components set Hugging Face cache environment variables to paths on the persistent cache volume unless the stack explicitly overrides them. Remove GPT-OSS stack-specific cache environment variables so the behavior comes from the component.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi --cwd programs/llama-cpp preview --stack gpt-oss-120b --non-interactive
  pulumi --cwd programs/vllm preview --stack qwen3-embedding --non-interactive
  ```
- **Expected outcome**: TypeScript passes; Pulumi preview renders the existing `gpt-oss-120b` stack with backend repository `ggml-org/gpt-oss-120b-GGUF`, file `gpt-oss-120b-mxfp4-00001-of-00003.gguf`, privileged container access, extended startup probe, and component-managed Hugging Face cache environment variables targeting the persistent model cache. vLLM preview renders model cache environment variables targeting its persistent Hugging Face cache mount.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure or ambiguity requires an artifact path.

#### Evidence

- **Date**: 2026-05-26
- **Commands**:
  ```bash
  bun run typecheck
  pulumi --cwd programs/llama-cpp preview --stack gpt-oss-120b --non-interactive
  pulumi --cwd programs/vllm preview --stack qwen3-embedding --non-interactive
  ```
- **Exit status**: 0
- **Result summary**:
  ```text
  TypeScript typecheck passed.
  llama.cpp GPT-OSS preview passed and showed one Deployment update with eight resources unchanged.
  The GPT-OSS Deployment renders HF_HOME=/models/huggingface and HUGGINGFACE_HUB_CACHE=/models/huggingface/hub from the component, plus startupProbe failureThreshold 60 => 180.
  vLLM qwen3-embedding preview passed and showed the Deployment env rendering HUGGING_FACE_HUB_TOKEN, HF_HOME=/root/.cache/huggingface, and HUGGINGFACE_HUB_CACHE=/root/.cache/huggingface/hub.
  ```
- **Meaningful warnings/errors**: vLLM preview also showed creation of the Pulumi Stash and Kubernetes Secret for the Hugging Face token; no typecheck or preview errors remained.
- **Raw output**: omitted; passing output contained expected TypeScript and Pulumi preview summaries.
- **Files changed (across the stage)**:
  - `src/components/llama-cpp.ts`
  - `src/components/vllm.ts`
  - `programs/llama-cpp/Pulumi.gpt-oss-120b.yaml`
  - `docs/specs/kubernetes-workloads/spec.md`
  - `docs/specs/changes/switch-gpt-oss-stack-to-20b/specs/kubernetes-workloads/spec.md`
  - `docs/specs/changes/switch-gpt-oss-stack-to-20b/tasks.md`
- **AGENTS.md notes applied**: root `AGENTS.md` notes followed; no comments added, neighboring YAML patterns preserved, Bun used for verification.
- **Subagent statuses**: none; Task 1.1 executed inline.

- [x] Stage 1 complete

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable vLLM Program | Task 1.2 |
| `kubernetes-workloads` MODIFIED Requirement: Standalone Configurable llama.cpp Program | Task 1.2 |
| `kubernetes-workloads` MODIFIED Requirement: GPT-OSS llama.cpp Strix Halo Workload | Task 1.1 |
| `kubernetes-workloads` MODIFIED Requirement: llama.cpp AMD Device Scheduling | Task 1.1 |

## Review Summary

## CRITICAL

- None.

## WARNING

- None.

## SUGGESTION

- None.

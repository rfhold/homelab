# route-agent-gateway-embedding-to-vllm Tasks

## Overview

Point the Agent Gateway Qwen3 embedding backend at the standalone vLLM `qwen3-embedding` Service in namespace `vllm` and remove the stale dependency on the old `ai-inference` embedding Service.

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| `kubernetes-workloads` MODIFIED: `Self-Hosted Model Name Preservation` | 1.1 |

## AGENTS.md Notes

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: no comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets; always specify return types for public functions; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files were found under `programs/agent-gateway`, `docs/specs`, or `docs/specs/kubernetes-workloads`.

## Stage 1: Gateway Backend Target

### Task 1.1: Route embedding backend to standalone vLLM Service

- **Implements**: `kubernetes-workloads` MODIFIED Requirement: `Self-Hosted Model Name Preservation`
- **Files**: `programs/agent-gateway/Pulumi.pantheon.yaml`
- **Approach**: Update the existing `vllm-qwen3-embedding-4b` Agent Gateway backend provider host to `qwen3-embedding.vllm.svc.cluster.local` while preserving port `8000`, OpenAI-compatible routes, and the `Qwen/Qwen3-Embedding-4B` model alias. Do not change `programs/vllm/Pulumi.qwen3-embedding.yaml`.
- **Dispatch**: inline
- **Dispatch rationale**: Single-file configuration change with no isolation or parallelism benefit.

### Stage Verification

- **Commands**:
  ```bash
  rg -n 'qwen3-embedding\.vllm\.svc\.cluster\.local|ai-inference-qwen3-embedding-4b\.ai-inference\.svc\.cluster\.local|vllm-qwen3-embedding-4b|Qwen/Qwen3-Embedding-4B' programs/agent-gateway/Pulumi.pantheon.yaml
  bun run typecheck
  ```
- **Expected outcome**: The Agent Gateway stack config contains `qwen3-embedding.vllm.svc.cluster.local`, keeps backend/model references for `vllm-qwen3-embedding-4b` and `Qwen/Qwen3-Embedding-4B`, does not contain the old `ai-inference-qwen3-embedding-4b.ai-inference.svc.cluster.local` host, and typecheck passes.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```bash
  rg -n 'qwen3-embedding\.vllm\.svc\.cluster\.local|ai-inference-qwen3-embedding-4b\.ai-inference\.svc\.cluster\.local|vllm-qwen3-embedding-4b|Qwen/Qwen3-Embedding-4B' programs/agent-gateway/Pulumi.pantheon.yaml
  bun run typecheck
  ```
- **Output**:
  ```text
  78:    - name: vllm-qwen3-embedding-4b
  80:        host: qwen3-embedding.vllm.svc.cluster.local
  90:            Qwen/Qwen3-Embedding-4B: Qwen/Qwen3-Embedding-4B

  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `programs/agent-gateway/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: `/home/rfhold/repos/rfhold/homelab/AGENTS.md` notes from this plan; no comments added, followed existing YAML pattern, no secrets changed.
- **Subagent statuses**: none; Task 1.1 was inline.

- [x] Stage 1 complete

---

## Review Summary Appendix

## CRITICAL

- None.

## WARNING

- None.

## SUGGESTION

- None.

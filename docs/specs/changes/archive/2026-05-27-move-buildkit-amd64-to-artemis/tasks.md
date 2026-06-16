# Tasks: move-buildkit-amd64-to-artemis

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `deployment` ADDED: `Pantheon AMD64 BuildKit Placement` | 1.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: use Bun instead of Yarn/NPM/Node; follow existing patterns; no comments unless explicitly requested.
- `docs/specs/AGENTS.md`: not present.
- `docs/specs/deployment/AGENTS.md`: not present.
- `programs/buildkit/AGENTS.md`: not present.

---

## Contract Boundary Assessment

- **Status**: not applicable
- **Surfaces**: none
- **Rationale**: this change only updates Pulumi stack configuration for Kubernetes pod placement and does not alter API schemas, database schemas, event schemas, generated contract code, or layer interfaces.
- **Contract file**: not applicable

---

## Stage 1: BuildKit Placement

### Task 1.1: Move amd64 BuildKit to Artemis

- **Implements**: `deployment` ADDED Requirement: `Pantheon AMD64 BuildKit Placement`
- **Depends on**: (none)
- **Files**: `programs/buildkit/Pulumi.pantheon.yaml`
- **Approach**: Change only `buildkit:amd64.nodeSelector.kubernetes.io/hostname` from `vulkan` to `artemis`, preserving the existing hostPath, resources, tolerations, and service identity.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```
  pulumi preview -s pantheon --diff
  kubectl get statefulset buildkit-amd64 --context=pantheon -n buildkit -o jsonpath='{.spec.template.spec.nodeSelector.kubernetes\.io/hostname}{"\n"}{range .spec.template.spec.volumes[*]}{.name}{"\t"}{.hostPath.path}{"\n"}{end}'
  ```
- **Expected outcome**: Pulumi preview shows only the intended BuildKit amd64 placement update before apply; after apply, the StatefulSet selects `artemis` and still mounts cache at `/var/lib/buildkit-cache/amd64`.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path

#### Evidence

- **Date**: 2026-05-27
- **Commands**:
  ```
  pulumi preview -s pantheon --diff
  pulumi up -s pantheon --yes --diff
  kubectl get statefulset buildkit-amd64 --context=pantheon -n buildkit -o jsonpath='{.spec.template.spec.nodeSelector.kubernetes\.io/hostname}{"\n"}{range .spec.template.spec.volumes[*]}{.name}{"\t"}{.hostPath.path}{"\n"}{end}'
  kubectl rollout status statefulset/buildkit-amd64 --context=pantheon -n buildkit --timeout=120s
  kubectl get pod buildkit-amd64-0 --context=pantheon -n buildkit -o wide
  ```
- **Exit status**: 0
- **Result summary**:
  ```
  Pulumi preview showed the amd64 StatefulSet nodeSelector change from vulkan to artemis, plus existing pending workload label additions.
  Pulumi up completed with 6 resources updated and 4 unchanged; BuildKit service outputs remained stable.
  StatefulSet selector is artemis and cache hostPath remains /var/lib/buildkit-cache/amd64.
  buildkit-amd64 rollout completed; buildkit-amd64-0 is Running on artemis with 0 restarts.
  ```
- **Meaningful warnings/errors**: Pulumi reported an available update from 3.239.0 to 3.243.0.
- **Raw output**: omitted; passing output summarized above.
- **Files changed (across the stage)**:
  - `programs/buildkit/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: followed root AGENTS.md notes to use existing patterns and avoid comments.
- **Subagent statuses**: none; Task 1.1 was inline.

- [x] Stage 1 complete

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

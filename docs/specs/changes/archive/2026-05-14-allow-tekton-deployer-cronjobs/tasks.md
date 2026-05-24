# Tasks: allow-tekton-deployer-cronjobs

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `deployment` ADDED: `Tekton Deployer CronJob Permissions` | 1.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Follow neighboring file patterns, do not commit secrets, use Bun instead of Yarn/NPM/Node, and always specify return types for public functions.
- No `docs/specs/**/AGENTS.md` or `src/**/AGENTS.md` files apply to this change.

---

## Stage 1: Tekton Deployer RBAC

### Task 1.1: Allow CronJob management in deployer role

- **Implements**: `deployment` ADDED Requirement: `Tekton Deployer CronJob Permissions`
- **Depends on**: (none)
- **Files**: `src/components/tekton.ts`
- **Approach**: Update the existing `tekton-deployer` `ClusterRole` batch API group rule to include `cronjobs` alongside the existing `jobs` resource, keeping the existing get/list/watch/create/update/patch/delete verbs and avoiding unrelated RBAC broadening.
- **Dispatch**: inline
- **Dispatch rationale**: Small, mechanical one-file RBAC change following an existing neighboring rule; no context-isolation or parallelism benefit.

### Stage Verification

- **Commands**:
  ```
  git diff --check -- src/components/tekton.ts docs/specs/changes/allow-tekton-deployer-cronjobs
  rg -n 'apiGroups: \["batch"\]|resources: \["jobs", "cronjobs"\]|verbs: \["get", "list", "watch", "create", "update", "patch", "delete"\]' src/components/tekton.ts
  bun run typecheck
  ```
- **Expected outcome**: Diff check passes; the Tekton deployer batch rule includes both `jobs` and `cronjobs` with the existing verbs; TypeScript typecheck passes.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-14
- **Commands**:
  ```
  git diff --check -- src/components/tekton.ts docs/specs/changes/allow-tekton-deployer-cronjobs
  rg -n 'apiGroups: \["batch"\]|resources: \["jobs", "cronjobs"\]|verbs: \["get", "list", "watch", "create", "update", "patch", "delete"\]' src/components/tekton.ts
  bun run typecheck
  ```
- **Output**:
  ```
  585:            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
  590:            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
  593:            apiGroups: ["batch"],
  594:            resources: ["jobs", "cronjobs"],
  595:            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
  600:            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
  605:            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
  610:            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
  615:            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
  620:            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `src/components/tekton.ts`
  - `docs/specs/changes/allow-tekton-deployer-cronjobs/specs/deployment/spec.md`
  - `docs/specs/changes/allow-tekton-deployer-cronjobs/tasks.md`
- **AGENTS.md notes applied**: Followed neighboring RBAC rule pattern; did not add secrets; used Bun for TypeScript verification.
- **Subagent statuses**: None; Task 1.1 executed inline.

- [x] Stage 1 complete

---

## Review Summary

Findings from `review-changes` validation:

- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

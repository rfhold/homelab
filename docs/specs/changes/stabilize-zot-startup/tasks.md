# Tasks: stabilize-zot-startup

**Status**: draft

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `kubernetes-workloads` ADDED: `Zot Cold Start Tolerance` | 1.1 |
| `kubernetes-workloads` ADDED: `Zot Pull-Through Cache Feature Scope` | 1.1 |
| `kubernetes-workloads` ADDED: `Zot Managed TLS Renewal` | 1.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: do not add comments unless explicitly requested, follow existing neighboring patterns, and use Bun-based commands for verification.

---

## Stage 1: Update Zot Workload

### Task 1.1: Align Zot workload behavior and TLS management

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Zot Cold Start Tolerance`; `kubernetes-workloads` ADDED Requirement: `Zot Pull-Through Cache Feature Scope`; `kubernetes-workloads` ADDED Requirement: `Zot Managed TLS Renewal`
- **Depends on**: (none)
- **Files**: `src/components/zot-registry.ts`, `programs/container-registry/Pulumi.pantheon.yaml`
- **Approach**: Update the Zot component to disable UI and search and add a startup health gate that protects long metadata initialization without weakening steady-state liveness. Update the `pantheon` container-registry stack config to stop treating the TLS secret as an unmanaged migration artifact and instead declare the cert-manager-backed hostname and issuer inputs for `cr.holdenitdown.net`.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/container-registry --stack pantheon --non-interactive
  ```
- **Expected outcome**: both commands exit successfully; TypeScript typechecking passes; Pulumi preview shows the Zot workload and managed certificate changes without configuration or schema errors.
- **Evidence artifact**: inline in this stage's Evidence block.

- [ ] Stage 1 complete

---

## Follow-ups

None.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: (none — CRITICAL findings return the change to `writing-specs` before planning)
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [ ] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

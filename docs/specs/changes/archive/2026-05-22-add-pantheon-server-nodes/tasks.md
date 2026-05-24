# Tasks: add-pantheon-server-nodes

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `host-provisioning` ADDED: `Pantheon Server Node Inventory` | 1.1 |
| `host-provisioning` ADDED: `Athena NVIDIA x86 Host Provisioning` | 1.2 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Do not add code comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets or expose sensitive data; use Bun instead of Yarn/NPM/Node. No nested `AGENTS.md` files exist under `docs/` or `deploys/`.

---

## Stage 1: Inventory and Host Provisioning

Batch execute tasks that can be run in parallel sub agents.

### Task 1.1: Add Pantheon server inventory entries

- **Implements**: `host-provisioning` ADDED Requirement: `Pantheon Server Node Inventory`
- **Depends on**: (none)
- **Files**: `inventory.py`, `README.md`
- **Approach**: Add `athena.holdenitdown.net` and `artemis.holdenitdown.net` to the Pantheon inventory as `server` nodes using the existing Pantheon API endpoint, token, VLAN 3 label, and baseline Alloy smartctl settings. Update README Pantheon topology/counts so operator-facing documentation matches the inventory, while keeping both new nodes free of GPU, taint, and KVM metadata.
- **Dispatch**: subagent

### Task 1.2: Make NVIDIA host provisioning x86-compatible

- **Implements**: `host-provisioning` ADDED Requirement: `Athena NVIDIA x86 Host Provisioning`
- **Depends on**: (none)
- **Files**: `deploys/nvidia-container-host.py`
- **Approach**: Update the NVIDIA host provisioning deploy so it installs NVIDIA server driver packages and container toolkit dependencies suitable for a regular x86 host. Preserve the existing deploy purpose without adding Kubernetes labels or taints.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  uv run python -m unittest discover -s tests
  uv run python -m py_compile inventory.py deploys/nvidia-container-host.py tests/test_add_pantheon_server_nodes.py
  git diff --check
  ```
- **Expected outcome**: Unit tests pass, Python compilation exits 0 for the modified Python files, and `git diff --check` reports no whitespace errors.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-22
- **Commands**:
  ```
  uv run python -m unittest discover -s tests
  uv run python -m py_compile inventory.py deploys/nvidia-container-host.py tests/test_add_pantheon_server_nodes.py
  git diff --check
  ```
- **Output**:
  ```
  ....
  ----------------------------------------------------------------------
  Ran 4 tests in 0.001s

  OK
  ```
- **Files changed (across the stage)**:
  - `inventory.py`
  - `README.md`
  - `deploys/nvidia-container-host.py`
  - `tests/test_add_pantheon_server_nodes.py`
  - `docs/specs/changes/add-pantheon-server-nodes/tasks.md`
- **AGENTS.md notes applied**: `/home/rfhold/repos/rfhold/homelab/AGENTS.md` notes to avoid comments unless requested, follow neighboring patterns, avoid exposing secrets, and use existing Python/PyInfra patterns.
- **Subagent statuses**:
  - Task 1.1: DONE
  - Task 1.2: DONE
- **Concerns**: none

- [x] Stage 1 complete

---

## Follow-ups

Tasks blocked or deferred, with reason and reference. Format:

`<!-- FOLLOW-UP(YYYY-MM-DD): <reason>. <reference>. -->`

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

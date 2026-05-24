# Tasks: add-kernel-args-operation

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `host-provisioning` ADDED: `Kernel Argument Fact` | 1.1 |
| `host-provisioning` ADDED: `Kernel Argument Operation` | 1.1 |
| `host-provisioning` ADDED: `NVMe PCIe Power Control Deploy Uses Kernel Argument Operation` | 1.2 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Do not add code comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets or expose sensitive data; always specify return types for public functions; use Bun instead of Yarn/NPM/Node. No nested `AGENTS.md` files exist under `docs/`, `deploys/`, or `tests/`.

---

## Stage 1: Kernel Argument API and Consumer

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Add custom kernel argument fact and operation

- **Implements**: `host-provisioning` ADDED Requirement: `Kernel Argument Fact`; `host-provisioning` ADDED Requirement: `Kernel Argument Operation`
- **Depends on**: (none)
- **Files**: `deploys/facts/kernel_args.py`, `deploys/operations/kernel_args.py`, `tests/test_kernel_args.py`
- **Approach**: Add repo-local custom PyInfra fact and operation modules with a generic kernel-argument API backed by `/etc/default/grub` for the first implementation. The fact should parse `GRUB_CMDLINE_LINUX_DEFAULT`; the operation should preserve unmanaged args, add missing managed args, replace stale managed values, avoid rewrites/regeneration when unchanged, and surface unsupported GRUB/update-grub prerequisites clearly. Add unit tests for parsing, unsupported config, add, replace, preserve, and no-op behavior.
- **Dispatch**: subagent

### Task 1.2: Update NVMe PCIe power-control deploy

- **Implements**: `host-provisioning` ADDED Requirement: `NVMe PCIe Power Control Deploy Uses Kernel Argument Operation`
- **Depends on**: Task 1.1
- **Files**: `deploys/disable-nvme-pcie-power-control.py`, `tests/test_kernel_args.py`
- **Approach**: Replace the deploy's direct `/etc/default/grub` string editing with the custom kernel argument operation, managing `nvme_core.default_ps_max_latency_us=0` and `pcie_aspm=off`. Keep the deploy GRUB-backed, do not reboot hosts, and extend tests to assert the deploy uses the operation with the approved argument values.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  uv run python -m unittest discover -s tests
  uv run python -m py_compile deploys/disable-nvme-pcie-power-control.py deploys/facts/kernel_args.py deploys/operations/kernel_args.py tests/test_kernel_args.py
  git diff --check
  ```
- **Expected outcome**: Unit tests pass, Python compilation exits 0 for the modified Python files, and `git diff --check` reports no whitespace errors.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  uv run python -m unittest discover -s tests
  uv run python -m py_compile deploys/disable-nvme-pcie-power-control.py deploys/facts/kernel_args.py deploys/operations/kernel_args.py tests/test_kernel_args.py
  git diff --check
  ```
- **Output**:
  ```
  ...............
  ----------------------------------------------------------------------
  Ran 15 tests in 0.001s

  OK
  ```
- **Files changed (across the stage)**:
  - `deploys/disable-nvme-pcie-power-control.py`
  - `deploys/facts/kernel_args.py`
  - `deploys/operations/kernel_args.py`
  - `tests/test_kernel_args.py`
  - `docs/specs/changes/add-kernel-args-operation/tasks.md`
- **AGENTS.md notes applied**: `/home/rfhold/repos/rfhold/homelab/AGENTS.md` notes to avoid comments unless requested, follow neighboring patterns, check imports before using libraries, and specify return types for public functions.
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

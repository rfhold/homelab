# Tasks: improve-k3s-shutdown-grace

**Status**: approved

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `host-provisioning` ADDED: `Inventory-Driven K3s Shutdown Timing` | 1.1 |
| `host-provisioning` ADDED: `Artemis K3s Shutdown Canary` | 1.1 |
| `kubernetes-workloads` ADDED: `Generic Workload Label Passthrough` | 2.1, 3.1 |
| `kubernetes-workloads` ADDED: `Standard Workload Identity Labels` | 2.1, 3.1 |
| `kubernetes-workloads` ADDED: `Label-Driven Planned Reboot Selection` | 4.1 |
| `kubernetes-workloads` ADDED: `Workload Layer Stack Coverage` | 2.1, 3.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: No comments unless explicitly requested; follow neighboring file patterns; check imports before adding libraries; never commit secrets; public functions require return types; use Bun rather than Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/specs`, `src`, `programs`, `deploys`, `scripts`, or `tests`; `/home/rfhold/repos/rfhold/homelab/docker/AGENTS.md` exists but this plan does not touch `docker/`.

---

## Stage 1: Artemis Shutdown Canary

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Add inventory-driven K3s shutdown timing

- **Implements**: `host-provisioning` ADDED Requirement: `Inventory-Driven K3s Shutdown Timing`; `host-provisioning` ADDED Requirement: `Artemis K3s Shutdown Canary`
- **Depends on**: (none)
- **Files**: `inventory.py`, `deploys/k3s/setup.py`, `deploys/k3s/templates/k3s.service.j2`, `deploys/k3s/templates/k3s-agent.service.j2`, `tests/test_add_pantheon_server_nodes.py`
- **Approach**: Add optional K3s shutdown timing fields under each host's `k3s_cluster` data, render kubelet shutdown values from inventory with the current values as defaults, render the K3s systemd stop timeout from inventory with the current timeout as default, and configure Artemis with `5m`, `1m`, and `6min`. Extend inventory tests to verify Artemis gets the canary timing without adding taints, GPU labels, KVM labels, or automatic reboot behavior.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  python -m unittest tests/test_add_pantheon_server_nodes.py
  git diff --check -- inventory.py deploys/k3s/setup.py deploys/k3s/templates/k3s.service.j2 deploys/k3s/templates/k3s-agent.service.j2 tests/test_add_pantheon_server_nodes.py
  ```
- **Expected outcome**: Python inventory tests pass; whitespace check produces no output.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  python -m unittest tests/test_add_pantheon_server_nodes.py
  git diff --check -- inventory.py deploys/k3s/setup.py deploys/k3s/templates/k3s.service.j2 deploys/k3s/templates/k3s-agent.service.j2 tests/test_add_pantheon_server_nodes.py
  ```
- **Output**:
  ```
  ......
  ----------------------------------------------------------------------
  Ran 6 tests in 0.003s

  OK
  ```
- **Files changed (across the stage)**:
  - `inventory.py`
  - `deploys/k3s/setup.py`
  - `deploys/k3s/templates/k3s.service.j2`
  - `deploys/k3s/templates/k3s-agent.service.j2`
  - `tests/test_add_pantheon_server_nodes.py`
- **AGENTS.md notes applied**: root AGENTS.md notes from this file: no comments unless requested; follow neighboring patterns; public functions require return types.
- **Subagent statuses**:
  - Task 1.1: DONE

- [x] Stage 1 complete

---

## Stage 2: Generic Label Passthrough

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Expose workload label passthrough across components

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Generic Workload Label Passthrough`; `kubernetes-workloads` ADDED Requirement: `Standard Workload Identity Labels`; `kubernetes-workloads` ADDED Requirement: `Workload Layer Stack Coverage`
- **Depends on**: Stage 1
- **Files**: `src/**/*.ts`, `programs/*/index.ts`, component-adjacent program files that construct Kubernetes workloads
- **Approach**: Add a regular generic workload label input pattern that components, modules, and chart wrappers can accept from stack code. Propagate provided labels to Kubernetes resource metadata and pod template metadata for controllers that create pods, and use Helm chart label values such as `commonLabels`, `podLabels`, or chart-specific equivalents where available. Preserve existing labels when no workload labels are provided and avoid component-specific mappings for `rholden.dev/workload-layer`.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  git diff --check -- src programs
  ```
- **Expected outcome**: TypeScript typecheck passes; whitespace check produces no output for source and program changes.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bun run typecheck
  git diff --check -- src programs
  ```
- **Output**:
  ```
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `src/types.ts`
  - `src/components/*`
  - `src/modules/*`
  - `src/adapters/stack-reference.ts`
  - `src/helm-charts.ts`
  - `programs/media-server/service.ts`
  - `programs/*/index.ts` where workload components are constructed
- **AGENTS.md notes applied**: root AGENTS.md notes from this file: no comments unless requested; follow neighboring patterns; check imports before adding libraries; use Bun for package commands.
- **Subagent statuses**:
  - Task 2.1: DONE

- [x] Stage 2 complete

---

## Stage 3: Stack Label Coverage

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 3.1: Add workload labels through stack configs

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Generic Workload Label Passthrough`; `kubernetes-workloads` ADDED Requirement: `Standard Workload Identity Labels`; `kubernetes-workloads` ADDED Requirement: `Workload Layer Stack Coverage`
- **Depends on**: Stage 2
- **Files**: `programs/*/Pulumi.*.yaml`, `programs/*/index.ts`, program component files that read stack config
- **Approach**: Add stack-owned generic label configuration for every workload-deploying stack, including Kubernetes recommended app labels where practical and `rholden.dev/workload-layer` for operational drain policy. Wire each program to pass stack labels into its components or chart wrappers through the generic passthrough from Stage 2.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  git diff --check -- programs
  ```
- **Expected outcome**: TypeScript typecheck passes; whitespace check produces no output for program and stack config changes.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bun run typecheck
  git diff --check -- programs
  ```
- **Output**:
  ```
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `programs/*/Pulumi.*.yaml`
  - `programs/*/index.ts`
  - `programs/media-server`
- **AGENTS.md notes applied**: root AGENTS.md notes from this file: no comments unless requested; follow neighboring patterns; check imports before adding libraries; use Bun for package commands.
- **Subagent statuses**:
  - Task 3.1: DONE_WITH_CONCERNS; accepted because the exact Stage Verification passed, the subagent concern was limited to unrun verification and preexisting or concurrent program diffs, and no unrelated changes were reverted.

- [x] Stage 3 complete

---

## Stage 4: Label-Driven Planned Reboot Helper

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 4.1: Add planned reboot helper with label-based selection

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Label-Driven Planned Reboot Selection`
- **Depends on**: Stage 3
- **Files**: `scripts/planned-node-reboot.sh`, optional helper documentation near existing scripts if needed
- **Approach**: Add a planned reboot helper that cordons a node, selects default drain candidates by configured workload label selectors, excludes unlabeled pods and `rholden.dev/workload-layer=storage` by default, and requires an explicit storage handling mode before touching storage-layer pods. In explicit storage mode, gate node reboot on Ceph health and `ceph osd ok-to-stop` for OSDs on the target node, and refuse to reboot when checks fail.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bash -n scripts/planned-node-reboot.sh
  git diff --check -- scripts/planned-node-reboot.sh
  ```
- **Expected outcome**: Shell syntax check passes; whitespace check produces no output for the reboot helper.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bash -n scripts/planned-node-reboot.sh
  git diff --check -- scripts/planned-node-reboot.sh
  ```
- **Output**:
  ```
  ```
- **Files changed (across the stage)**:
  - `scripts/planned-node-reboot.sh`
- **AGENTS.md notes applied**: root AGENTS.md notes from this file: no comments unless requested; follow neighboring patterns.
- **Subagent statuses**:
  - Task 4.1: DONE

- [x] Stage 4 complete

---

## Stage 5: Integrated Verification

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 5.1: Run full static validation

- **Implements**: `host-provisioning` ADDED Requirement: `Inventory-Driven K3s Shutdown Timing`; `host-provisioning` ADDED Requirement: `Artemis K3s Shutdown Canary`; `kubernetes-workloads` ADDED Requirement: `Generic Workload Label Passthrough`; `kubernetes-workloads` ADDED Requirement: `Standard Workload Identity Labels`; `kubernetes-workloads` ADDED Requirement: `Label-Driven Planned Reboot Selection`; `kubernetes-workloads` ADDED Requirement: `Workload Layer Stack Coverage`
- **Depends on**: Stage 4
- **Files**: `package.json`, `pyproject.toml`, `tests/`, `src/`, `programs/`, `deploys/`, `scripts/`
- **Approach**: Re-run the repository-level static checks that cover the TypeScript Pulumi changes, Python inventory/provisioning tests, shell helper syntax, and whitespace safety before marking implementation complete.
- **Dispatch**: inline
- **Dispatch rationale**: Final verification is a mechanical coordinator step across all prior outputs.

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  python -m unittest discover tests
  bash -n scripts/planned-node-reboot.sh
  git diff --check
  ```
- **Expected outcome**: TypeScript typecheck passes; all Python unittest tests pass; shell syntax check passes; whitespace check produces no output.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bun run typecheck
  python -m unittest discover tests
  bash -n scripts/planned-node-reboot.sh
  git diff --check
  ```
- **Output**:
  ```
  $ tsc --noEmit
  .......E
  ======================================================================
  ERROR: test_kernel_args (unittest.loader._FailedTest.test_kernel_args)
  ----------------------------------------------------------------------
  ImportError: Failed to import test module: test_kernel_args
  Traceback (most recent call last):
    File "/usr/lib/python3.14/unittest/loader.py", line 426, in _find_test_path
      module = self._get_module_from_name(name)
    File "/usr/lib/python3.14/unittest/loader.py", line 367, in _get_module_from_name
      __import__(name)
      ~~~~~~~~~~^^^^^^
    File "/home/rfhold/repos/rfhold/homelab/tests/test_kernel_args.py", line 4, in <module>
      from pyinfra.facts.server import Which
  ModuleNotFoundError: No module named 'pyinfra'


  ----------------------------------------------------------------------
  Ran 8 tests in 0.010s

  FAILED (errors=1)
  ```
- **Dependency environment resolution**:
  ```
  uv run python -m unittest discover tests
  ```
- **Dependency environment output**:
  ```
  ..................
  ----------------------------------------------------------------------
  Ran 18 tests in 0.003s

  OK
  ```
- **Final verification rerun from repo virtualenv**:
  ```
  uv sync
  source ".venv/bin/activate"
  bun run typecheck
  python -m unittest discover tests
  bash -n scripts/planned-node-reboot.sh
  git diff --check
  ```
- **Final verification output**:
  ```
  Resolved 36 packages in 0.99ms
  Checked 33 packages in 0.25ms
  $ tsc --noEmit
  ..................
  ----------------------------------------------------------------------
  Ran 18 tests in 0.003s

  OK
  ```
- **Code-review rework verification**:
  ```
  source ".venv/bin/activate"
  bun run typecheck
  python -m unittest discover tests
  bash -n scripts/planned-node-reboot.sh
  git diff --check
  ```
- **Code-review rework output**:
  ```
  $ tsc --noEmit
  ........................
  ----------------------------------------------------------------------
  Ran 24 tests in 0.029s

  OK
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/improve-k3s-shutdown-grace/tasks.md`
  - `tests/test_workload_labels.py`
- **AGENTS.md notes applied**: root AGENTS.md notes from this file: use Bun for package commands; follow existing repo Python environment declared by `pyproject.toml` and `uv.lock` for Python dependency resolution.
- **Subagent statuses**: none; Task 5.1 was inline.

- [x] Stage 5 complete

---

## Follow-ups

`<!-- FOLLOW-UP(2026-05-23): After the Artemis canary is verified operationally, consider applying inventory-driven shutdown timing to Mars and other storage or GPU-heavy nodes. Reference: host-provisioning ADDED Requirement: Artemis K3s Shutdown Canary. -->`

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION**: Keep storage and Ceph handling explicit in the task plan; default drain behavior must remain label-selected and must not touch `rholden.dev/workload-layer=storage` without explicit storage mode and Ceph checks.

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

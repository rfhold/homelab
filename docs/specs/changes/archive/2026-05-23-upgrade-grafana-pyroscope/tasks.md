# Tasks: upgrade-grafana-pyroscope

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `observability` MODIFIED: `Production Profiling Backend` | 1.2 |
| `observability` ADDED: `Current Grafana Runtime` | 1.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `AGENTS.md`: no comments unless explicitly requested; follow existing neighboring patterns; check imports before using libraries; never commit secrets; always specify return types for public functions; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/specs/` or `src/`.

---

## Stage 1: Grafana And Pyroscope Upgrade

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Upgrade Grafana chart

- **Implements**: `observability` ADDED Requirement: `Current Grafana Runtime`
- **Depends on**: (none)
- **Files**: `src/helm-charts.ts`, `src/components/grafana.ts`
- **Approach**: Update the Grafana Helm chart version to the selected current chart version. Validate the existing Grafana chart values against the newer chart and preserve administrator credentials, datasource provisioning compatibility, and image renderer configuration.
- **Dispatch**: inline

### Task 1.2: Switch Pyroscope to v2-only storage

- **Implements**: `observability` MODIFIED Requirement: `Production Profiling Backend`
- **Depends on**: Task 1.1
- **Files**: `src/helm-charts.ts`, `src/components/pyroscope.ts`, `src/modules/grafana-stack.ts`
- **Approach**: Update the Pyroscope Helm chart version to the selected 2.x chart version. Configure Pyroscope for v2-only storage with object storage enabled, disable v1 storage, avoid dual-write migration settings, and adjust component or endpoint assumptions if chart 2.x service names differ from the current read/write endpoint expectations.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi --cwd programs/grafana preview --stack pantheon
  ```
- **Expected outcome**: TypeScript typecheck exits successfully; Pulumi preview for `grafana.pantheon` renders the Grafana and Pyroscope chart changes without schema, value, or provider errors.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```bash
  bun run typecheck
  pulumi --cwd programs/grafana preview --stack pantheon
  ```
- **Output**:
  ```text
  $ tsc --noEmit

  Previewing update (pantheon):
  Resources:
      + 23 to create
      ~ 87 to update
      - 23 to delete
      +-1 to replace
      134 changes. 247 unchanged
  ```
- **Files changed (across the stage)**:
  - `src/helm-charts.ts`
  - `src/components/pyroscope.ts`
  - `docs/specs/changes/upgrade-grafana-pyroscope/specs/observability/spec.md`
  - `docs/specs/changes/upgrade-grafana-pyroscope/tasks.md`
- **AGENTS.md notes applied**: followed repo root guidance to avoid comments, preserve neighboring patterns, avoid secrets, and use Bun for package commands.
- **Subagent statuses**: none; both tasks were implemented inline per plan.

- [x] Stage 1 complete

---

## Follow-ups

`<!-- FOLLOW-UP(YYYY-MM-DD): <reason>. <reference>. -->`

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION**: The `Current Grafana Runtime` requirement intentionally uses the selected current chart/runtime rather than hard-coding version numbers so the plan can apply the latest versions discovered immediately before execution.

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

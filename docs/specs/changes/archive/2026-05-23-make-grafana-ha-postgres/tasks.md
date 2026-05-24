# Tasks: make-grafana-ha-postgres

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `observability` MODIFIED: `Current Grafana Runtime` | 1.2, 2.1 |
| `observability` ADDED: `Grafana PostgreSQL Backend` | 1.1, 2.1 |
| `observability` ADDED: `Grafana Alerting High Availability` | 1.2, 2.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `AGENTS.md`: no comments unless explicitly requested; follow existing neighboring patterns; check imports before using libraries; never commit secrets or expose sensitive data; always specify return types for public functions; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/specs/`, `src/`, or `programs/`.

---

## Stage 1: Module And Component Capabilities

Batch execute tasks that can be run in parallel sub agents.

### Task 1.1: Expose CloudNativePG instance count

- **Implements**: `observability` ADDED Requirement: `Grafana PostgreSQL Backend`
- **Depends on**: (none)
- **Files**: `src/modules/postgres.ts`
- **Approach**: Extend `PostgreSQLModuleArgs` so the CloudNativePG implementation can pass an `instances` value through to `CloudNativePGCluster`, preserving existing defaults for callers that do not set it.
- **Dispatch**: subagent

### Task 1.2: Add Grafana HA database settings

- **Implements**: `observability` MODIFIED Requirement: `Current Grafana Runtime`; `observability` ADDED Requirement: `Grafana Alerting High Availability`
- **Depends on**: (none)
- **Files**: `src/components/grafana.ts`
- **Approach**: Extend `GrafanaArgs` and Helm values to support two Grafana replicas, the chart headless service needed for replica discovery, PostgreSQL database configuration, and Grafana unified alerting HA clustering settings while preserving current admin, ingress, resources, and image renderer behavior.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  ```
- **Expected outcome**: TypeScript typecheck exits successfully after the reusable module and Grafana component APIs are extended.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```bash
  bun run typecheck
  ```
- **Output**:
  ```text
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `src/modules/postgres.ts`
  - `src/components/grafana.ts`
- **AGENTS.md notes applied**: followed repo root guidance to avoid comments, preserve neighboring patterns, avoid secrets, use public return types, and use Bun for package commands.
- **Subagent statuses**:
  - Task 1.1: DONE
  - Task 1.2: DONE

- [x] Stage 1 complete

---

## Stage 2: Grafana Stack Wiring

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Wire Grafana CloudNativePG HA deployment

- **Implements**: `observability` MODIFIED Requirement: `Current Grafana Runtime`; `observability` ADDED Requirement: `Grafana PostgreSQL Backend`; `observability` ADDED Requirement: `Grafana Alerting High Availability`
- **Depends on**: Stage 1
- **Files**: `src/modules/grafana-stack.ts`, `programs/grafana/index.ts`, `programs/grafana/Pulumi.pantheon.yaml`
- **Approach**: Instantiate a Grafana-specific `PostgreSQLModule` using the CloudNativePG implementation with three instances and 10Gi durable block storage per instance, configure Grafana to use that database, set Grafana to two replicas, and pass alerting HA gossip/headless-service configuration through the stack. Preserve existing datasource provisioning, image renderer configuration, ingress, and object storage behavior.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi --cwd programs/grafana preview --stack pantheon
  ```
- **Expected outcome**: TypeScript typecheck exits successfully; Pulumi preview for `grafana.pantheon` renders a three-instance CloudNativePG Grafana database, two Grafana replicas, Grafana PostgreSQL database settings, and alerting HA/headless-service configuration without schema, value, or provider errors.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```bash
  bun run typecheck
  pulumi --cwd programs/grafana preview --stack pantheon --diff
  pulumi --cwd programs/grafana preview --stack pantheon
  ```
- **Output**:
  ```text
  $ tsc --noEmit

  pulumi --cwd programs/grafana preview --stack pantheon --diff
  Full output saved to: /home/rfhold/.local/share/opencode/tool-output/tool_e57abb527001FYAYKolTIkMaY0
  Resources:
      + 4 to create
      ~ 5 to update
      +-1 to replace
      10 changes. 352 unchanged

  pulumi --cwd programs/grafana preview --stack pantheon
  Resources:
      + 4 to create
      ~ 5 to update
      +-1 to replace
      10 changes. 352 unchanged
  ```
- **Files changed (across the stage)**:
  - `src/modules/grafana-stack.ts`
  - `programs/grafana/index.ts`
  - `programs/grafana/Pulumi.pantheon.yaml`
  - `src/components/grafana.ts`
  - `docs/specs/changes/make-grafana-ha-postgres/tasks.md`
- **AGENTS.md notes applied**: followed repo root guidance to avoid comments, preserve neighboring patterns, avoid secrets by referencing the CloudNativePG app secret through `envValueFrom`, use public return types, and use Bun for package commands.
- **Subagent statuses**:
  - Task 2.1: DONE
- **Preview details**: rendered a three-instance CloudNativePG cluster with `10Gi` `ceph-block` storage, Grafana `replicas: 2`, Grafana PostgreSQL settings using `$__env{GF_DATABASE_*}`, a headless service for alerting gossip, and unified alerting HA peer configuration pointing at `grafana-stack-grafana-chart-headless:9094`.

- [x] Stage 2 complete

---

## Follow-ups

`<!-- FOLLOW-UP(YYYY-MM-DD): <reason>. <reference>. -->`

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION**: Initial review caught that the settled `10Gi` per PostgreSQL instance storage size was omitted; the delta was revised before this plan to make that requirement explicit.

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

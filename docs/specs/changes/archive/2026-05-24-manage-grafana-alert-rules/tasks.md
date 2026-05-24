# Tasks: manage-grafana-alert-rules

**Status**: approved

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `observability` ADDED: `Grafana Managed Alert Rule Files` | 1.1, 2.1 |
| `observability` ADDED: `Mimir Alert Rule Migration` | 1.1 |
| `observability` ADDED: `Grafana Alert Rule State Export` | 2.1 |
| `deployment` ADDED: `Grafana Alert Rule Reconciliation Pipeline` | 2.2, 2.3 |
| `deployment` ADDED: `Grafana Credentials For Alert Rule Pipelines` | 2.2, 2.3 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Do not add comments unless explicitly requested; follow neighboring file patterns; check imports before adding libraries; never commit secrets or expose sensitive data; public functions require return types; use Bun instead of Yarn/NPM/Node.
- AGENTS.md discovery found only the repo root AGENTS.md and `docker/AGENTS.md`; this plan does not touch `docker/`, so the root instructions apply to `docs/specs`, `grafana`, `.tekton`, `scripts`, `programs`, and `src` work.

---

## Stage 1: Alert Rule Ownership Migration

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Migrate Mimir rules to Grafana-managed files

- **Implements**: `observability` ADDED Requirement: `Grafana Managed Alert Rule Files`; `observability` ADDED Requirement: `Mimir Alert Rule Migration`
- **Depends on**: (none)
- **Files**: `grafana/alert-rules/**`, `programs/grafana/index.ts`, `programs/grafana/alerts/**`, `programs/grafana/recording-rules/**`, supporting files only if required by the selected `gcx` native format
- **Approach**: Determine the `gcx` import format for Grafana-managed alert rules, create `grafana/alert-rules/` as the authoritative file tree, and migrate every current rule group from `programs/grafana/alerts/` and `programs/grafana/recording-rules/` into equivalent Grafana-managed alert rule files. Remove the `loadRules`/`mimirRules` wiring from `programs/grafana/index.ts` and stop passing rule content into the Mimir stack while keeping the Mimir component/ruler capability otherwise intact.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  test -d grafana/alert-rules
  bash -lc '! grep -R "loadRules\|mimirRules" programs/grafana/index.ts'
  bash -lc '! test -d programs/grafana/alerts'
  bash -lc '! test -d programs/grafana/recording-rules'
  ```
- **Expected outcome**: TypeScript passes; `grafana/alert-rules/` exists; Grafana program no longer loads or passes Mimir rule files; old Mimir rule source directories are removed after migration.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  bun run typecheck
  test -d grafana/alert-rules
  bash -lc '! grep -R "loadRules\|mimirRules" programs/grafana/index.ts'
  bash -lc '! test -d programs/grafana/alerts'
  bash -lc '! test -d programs/grafana/recording-rules'
  ```
- **Output**:
  ```
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `grafana/alert-rules/alloy-alerts.yaml`
  - `grafana/alert-rules/asserts-node.rules.yaml`
  - `grafana/alert-rules/ceph.yaml`
  - `grafana/alert-rules/cert-manager.yaml`
  - `grafana/alert-rules/kubernetes.rules.yaml`
  - `grafana/alert-rules/kubernetes.yaml`
  - `grafana/alert-rules/loki-alerts.yaml`
  - `grafana/alert-rules/loki-rules.yaml`
  - `grafana/alert-rules/mimir.rules.yaml`
  - `grafana/alert-rules/mimir.yaml`
  - `grafana/alert-rules/node-exporter-filesystem.yaml`
  - `grafana/alert-rules/node-exporter.rules.yaml`
  - `grafana/alert-rules/node-exporter.yaml`
  - `grafana/alert-rules/traefik.yaml`
  - `grafana/alert-rules/velero.yaml`
  - `programs/grafana/index.ts`
  - `programs/grafana/alerts/**` removed
  - `programs/grafana/recording-rules/**` removed
- **AGENTS.md notes applied**: Root AGENTS.md notes from this plan: no comments unless requested; follow neighboring patterns; use Bun; do not expose secrets.
- **Subagent statuses**:
  - Task 1.1: DONE_WITH_CONCERNS; accepted because Stage Verification passed, with the concern that local `gcx` is not installed and format was derived from Grafana/gcx schemas rather than validated with the CLI.

- [x] Stage 1 complete

---

## Stage 2: Gcx Sync And Tekton Reconcile

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Add Grafana alert-rule sync script

- **Implements**: `observability` ADDED Requirement: `Grafana Managed Alert Rule Files`; `observability` ADDED Requirement: `Grafana Alert Rule State Export`
- **Depends on**: Task 1.1
- **Files**: `scripts/**`, `package.json` if adding a Bun script alias
- **Approach**: Add an executable repository script that uses `gcx` and standard Grafana variables (`GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, optional `GRAFANA_TOKEN`) to export current Grafana-managed alert rules into `grafana/alert-rules/`. The script must only sync files locally and must not commit or push.
- **Dispatch**: subagent

### Task 2.2: Wire Grafana credentials into Tekton PAC

- **Implements**: `deployment` ADDED Requirement: `Grafana Credentials For Alert Rule Pipelines`
- **Depends on**: Task 1.1
- **Files**: `programs/tekton/index.ts`, `src/components/tekton.ts`, `programs/tekton/Pulumi.pantheon.yaml` only if configuration shape requires it
- **Approach**: Read the existing Grafana stack outputs from `programs/tekton/`, pass Grafana connection values into the Tekton component, and create a `pipelines-as-code` namespace Secret exposing `GRAFANA_SERVER`, `GRAFANA_USER`, and `GRAFANA_PASSWORD`. Do not create or require a Grafana service account token.
- **Dispatch**: subagent

### Task 2.3: Add path-filtered alert-rule reconciliation pipeline

- **Implements**: `deployment` ADDED Requirement: `Grafana Alert Rule Reconciliation Pipeline`; `deployment` ADDED Requirement: `Grafana Credentials For Alert Rule Pipelines`
- **Depends on**: Task 2.1, Task 2.2
- **Files**: `.tekton/**`, `scripts/**` only if adding a shared apply script
- **Approach**: Add a Tekton Pipelines-as-Code workflow that runs on pushes to `main` when `.tekton` pipeline files or `grafana/alert-rules/**` change. The workflow must clone the repository, invoke `gcx` to reconcile Grafana alert rules from `grafana/alert-rules/`, consume Grafana basic-auth variables from the Tekton Secret, and reconcile deletions so Grafana matches the files.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ruby -e 'require "yaml"; Dir[".tekton/*.yaml"].each { |f| YAML.load_file(f) }'
  test -x scripts/sync-grafana-alert-rules.sh
  grep -R "GRAFANA_SERVER" programs/tekton src/components/tekton.ts .tekton scripts
  grep -R "grafana/alert-rules" .tekton scripts
  ```
- **Expected outcome**: TypeScript passes; all Tekton YAML parses; sync script is executable; Grafana credential variables are wired through Tekton/script/pipeline files; the pipeline is path-filtered to the alert-rule source tree.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  bun run typecheck
  ruby -e 'require "yaml"; Dir[".tekton/*.yaml"].each { |f| YAML.load_file(f) }'
  test -x scripts/sync-grafana-alert-rules.sh
  grep -R "GRAFANA_SERVER" programs/tekton src/components/tekton.ts .tekton scripts
  grep -R "grafana/alert-rules" .tekton scripts
  ```
- **Output**:
  ```
  $ tsc --noEmit

  src/components/tekton.ts:            GRAFANA_SERVER: grafanaCredentials.server,
  .tekton/grafana-alert-rules.yaml:                - name: GRAFANA_SERVER
  .tekton/grafana-alert-rules.yaml:                      key: GRAFANA_SERVER
  scripts/sync-grafana-alert-rules.sh:    echo "Usage: GRAFANA_SERVER=<url> GRAFANA_USER=<user> GRAFANA_PASSWORD=<password> $0"
  scripts/sync-grafana-alert-rules.sh:    echo "       GRAFANA_SERVER=<url> GRAFANA_TOKEN=<token> $0"
  scripts/sync-grafana-alert-rules.sh:if [ -z "${GRAFANA_SERVER:-}" ]; then
  scripts/sync-grafana-alert-rules.sh:    echo "ERROR: GRAFANA_SERVER is required" >&2
  scripts/apply-grafana-alert-rules.sh:    echo "Usage: GRAFANA_SERVER=<url> GRAFANA_USER=<user> GRAFANA_PASSWORD=<password> $0"
  scripts/apply-grafana-alert-rules.sh:    echo "       GRAFANA_SERVER=<url> GRAFANA_TOKEN=<token> $0"
  scripts/apply-grafana-alert-rules.sh:if [ -z "${GRAFANA_SERVER:-}" ]; then
  scripts/apply-grafana-alert-rules.sh:    echo "ERROR: GRAFANA_SERVER is required" >&2

  .tekton/grafana-alert-rules.yaml:    pipelinesascode.tekton.dev/on-path-change: "[.tekton/**, grafana/alert-rules/**]"
  scripts/sync-grafana-alert-rules.sh:OUTPUT_DIR="$ROOT_DIR/grafana/alert-rules"
  scripts/apply-grafana-alert-rules.sh:RULE_DIR="$ROOT_DIR/grafana/alert-rules"
  ```
- **Files changed (across the stage)**:
  - `.tekton/grafana-alert-rules.yaml`
  - `programs/tekton/index.ts`
  - `scripts/apply-grafana-alert-rules.sh`
  - `scripts/sync-grafana-alert-rules.sh`
  - `src/components/tekton.ts`
- **AGENTS.md notes applied**: Root AGENTS.md notes from this plan: no comments unless requested; follow neighboring patterns; use Bun; do not expose secrets.
- **Subagent statuses**:
  - Task 2.1: DONE_WITH_CONCERNS; accepted because Stage Verification passed, with the concern that local `gcx` is not installed and live export was not validated.
  - Task 2.2: DONE_WITH_CONCERNS; accepted because Stage Verification passed and the concern was only that verification was coordinator-owned.
  - Task 2.3: DONE.

- [x] Stage 2 complete

---

## Stage 3: End-To-End Change Validation

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 3.1: Validate alert-rule workflow integration

- **Implements**: `observability` ADDED Requirement: `Grafana Managed Alert Rule Files`; `observability` ADDED Requirement: `Mimir Alert Rule Migration`; `observability` ADDED Requirement: `Grafana Alert Rule State Export`; `deployment` ADDED Requirement: `Grafana Alert Rule Reconciliation Pipeline`; `deployment` ADDED Requirement: `Grafana Credentials For Alert Rule Pipelines`
- **Depends on**: Task 2.1, Task 2.2, Task 2.3
- **Files**: `docs/specs/changes/manage-grafana-alert-rules/tasks.md` evidence block only, plus minimal fixes if verification exposes defects
- **Approach**: Run the full validation set after all implementation tasks, inspect the resulting diff for secret exposure, and record evidence in this file. Do not deploy or push unless explicitly requested.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ruby -e 'require "yaml"; Dir[".tekton/*.yaml"].each { |f| YAML.load_file(f) }'
  bash -lc '! grep -R "loadRules\|mimirRules" programs/grafana/index.ts'
  bash -lc 'test -d grafana/alert-rules && test -x scripts/sync-grafana-alert-rules.sh'
  git diff --check
  ```
- **Expected outcome**: TypeScript passes; Tekton YAML parses; old Mimir rule wiring is absent; alert-rule files and sync script exist; whitespace diff check passes.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  bun run typecheck
  ruby -e 'require "yaml"; Dir[".tekton/*.yaml"].each { |f| YAML.load_file(f) }'
  bash -lc '! grep -R "loadRules\|mimirRules" programs/grafana/index.ts'
  bash -lc 'test -d grafana/alert-rules && test -x scripts/sync-grafana-alert-rules.sh'
  git diff --check
  git diff --stat
  grep -R "GRAFANA_PASSWORD:\|GRAFANA_TOKEN:\|token: [A-Za-z0-9]\|password: [A-Za-z0-9]\|secretAccessKey: [A-Za-z0-9]" .tekton scripts
  ```
- **Output**:
  ```
  $ tsc --noEmit

  programs/grafana/alerts/alloy-alerts.yaml          |  110 --
  programs/grafana/alerts/ceph.yaml                  |   52 -
  programs/grafana/alerts/cert-manager.yaml          |   54 -
  programs/grafana/alerts/kubernetes.yaml            |  841 ------------
  programs/grafana/alerts/loki-alerts.yaml           |   78 --
  programs/grafana/alerts/mimir.yaml                 | 1435 --------------------
  .../grafana/alerts/node-exporter-filesystem.yaml   |   86 --
  programs/grafana/alerts/node-exporter.yaml         |  238 ----
  programs/grafana/alerts/traefik.yaml               |   43 -
  programs/grafana/alerts/velero.yaml                |   41 -
  programs/grafana/index.ts                          |   41 +-
  .../recording-rules/asserts-node.rules.json        |   50 -
  .../recording-rules/asserts-node.rules.yaml        |   61 -
  .../grafana/recording-rules/kubernetes.rules.yaml  |  804 -----------
  programs/grafana/recording-rules/loki-rules.yaml   |   39 -
  programs/grafana/recording-rules/mimir.rules.yaml  |  471 -------
  .../recording-rules/node-exporter.rules.json       |   49 -
  .../recording-rules/node-exporter.rules.yaml       |   69 -
  programs/tekton/Pulumi.pantheon.yaml               |    1 +
  programs/tekton/index.ts                           |    9 +
  src/components/tekton.ts                           |   25 +
  src/docker-images.ts                               |    5 +
  22 files changed, 41 insertions(+), 4561 deletions(-)

  .tekton: No files found
  scripts/apply-grafana-alert-rules.sh:27:if [ -z "${GRAFANA_TOKEN:-}" ] && { [ -z "${GRAFANA_USER:-}" ] || [ -z "${GRAFANA_PASSWORD:-}" ]; }; then
  scripts/sync-grafana-alert-rules.sh:27:if [ -z "${GRAFANA_TOKEN:-}" ] && { [ -z "${GRAFANA_USER:-}" ] || [ -z "${GRAFANA_PASSWORD:-}" ]; }; then
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/manage-grafana-alert-rules/tasks.md`
- **AGENTS.md notes applied**: Root AGENTS.md notes from this plan: no comments unless requested; use Bun; do not expose secrets.
- **Subagent statuses**:
  - Task 3.1: inline; final verification passed. Secret scan found only environment variable references, not literal secret values. The diff summary included unrelated pre-existing tracked changes in `programs/tekton/Pulumi.pantheon.yaml` and `src/docker-images.ts`; they were not modified for this task.

- [x] Stage 3 complete

---

## Follow-ups

None.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None.
- **WARNING**: None.
- **SUGGESTION**: None.

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

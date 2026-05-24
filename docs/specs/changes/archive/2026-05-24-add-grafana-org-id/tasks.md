# Tasks: add-grafana-org-id

**Status**: approved

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `observability` MODIFIED: `Grafana Alert Rule State Export` | 1.1 |
| `deployment` MODIFIED: `Grafana Credentials For Alert Rule Pipelines` | 1.1 |

## AGENTS.md Notes

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Do not add comments unless explicitly requested; follow neighboring file patterns; check imports before adding libraries; never commit secrets or expose sensitive data; public functions require return types; use Bun instead of Yarn/NPM/Node.

---

## Stage 1: Grafana Organization ID

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Add Grafana org ID to alert-rule workflows

- **Implements**: `observability` MODIFIED Requirement: `Grafana Alert Rule State Export`; `deployment` MODIFIED Requirement: `Grafana Credentials For Alert Rule Pipelines`
- **Depends on**: (none)
- **Files**: `scripts/sync-grafana-alert-rules.sh`, `scripts/apply-grafana-alert-rules.sh`, `.tekton/grafana-alert-rules.yaml`, `src/components/tekton.ts`, `docs/specs/observability/spec.md`, `docs/specs/deployment/spec.md`
- **Approach**: Hard-code `GRAFANA_ORG_ID=1` in local scripts when unset, add it to the Tekton `grafana-credentials` Secret and PAC workflow environment, update stable specs after verification, and test the sync script against the available Grafana environment.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ruby -e 'require "yaml"; Dir[".tekton/*.yaml"].each { |f| YAML.load_file(f) }'
  bash -n scripts/sync-grafana-alert-rules.sh scripts/apply-grafana-alert-rules.sh
  grep -R "GRAFANA_ORG_ID" scripts .tekton src/components/tekton.ts docs/specs/observability/spec.md docs/specs/deployment/spec.md
  GRAFANA_ORG_ID=1 scripts/sync-grafana-alert-rules.sh
  git diff --check
  ```
- **Expected outcome**: TypeScript passes; Tekton YAML parses; scripts pass syntax checks; org ID appears in scripts, PAC workflow, Tekton secret wiring, and specs; sync script successfully exports alert rules using the available Grafana environment; whitespace diff check passes.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  bun run typecheck
  ruby -e 'require "yaml"; Dir[".tekton/*.yaml"].each { |f| YAML.load_file(f) }'
  bash -n scripts/sync-grafana-alert-rules.sh scripts/apply-grafana-alert-rules.sh
  grep -R "GRAFANA_ORG_ID" scripts .tekton src/components/tekton.ts docs/specs/observability/spec.md docs/specs/deployment/spec.md
  GRAFANA_ORG_ID=1 scripts/sync-grafana-alert-rules.sh
  git diff --check
  ```
- **Output**:
  ```
  $ tsc --noEmit

  scripts/sync-grafana-alert-rules.sh:    echo "Usage: GRAFANA_SERVER=<url> GRAFANA_USER=<user> GRAFANA_PASSWORD=<password> GRAFANA_ORG_ID=1 $0"
  scripts/sync-grafana-alert-rules.sh:    echo "       GRAFANA_SERVER=<url> GRAFANA_TOKEN=<token> GRAFANA_ORG_ID=1 $0"
  scripts/sync-grafana-alert-rules.sh:export GRAFANA_ORG_ID="${GRAFANA_ORG_ID:-1}"
  scripts/apply-grafana-alert-rules.sh:    echo "Usage: GRAFANA_SERVER=<url> GRAFANA_USER=<user> GRAFANA_PASSWORD=<password> GRAFANA_ORG_ID=1 $0"
  scripts/apply-grafana-alert-rules.sh:    echo "       GRAFANA_SERVER=<url> GRAFANA_TOKEN=<token> GRAFANA_ORG_ID=1 $0"
  scripts/apply-grafana-alert-rules.sh:export GRAFANA_ORG_ID="${GRAFANA_ORG_ID:-1}"
  .tekton/grafana-alert-rules.yaml:                - name: GRAFANA_ORG_ID
  .tekton/grafana-alert-rules.yaml:                      key: GRAFANA_ORG_ID
  src/components/tekton.ts:            GRAFANA_ORG_ID: "1",
  docs/specs/observability/spec.md:Then the system MUST rely on standard Grafana environment variables including `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, `GRAFANA_ORG_ID=1`, and optional `GRAFANA_TOKEN`
  docs/specs/deployment/spec.md:Then the system MUST provide `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, and `GRAFANA_ORG_ID=1` from the existing Grafana stack outputs and fixed homelab organization ID

  ✔ 15 resources pulled, 0 errors
  Grafana alert rules synced to /home/rfhold/repos/rfhold/homelab/grafana/alert-rules
  ```
- **Additional live checks**:
  ```
  GRAFANA_ORG_ID=1 scripts/apply-grafana-alert-rules.sh
  GRAFANA_ORG_ID=1 gcx resources push -p grafana/alert-rules --include-managed --dry-run --on-error abort
  ```
- **Additional output**:
  ```
  ✔ 1 resources pushed, 0 errors
  🛈 Auto-approval enabled: automatically setting --force
  ✔ 10 resources deleted, 0 errors
  🛈 Auto-approval enabled: automatically setting --force
  ✔ 5 resources deleted, 0 errors
  ✔ 16 resources pushed, 0 errors
  Grafana alert rules reconciled from /home/rfhold/repos/rfhold/homelab/grafana/alert-rules

  ✔ 16 resources pushed, 0 errors
  ```
- **Files changed (across the stage)**:
  - `.tekton/grafana-alert-rules.yaml`
  - `docs/specs/deployment/spec.md`
  - `docs/specs/observability/spec.md`
  - `grafana/alert-rules/**`
  - `scripts/apply-grafana-alert-rules.sh`
  - `scripts/sync-grafana-alert-rules.sh`
  - `src/components/tekton.ts`
- **AGENTS.md notes applied**: Root AGENTS.md notes from this plan: no comments unless requested; follow neighboring file patterns; use Bun; do not expose secrets.
- **Notes**: Live testing found the ambiguous `rules` selector targeted Knowledge Graph, so scripts now use long selectors for `alertrules.v0alpha1.rules.alerting.grafana.app` and `recordingrules.v0alpha1.rules.alerting.grafana.app`. Live testing also found Grafana requires a pre-existing non-Git-Sync folder for alert resources; the apply script now pushes the `alert-rules` folder first, and sync replaces the local alert-rule tree while preserving `_folder.yaml` to avoid stale duplicate resources.

- [x] Stage 1 complete

---

## Review summary

- **CRITICAL**: None.
- **WARNING**: None.
- **SUGGESTION**: None.

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

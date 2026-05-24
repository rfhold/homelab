# Tasks: sync-grafana-dashboards-from-git

**Status**: approved

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `observability` MODIFIED: `Current Grafana Runtime` | 1.1, 2.1 |
| `observability` ADDED: `Grafana Git-Synced Dashboards` | 2.1, 3.1 |
| `observability` ADDED: `Grafana Git Sync Token Stash` | 2.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: no comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets or expose sensitive data; always specify return types for public functions; avoid refactoring language in code; use Bun instead of Yarn/NPM/Node.
- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: if the Authentik SDK is missing, run `pulumi install` in `packages/authentik-provider/`; this change is not expected to touch that provider.
- No nested `AGENTS.md` files apply to planned files. `docker/AGENTS.md` exists but planned files are outside `docker/`.

---

## Stage 1: Grafana Provider Capability

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Update Grafana Pulumi provider

- **Implements**: `observability` MODIFIED Requirement: `Current Grafana Runtime`
- **Depends on**: (none)
- **Files**: `package.json`, `bun.lock`
- **Approach**: Use Bun to update `@pulumiverse/grafana` to a version whose TypeScript schema exposes Grafana Git Sync repository resources. Preserve existing dependency style and update the root lockfile only.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: TypeScript completes successfully with the updated provider package and lockfile.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  bun add @pulumiverse/grafana@latest
  bun run typecheck
  ```
- **Output**:
  ```
  bun add v1.3.11 (af24e281)
  Resolving dependencies
  Resolved, downloaded and extracted [6]
  Saved lockfile

  + @pulumi/authentik@packages/authentik-provider/sdks/authentik

  installed @pulumiverse/grafana@2.30.0

  3 packages installed [4.25s]

  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `package.json`
  - `bun.lock`
- **AGENTS.md notes applied**: used Bun as required; did not expose secrets.
- **Subagent statuses**: none; Task 1.1 was inline.

- [x] Stage 1 complete

---

## Stage 2: Git Sync Repository Wiring

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Add Grafana Git Sync repository resource

- **Implements**: `observability` MODIFIED Requirement: `Current Grafana Runtime`; `observability` ADDED Requirement: `Grafana Git-Synced Dashboards`; `observability` ADDED Requirement: `Grafana Git Sync Token Stash`
- **Depends on**: Task 1.1
- **Files**: `programs/grafana/index.ts`
- **Approach**: Remove the existing Pulumi folder/dashboard provisioning loop. Add a `pulumi.Stash` reading `FORGEJO_ACCESS_TOKEN` as a secret input and pass the stashed output to the Grafana Git Sync repository resource. Configure the repository for the homelab Forgejo HTTPS remote, path `grafana/`, target folder sync, enabled polling, and direct write workflow only; keep datasources, auth, DB, alerting runtime, and deployment settings outside Git Sync.
- **Dispatch**: subagent
- **Dispatch rationale**: The provider resource shape depends on the updated package schema, and context isolation is useful for matching the new generated types precisely.

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: TypeScript completes successfully and the Git Sync repository resource compiles against the updated provider schema without exposing the token in non-secret outputs.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  bun run typecheck
  ```
- **Output**:
  ```
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `programs/grafana/index.ts`
- **AGENTS.md notes applied**: followed neighboring Pulumi Stash pattern; used secret material only through `pulumi.secret` and stashed secret output; did not add comments.
- **Subagent statuses**:
  - Task 2.1: DONE; coordinator adjusted the Stash input fallback to `process.env.FORGEJO_ACCESS_TOKEN ?? ""` and token output conversion to `String(v)` to match existing repository patterns, then re-ran verification.

- [x] Stage 2 complete

---

## Stage 3: Dashboard File Migration

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 3.1: Move dashboards to repository sync path

- **Implements**: `observability` ADDED Requirement: `Grafana Git-Synced Dashboards`
- **Depends on**: Task 2.1
- **Files**: `programs/grafana/dashboards/**`, `grafana/**`
- **Approach**: Move the existing dashboard folder tree from `programs/grafana/dashboards/` to top-level `grafana/` so the repository path configured in Git Sync owns the dashboard JSON files. Preserve folder names and dashboard JSON contents except for any changes required by Grafana Git Sync import constraints.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```
  test -d grafana
  test ! -d programs/grafana/dashboards
  bun -e 'const fs = require("fs"); const path = require("path"); const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => { const p = path.join(d, e.name); return e.isDirectory() ? walk(p) : [p]; }); for (const file of walk("grafana").filter(f => f.endsWith(".json"))) JSON.parse(fs.readFileSync(file, "utf8"));'
  bun run typecheck
  ```
- **Expected outcome**: top-level `grafana/` exists, the old dashboard provisioning directory is absent, every migrated dashboard JSON file parses successfully, and TypeScript still passes.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  mv "programs/grafana/dashboards" "grafana"
  test -d grafana && test ! -d programs/grafana/dashboards && bun -e 'const fs = require("fs"); const path = require("path"); const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => { const p = path.join(d, e.name); return e.isDirectory() ? walk(p) : [p]; }); for (const file of walk("grafana").filter(f => f.endsWith(".json"))) JSON.parse(fs.readFileSync(file, "utf8"));' && bun run typecheck
  ```
- **Output**:
  ```
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `programs/grafana/dashboards/**` moved to `grafana/**`
- **AGENTS.md notes applied**: preserved existing dashboard JSON contents and folder names; used Bun for verification.
- **Subagent statuses**: none; Task 3.1 was inline.

- [x] Stage 3 complete

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

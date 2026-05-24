# switch-embedding-model-to-4b Tasks

## Overview

Align all source-controlled references and filenames from the retired 8B embedding model to the served `Qwen/Qwen3-Embedding-4B` model across sibling repositories, including archives and benchmark documentation.

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| `kubernetes-workloads` ADDED: `Source-Controlled Embedding Model Reference Alignment` | 1.1, 2.1 |

## AGENTS.md Notes

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Use Bun instead of Yarn/NPM/Node; no comments unless explicitly requested; follow neighboring patterns; specify return types for public functions.
- `/home/rfhold/repos/rfhold/walter/AGENTS.md`: Avoid unnecessary comments; keep code self-documenting.
- `/home/rfhold/repos/rfhold/walter/walterd/AGENTS.md`: Go validation commands are `./scripts/check.sh go` and `./scripts/test.sh go`; keep code self-documenting and stable logging keys.
- `/home/rfhold/repos/rfhold/cuthulu/AGENTS.md`: Observability notes only for this change; no local style constraints beyond existing patterns.
- `/home/rfhold/repos/rfhold/waltr-research/AGENTS.md`: Go validation commands are `go build ./...` and `go test ./...`; avoid unnecessary comments.
- No `AGENTS.md` file was found at `/home/rfhold/repos/rfhold/re-search`; apply neighboring-file conventions.

## Stage 1: Reference Inventory

### Task 1.1: Inventory 8B embedding references and filenames

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Source-Controlled Embedding Model Reference Alignment`
- **Files**: source-controlled files under `/home/rfhold/repos/rfhold/*`, excluding dependency, generated, VCS, and build-output directories.
- **Approach**: Run a repository-wide search for the retired full model, standalone model, and provider-path identifiers; record the exact files and filenames to update.
- **Dispatch**: inline
- **Dispatch rationale**: The inventory defines the file set for implementation and verification.

### Stage Verification

- **Commands**:
  ```bash
  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'Qwen/Qwen3-Embedding-8B|Qwen3-Embedding-8B|qwen3-embedding-8b' /home/rfhold/repos/rfhold
  ```
- **Expected outcome**: Command exits 0 and produces a reviewed target list grouped by repository, including any filenames that contain the retired model identifier.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```bash
  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'Qwen/Qwen3-Embedding-8B|Qwen3-Embedding-8B|qwen3-embedding-8b' /home/rfhold/repos/rfhold
  ```
- **Output**:
  ```text
  Found active references in:
  - /home/rfhold/repos/rfhold/homelab/programs/agent-gateway/Pulumi.pantheon.yaml
  - /home/rfhold/repos/rfhold/homelab/programs/ai-inference/Pulumi.pantheon.yaml
  - /home/rfhold/repos/rfhold/homelab/skills/homelab/SKILL.md
  - /home/rfhold/repos/rfhold/walter/docker-compose.yml
  - /home/rfhold/repos/rfhold/walter/walterd/internal/config/indexer.go
  - /home/rfhold/repos/rfhold/walter/walterd/data/config.yaml
  - /home/rfhold/repos/rfhold/walter/manifests/base/walterd/app-config.yaml
  - /home/rfhold/repos/rfhold/walter/manifests/overlays/preview/config.yaml
  - /home/rfhold/repos/rfhold/walter/manifests/overlays/production/config.yaml
  - /home/rfhold/repos/rfhold/walter/docs/agent-gateway-test-proxy.md
  - /home/rfhold/repos/rfhold/walter/docs/model-benchmarks/README.md
  - /home/rfhold/repos/rfhold/walter/docs/model-benchmarks/agentgateway-vllm-qwen-qwen3-embedding-4b.md
  - /home/rfhold/repos/rfhold/cuthulu/machine/config/opencode.json
  - /home/rfhold/repos/rfhold/re-search/manifests/base/re-search-server/configmap.yaml

  Found historical/archive/plan references in:
  - /home/rfhold/repos/rfhold/homelab/docs/specs/changes/archive/2026-05-23-add-standalone-vllm-athena/**
  - /home/rfhold/repos/rfhold/homelab/docs/specs/changes/archive/2026-05-23-migrate-clients-to-agent-gateway/**
  - /home/rfhold/repos/rfhold/homelab/docs/specs/changes/archive/2026-05-23-migrate-agent-gateway/**
  - /home/rfhold/repos/rfhold/walter/.opencode/plans/k8s-deploy-and-tekton-ci.md
  - /home/rfhold/repos/rfhold/walter/.opencode/plans/session-recording-summarization-indexing.md
  - /home/rfhold/repos/rfhold/walter/.opencode/plans/meilisearch-vector-index.md
  - /home/rfhold/repos/rfhold/waltr-research/.opencode/plans/re-search-mvp.md

  Found active change text in docs/specs/changes/switch-embedding-model-to-4b/**.
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/switch-embedding-model-to-4b/tasks.md`
- **AGENTS.md notes applied**: all notes from `## AGENTS.md Notes`; no source content changed in this inventory stage.
- **Subagent statuses**: none; Task 1.1 was inline.

- [x] Stage 1 complete

---

## Stage 2: Reference Alignment

### Task 2.1: Replace 8B embedding references with 4B

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Source-Controlled Embedding Model Reference Alignment`
- **Depends on**: 1.1
- **Files**: `/home/rfhold/repos/rfhold/homelab/**`, `/home/rfhold/repos/rfhold/walter/**`, `/home/rfhold/repos/rfhold/cuthulu/**`, `/home/rfhold/repos/rfhold/re-search/**`, `/home/rfhold/repos/rfhold/waltr-research/**`, and any additional source-controlled files identified by Task 1.1.
- **Approach**: Replace retired embedding model identifiers with `Qwen/Qwen3-Embedding-4B` in file contents, update lower-case/provider-path identifiers to `qwen3-embedding-4b`, and rename source-controlled files whose names contain the retired model identifier. Include archived specs/tasks and documentation by design.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```bash
  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'Qwen/Qwen3-Embedding-8B|Qwen3-Embedding-8B|qwen3-embedding-8b' /home/rfhold/repos/rfhold
  python - <<'PY'
  from pathlib import Path
  root = Path('/home/rfhold/repos/rfhold')
  ignored = {'.git', 'node_modules', 'dist', 'build', '.next', '.svelte-kit', 'target', '.turbo', 'coverage'}
  matches = []
  for path in root.rglob('*'):
      if any(part in ignored for part in path.parts):
          continue
      if 'qwen3-embedding-8b' in path.name.lower():
          matches.append(str(path))
  if matches:
      print('\n'.join(matches))
      raise SystemExit(1)
  PY
  ```
- **Expected outcome**: Content search has no matches outside the active delta text describing the retired model, and filename check exits 0 with no retired `8B` embedding filenames.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```bash
  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'Qwen/Qwen3-Embedding-8B|Qwen3-Embedding-8B|qwen3-embedding-8b' /home/rfhold/repos/rfhold
  python - <<'PY'
  from pathlib import Path
  root = Path('/home/rfhold/repos/rfhold')
  ignored = {'.git', 'node_modules', 'dist', 'build', '.next', '.svelte-kit', 'target', '.turbo', 'coverage'}
  matches = []
  for path in root.rglob('*'):
      if any(part in ignored for part in path.parts):
          continue
      if 'qwen3-embedding-8b' in path.name.lower():
          matches.append(str(path))
  if matches:
      print('\n'.join(matches))
      raise SystemExit(1)
  PY
  ```
- **Output**:
  ```text
  /home/rfhold/repos/rfhold/homelab/docs/specs/changes/switch-embedding-model-to-4b/tasks.md:36:  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'Qwen/Qwen3-Embedding-8B|Qwen3-Embedding-8B|qwen3-embedding-8b' /home/rfhold/repos/rfhold
  /home/rfhold/repos/rfhold/homelab/docs/specs/changes/switch-embedding-model-to-4b/tasks.md:46:  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'Qwen/Qwen3-Embedding-8B|Qwen3-Embedding-8B|qwen3-embedding-8b' /home/rfhold/repos/rfhold
  /home/rfhold/repos/rfhold/homelab/docs/specs/changes/switch-embedding-model-to-4b/tasks.md:100:  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'Qwen/Qwen3-Embedding-8B|Qwen3-Embedding-8B|qwen3-embedding-8b' /home/rfhold/repos/rfhold
  /home/rfhold/repos/rfhold/homelab/docs/specs/changes/switch-embedding-model-to-4b/tasks.md:109:      if 'qwen3-embedding-8b' in path.name.lower():

  Filename scan produced no output and exited 0.
  ```
- **Files changed (across the stage)**:
  - `/home/rfhold/repos/rfhold/homelab/programs/agent-gateway/Pulumi.pantheon.yaml`
  - `/home/rfhold/repos/rfhold/homelab/programs/ai-inference/Pulumi.pantheon.yaml`
  - `/home/rfhold/repos/rfhold/homelab/skills/homelab/SKILL.md`
  - `/home/rfhold/repos/rfhold/homelab/docs/specs/changes/switch-embedding-model-to-4b/tasks.md`
  - `/home/rfhold/repos/rfhold/homelab/docs/specs/changes/switch-embedding-model-to-4b/specs/kubernetes-workloads/spec.md`
  - `/home/rfhold/repos/rfhold/homelab/docs/specs/changes/archive/2026-05-23-add-standalone-vllm-athena/tasks.md`
  - `/home/rfhold/repos/rfhold/homelab/docs/specs/changes/archive/2026-05-23-add-standalone-vllm-athena/specs/kubernetes-workloads/spec.md`
  - `/home/rfhold/repos/rfhold/homelab/docs/specs/changes/archive/2026-05-23-migrate-clients-to-agent-gateway/specs/kubernetes-workloads/spec.md`
  - `/home/rfhold/repos/rfhold/homelab/docs/specs/changes/archive/2026-05-23-migrate-agent-gateway/specs/kubernetes-workloads/spec.md`
  - `/home/rfhold/repos/rfhold/homelab/docs/specs/changes/archive/2026-05-23-migrate-agent-gateway/tasks.md`
  - `/home/rfhold/repos/rfhold/walter/docker-compose.yml`
  - `/home/rfhold/repos/rfhold/walter/walterd/internal/config/indexer.go`
  - `/home/rfhold/repos/rfhold/walter/walterd/data/config.yaml`
  - `/home/rfhold/repos/rfhold/walter/manifests/base/walterd/app-config.yaml`
  - `/home/rfhold/repos/rfhold/walter/manifests/overlays/preview/config.yaml`
  - `/home/rfhold/repos/rfhold/walter/manifests/overlays/production/config.yaml`
  - `/home/rfhold/repos/rfhold/walter/docs/agent-gateway-test-proxy.md`
  - `/home/rfhold/repos/rfhold/walter/docs/model-benchmarks/README.md`
  - `/home/rfhold/repos/rfhold/walter/docs/model-benchmarks/agentgateway-vllm-qwen-qwen3-embedding-4b.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/k8s-deploy-and-tekton-ci.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/session-recording-summarization-indexing.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/meilisearch-vector-index.md`
  - `/home/rfhold/repos/rfhold/cuthulu/machine/config/opencode.json`
  - `/home/rfhold/repos/rfhold/re-search/manifests/base/re-search-server/configmap.yaml`
  - `/home/rfhold/repos/rfhold/waltr-research/.opencode/plans/re-search-mvp.md`
- **AGENTS.md notes applied**: all notes from `## AGENTS.md Notes`; no stable specs were modified during execution.
- **Subagent statuses**:
  - Task 2.1: DONE_WITH_CONCERNS; accepted after restoring real verification commands and confirming both content and filename checks passed.

- [x] Stage 2 complete

---

## Review Summary Appendix

## CRITICAL

- None.

## WARNING

- None.

## SUGGESTION

- None.

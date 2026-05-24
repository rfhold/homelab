# migrate-clients-to-agent-gateway Tasks

## Overview

Migrate all source-controlled sibling repository references from the retired LiteLLM endpoint and retired GLM 4.7 Flash model to Agent Gateway. The change covers documentation, examples, tests, prompts, and active configuration while excluding dependency, generated, VCS, and build-output directories unless they are active source-controlled configuration.

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| `kubernetes-workloads` ADDED: `Sibling Repository Agent Gateway Client Migration` | 1.1, 2.1, 2.2, 2.3 |
| `kubernetes-workloads` MODIFIED: `Self-Hosted Model Name Preservation` | 2.1, 2.2, 2.3 |

## AGENTS.md Notes

- `/home/rfhold/repos/rfhold/.agents/AGENTS.md`: Organization context only; no extra implementation constraints beyond repository-local files.
- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Use Bun instead of Yarn/NPM/Node; no comments unless explicitly requested; follow neighboring patterns; specify return types for public functions.
- `/home/rfhold/repos/rfhold/homelab/docker/AGENTS.md`: Docker docs should follow existing image README patterns if touched.
- `/home/rfhold/repos/rfhold/cuthulu/AGENTS.md`: Observability notes only for this change; no local style constraints beyond existing patterns.
- `/home/rfhold/repos/rfhold/walter/AGENTS.md`: Avoid unnecessary comments; keep code self-documenting.
- `/home/rfhold/repos/rfhold/walter/walterd/AGENTS.md`: Go validation commands are `./scripts/check.sh go` and `./scripts/test.sh go`; keep code self-documenting and stable logging keys.
- `/home/rfhold/repos/rfhold/waltr-research/AGENTS.md`: Go validation commands are `go build ./...` and `go test ./...`; avoid unnecessary comments.
- `/home/rfhold/repos/rfhold/whispers/AGENTS.md`: Observability notes only for this change.
- No `AGENTS.md` files were found at the roots of `finance`, `common`, or `re-search`; apply neighboring-file conventions.

## Stage 1: Reference Inventory

### Task 1.1: Inventory LiteLLM and retired GLM references

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Sibling Repository Agent Gateway Client Migration`
- **Files**: source-controlled files under `/home/rfhold/repos/rfhold/*`, excluding dependency, generated, VCS, and build-output directories.
- **Approach**: Run a case-insensitive repository-wide search for `litellm`, `litellm.holdenitdown.net`, `zai-org/GLM-4.7-Flash`, GLM 4.7 Flash aliases, and `zai-glm-4.7`. Record the exact files to edit and identify allowed residual references that are requirements/spec history rather than active client configuration.
- **Dispatch**: inline
- **Dispatch rationale**: This establishes the dependency boundary and exception list for all later edits.

### Stage Verification

- **Commands**:
  ```bash
  rg -l -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'litellm|litellm\.holdenitdown\.net|zai-org/GLM-4\.7-Flash|GLM-4\.7-Flash|glm[-_/ ]?4\.7[-_/ ]?flash|zai-glm-4\.7|zai-org/glm-4\.7-flash' /home/rfhold/repos/rfhold
  ```
- **Expected outcome**: Command exits 0 and produces a reviewed target list grouped by repository, with any intentional residual references called out in the Evidence block.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```bash
  rg -l -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'litellm|litellm\.holdenitdown\.net|zai-org/GLM-4\.7-Flash|GLM-4\.7-Flash|glm[-_/ ]?4\.7[-_/ ]?flash|zai-glm-4\.7|zai-org/glm-4\.7-flash' /home/rfhold/repos/rfhold
  ```
- **Output**:
  ```text
  Found matches in these repositories: common, cuthulu, finance, homelab, re-search, walter, waltr-research, whispers.

  common: active go eval specs/tests/catalog/grading files plus archived specs/tasks.
  cuthulu: active app e2e file, active machine config, stable desktop-app and machines specs, archived specs/tasks.
  finance: active Android LLM client plus `.opencode/plans` references.
  homelab: active Agent Gateway Pulumi config, LiteLLM program/component/image metadata, Grafana LiteLLM dashboard, stable specs, docker docs, skill/README/research docs, archived specs/tasks, and this change folder.
  re-search: active Kubernetes configmap.
  walter: active config, env example, docker compose, skill, docs, model benchmark docs, walterd Go code/tests/configs/manifests, opencode-agent config/session, and `.opencode/plans` references.
  waltr-research: SUMMARY and `.opencode/plans` references.
  whispers: `.opencode/plans` reference.
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/migrate-clients-to-agent-gateway/tasks.md`
- **AGENTS.md notes applied**: all notes from `## AGENTS.md Notes`; no source code changed in this inventory stage.
- **Subagent statuses**: none; Task 1.1 was inline.
- **Intentional residual candidates for Stage 2 verification**: archived `docs/specs/changes/archive/**` files, historical `.opencode/plans/**` files, this active change folder, and stable specs that must only be modified by code-review remain candidates for documented residual history unless they describe active client behavior requiring a new delta in their owning repository.

- [x] Stage 1 complete

---

## Stage 2: Repository Migration

Batch execute tasks that can be run in parallel sub agents.

### Task 2.1: Migrate homelab Agent Gateway and infrastructure references

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Sibling Repository Agent Gateway Client Migration`; `kubernetes-workloads` MODIFIED Requirement: `Self-Hosted Model Name Preservation`
- **Depends on**: 1.1
- **Files**: `/home/rfhold/repos/rfhold/homelab/**`
- **Approach**: Remove GLM 4.7 Flash from Agent Gateway client-facing configuration and update homelab documentation/spec-change references that still advertise LiteLLM or the retired model as current behavior. Preserve historical archive references only when Stage 1 explicitly records them as intentional residual history.
- **Dispatch**: subagent

### Task 2.2: Migrate Walter and Cuthulu client/runtime references

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Sibling Repository Agent Gateway Client Migration`; `kubernetes-workloads` MODIFIED Requirement: `Self-Hosted Model Name Preservation`
- **Depends on**: 1.1
- **Files**: `/home/rfhold/repos/rfhold/walter/**`, `/home/rfhold/repos/rfhold/cuthulu/**`
- **Approach**: Replace baked OpenCode provider names, endpoint URLs, model catalogs, tests, docs, and active stable specs from LiteLLM to Agent Gateway. Drop GLM 4.7 Flash from advertised model catalogs and benchmark/docs indexes. Preserve active CI/e2e behavior by routing through Agent Gateway's OpenAI-compatible endpoint.
- **Dispatch**: subagent

### Task 2.3: Migrate remaining sibling repository references

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Sibling Repository Agent Gateway Client Migration`; `kubernetes-workloads` MODIFIED Requirement: `Self-Hosted Model Name Preservation`
- **Depends on**: 1.1
- **Files**: `/home/rfhold/repos/rfhold/common/**`, `/home/rfhold/repos/rfhold/finance/**`, `/home/rfhold/repos/rfhold/re-search/**`, `/home/rfhold/repos/rfhold/waltr-research/**`, `/home/rfhold/repos/rfhold/whispers/**`, and any additional sibling repositories identified by Task 1.1 outside the Task 2.1 and 2.2 file sets.
- **Approach**: Update docs, examples, tests, prompts, manifests, and configuration from LiteLLM to Agent Gateway and remove retired GLM model references. Follow existing file-local naming conventions for provider identifiers; use `agentgateway` or `agent-gateway` consistently with surrounding code where a provider key must be renamed.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```bash
  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'litellm\.holdenitdown\.net|zai-org/GLM-4\.7-Flash|GLM-4\.7-Flash|glm[-_/ ]?4\.7[-_/ ]?flash|zai-org/glm-4\.7-flash' /home/rfhold/repos/rfhold
  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'litellm' /home/rfhold/repos/rfhold
  ```
- **Expected outcome**: First command has no matches outside approved spec/change-history text recorded in Stage 1 evidence. Second command has no active client endpoint, provider config, model catalog, test, prompt, example, manifest, or current documentation matches; any remaining matches are explicitly documented historical/spec references.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```bash
  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'litellm\.holdenitdown\.net|zai-org/GLM-4\.7-Flash|GLM-4\.7-Flash|glm[-_/ ]?4\.7[-_/ ]?flash|zai-org/glm-4\.7-flash' /home/rfhold/repos/rfhold
  rg -n -i --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/.svelte-kit/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' 'litellm' /home/rfhold/repos/rfhold
  rg -n -i 'LiteLLMURL|LiteLLMAPIKey|LITELLM_URL|LITELLM_API_KEY|litellm/cerebras|default_model: litellm|NARRATOR_BASE_URL: "https://litellm|`litellm/` prefix|to LiteLLM|LiteLLM expects|HTTP POST → litellm|HTTP POST to litellm|LiteLLM proxy|<litellm-api-key>|External services.*LiteLLM' /home/rfhold/repos/rfhold --glob '*.md'
  rg -n -i 'litellm' /home/rfhold/repos/rfhold/homelab/programs/grafana/dashboards --glob '*.json'
  ```
- **Output**:
  ```text
  First command: returned only expected delta text, stable specs awaiting code-review merge, archived specs/tasks, and homelab edge-networking stable no-compatibility references; no active code/config endpoint or GLM 4.7 Flash matches.

  Second command: output was very large and was truncated by the tool; full output was saved to /home/rfhold/.local/share/opencode/tool-output/tool_e56e4b5470026tLoGHhe2ZBnRh. Visible residuals were stable specs awaiting code-review merge, archived specs/tasks, Walter historical changelog text, homelab retired LiteLLM stack source (`programs/litellm/Pulumi.yaml`, `src/components/litellm.ts`, `src/docker-images.ts`), and history/spec text. Active client endpoint, provider config, model catalog, test, prompt, example, manifest, and current documentation references were patched or deleted.

  Targeted active-plan/current-doc check:
  Found 4 matches
  /home/rfhold/repos/rfhold/homelab/docs/specs/changes/migrate-clients-to-agent-gateway/specs/kubernetes-workloads/spec.md: Line 9: All source-controlled sibling repository references to LiteLLM endpoints and client-facing model names are migrated to Agent Gateway semantics. GLM 4.7 Flash is removed from client-facing references because it is no longer served.
  /home/rfhold/repos/rfhold/cuthulu/docs/specs/changes/archive/2026-05-22-bake-litellm-opencode-provider/tasks.md: Lines 87, 96, 108: archived historical task text.

  Grafana dashboard check:
  No files found
  ```
- **Files changed (across the stage)**:
  - `/home/rfhold/repos/rfhold/homelab/programs/agent-gateway/Pulumi.pantheon.yaml`
  - `/home/rfhold/repos/rfhold/homelab/docker/vllm/README.md`
  - `/home/rfhold/repos/rfhold/homelab/skills/homelab/SKILL.md`
  - `/home/rfhold/repos/rfhold/homelab/docs/specs/changes/add-standalone-vllm-athena/specs/kubernetes-workloads/spec.md`
  - `/home/rfhold/repos/rfhold/homelab/programs/grafana/dashboards/litellm/litellm.json`
  - `/home/rfhold/repos/rfhold/homelab/README.md`
  - `/home/rfhold/repos/rfhold/cuthulu/app/e2e/desktop-webdriver-e2e.ts`
  - `/home/rfhold/repos/rfhold/cuthulu/machine/config/opencode.json`
  - `/home/rfhold/repos/rfhold/common/go/evals/catalog.go`
  - `/home/rfhold/repos/rfhold/common/go/evals/catalog_test.go`
  - `/home/rfhold/repos/rfhold/common/go/evals/grading.go`
  - `/home/rfhold/repos/rfhold/common/go/evals/grading_test.go`
  - `/home/rfhold/repos/rfhold/common/go/evals/harness_prompt_eval_test.go`
  - `/home/rfhold/repos/rfhold/common/go/evals/harness_self_prompt_eval_test.go`
  - `/home/rfhold/repos/rfhold/finance/android/app/src/main/java/dev/rholden/finance/llm/LlmClient.kt`
  - `/home/rfhold/repos/rfhold/re-search/manifests/base/re-search-server/configmap.yaml`
  - `/home/rfhold/repos/rfhold/waltr-research/SUMMARY.md`
  - `/home/rfhold/repos/rfhold/waltr-research/.opencode/plans/deterministic-research-orchestration.md`
  - `/home/rfhold/repos/rfhold/waltr-research/.opencode/plans/otel-trace-propagation.md`
  - `/home/rfhold/repos/rfhold/finance/.opencode/plans/android-finance-app-setup.md`
  - `/home/rfhold/repos/rfhold/finance/.opencode/plans/llm-dashboard-chart-widgets.md`
  - `/home/rfhold/repos/rfhold/whispers/.opencode/plans/walter-otel-distributed-tracing.md`
  - `/home/rfhold/repos/rfhold/walter/.env.example`
  - `/home/rfhold/repos/rfhold/walter/config/v1.json`
  - `/home/rfhold/repos/rfhold/walter/docker-compose.yml`
  - `/home/rfhold/repos/rfhold/walter/docs/agent-gateway-test-proxy.md`
  - `/home/rfhold/repos/rfhold/walter/docs/alt-agent-plan.md`
  - `/home/rfhold/repos/rfhold/walter/docs/model-benchmarks/README.md`
  - `/home/rfhold/repos/rfhold/walter/docs/model-benchmarks/agentgateway-*.md`
  - `/home/rfhold/repos/rfhold/walter/manifests/base/walterd/app-config.yaml`
  - `/home/rfhold/repos/rfhold/walter/manifests/overlays/preview/config.yaml`
  - `/home/rfhold/repos/rfhold/walter/manifests/overlays/production/config.yaml`
  - `/home/rfhold/repos/rfhold/walter/opencode-agent/config.json`
  - `/home/rfhold/repos/rfhold/walter/opencode-agent/src/session.ts`
  - `/home/rfhold/repos/rfhold/walter/skills/walter/SKILL.md`
  - `/home/rfhold/repos/rfhold/walter/walterd/cmd/walterd/main.go`
  - `/home/rfhold/repos/rfhold/walter/walterd/data/config.yaml`
  - `/home/rfhold/repos/rfhold/walter/walterd/data/config.yaml.example`
  - `/home/rfhold/repos/rfhold/walter/walterd/internal/modes/provider_config_test.go`
  - `/home/rfhold/repos/rfhold/walter/walterd/internal/providerauth/oauth_service_test.go`
  - `/home/rfhold/repos/rfhold/walter/walterd/pkg/component/llm.go`
  - `/home/rfhold/repos/rfhold/walter/walterd/pkg/llm/integration_test.go`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/delegate-llm-providers-to-components.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/fix-nats-pubsub-proto-serialization.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/k8s-deploy-and-tekton-ci.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/live-config-rearchitecture.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/unified-llm-client-instrumentation.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/voice-to-agent-end-to-end-tracing.md`
  - `/home/rfhold/repos/rfhold/walter/.opencode/plans/waltr-opencode-implementation.md`
- **AGENTS.md notes applied**: all notes from `## AGENTS.md Notes`; no stable specs under `docs/specs/{domain}/spec.md` were edited during execution.
- **Subagent statuses**:
  - Task 2.1: DONE
  - Task 2.2: DONE
  - Task 2.3: DONE_WITH_CONCERNS; accepted because remaining `.opencode/plans` concerns were patched inline and verification shows only approved historical/spec residuals.

- [x] Stage 2 complete

---

## Review Summary Appendix

## CRITICAL

- None.

## WARNING

- `Sibling Repository Agent Gateway Client Migration`: implementation must define the exact scan exclusions and residual-reference exception list before editing so repository-wide coverage is verifiable.

## SUGGESTION

- None.

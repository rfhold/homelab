# Tasks: add-tauri-e2e-ci-image

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `deployment` ADDED: `Generic Tauri E2E CI Image` | 1.1 |
| `deployment` ADDED: `Tauri E2E CI Image Build Pipeline` | 2.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `AGENTS.md`: Follow existing neighboring-file patterns, use Bun instead of Yarn/NPM/Node, and do not commit secrets.
- `docker/AGENTS.md`: New Docker images should test actual image functionality, not just container startup. Existing CI image directories (`bun-ci`, `android-ci`, `go-ci`) currently use Dockerfile-only image directories and Tekton BuildKit workflows, so this plan follows that local CI-image pattern rather than adding GitHub workflows, README files, or docker-compose files for this CI helper image.
- No additional `AGENTS.md` files exist under `docs/specs/` or `.tekton/`.

---

## Stage 1: Tauri E2E CI Image

### Task 1.1: Add reusable Tauri e2e CI Dockerfile

- **Implements**: `deployment` ADDED Requirement: `Generic Tauri E2E CI Image`
- **Depends on**: (none)
- **Files**: `docker/tauri-e2e-ci/Dockerfile`
- **Approach**: Add a pinned Bun-based CI image that installs Rust/Cargo, Git/SSH/CA certificates, Docker CLI, Xvfb/headless display tooling, and Linux GTK/WebKit/Tauri build/runtime dependencies. Configure supported package sources to use the existing internal apt, Bun/npm, and Cargo mirrors following the neighboring `bun-ci` and `android-ci` patterns.
- **Dispatch**: subagent
- **Dispatch rationale**: Package selection and image validation benefit from context isolation while the file set is bounded.

### Stage Verification

- **Commands**:
  ```
  docker build -t tauri-e2e-ci:local docker/tauri-e2e-ci
  docker run --rm tauri-e2e-ci:local sh -lc 'command -v bun && command -v cargo && command -v rustc && command -v git && command -v ssh && command -v docker && command -v Xvfb && pkg-config --exists gtk+-3.0 && pkg-config --exists webkit2gtk-4.1'
  ```
- **Expected outcome**: The image builds successfully; the container exposes required CLI tools; `pkg-config` confirms GTK and WebKit development packages are available.
- **Evidence artifact**: inline in this stage's Evidence block

#### Evidence

- **Date**: 2026-05-21
- **Commands**:
  ```
  docker build -t tauri-e2e-ci:local docker/tauri-e2e-ci
  docker run --rm tauri-e2e-ci:local sh -lc 'command -v bun && command -v cargo && command -v rustc && command -v git && command -v ssh && command -v docker && command -v Xvfb && pkg-config --exists gtk+-3.0 && pkg-config --exists webkit2gtk-4.1'
  ```
- **Output**:
  ```
  #12 naming to docker.io/library/tauri-e2e-ci:local done
  #12 unpacking to docker.io/library/tauri-e2e-ci:local 8.6s done
  #12 DONE 35.3s
  /usr/local/bin/bun
  /usr/local/bin/cargo
  /usr/local/bin/rustc
  /usr/bin/git
  /usr/bin/ssh
  /usr/bin/docker
  /usr/bin/Xvfb
  ```
- **Files changed (across the stage)**:
  - `docker/tauri-e2e-ci/Dockerfile`
- **AGENTS.md notes applied**: Followed neighboring Dockerfile-only CI image patterns; verified actual image functionality rather than only container startup.
- **Subagent statuses**:
  - Task 1.1: DONE

- [x] Stage 1 complete

---

## Stage 2: Tauri E2E CI Image Pipeline

### Task 2.1: Add Tekton BuildKit publish pipeline

- **Implements**: `deployment` ADDED Requirement: `Tauri E2E CI Image Build Pipeline`
- **Depends on**: Task 1.1
- **Files**: `.tekton/build-tauri-e2e-ci.yaml`
- **Approach**: Add a Homelab Tekton PipelineRun matching the existing CI image BuildKit pattern. Scope path changes to `.tekton/build-tauri-e2e-ci.yaml` and `docker/tauri-e2e-ci/**`, publish `{{ CONTAINER_REGISTRY }}/rfhold/tauri-e2e-ci:latest`, and keep `incoming` support for manual rebuilds.
- **Dispatch**: inline
- **Dispatch rationale**: This is a mechanical copy of the neighboring CI image pipeline pattern after the image path exists.

### Stage Verification

- **Commands**:
  ```
  ruby -e 'require "yaml"; YAML.load_file(".tekton/build-tauri-e2e-ci.yaml")'
  rg -n 'homelab-build-tauri-e2e-ci|rfhold/tauri-e2e-ci:latest|docker/tauri-e2e-ci|on-path-change: "\[\.tekton/build-tauri-e2e-ci\.yaml, docker/tauri-e2e-ci/\*\*\]"' .tekton/build-tauri-e2e-ci.yaml
  ```
- **Expected outcome**: Ruby parses the PipelineRun YAML successfully, and ripgrep finds the pipeline name, published image, build context, and path filter.
- **Evidence artifact**: inline in this stage's Evidence block

#### Evidence

- **Date**: 2026-05-21
- **Commands**:
  ```
  ruby -e 'require "yaml"; YAML.load_file(".tekton/build-tauri-e2e-ci.yaml")'
  rg -n 'homelab-build-tauri-e2e-ci|rfhold/tauri-e2e-ci:latest|docker/tauri-e2e-ci|on-path-change: "\[\.tekton/build-tauri-e2e-ci\.yaml, docker/tauri-e2e-ci/\*\*\]"' .tekton/build-tauri-e2e-ci.yaml
  ```
- **Output**:
  ```
  4:  name: homelab-build-tauri-e2e-ci
  8:    pipelinesascode.tekton.dev/on-path-change: "[.tekton/build-tauri-e2e-ci.yaml, docker/tauri-e2e-ci/**]"
  50:            value: "{{ CONTAINER_REGISTRY }}/rfhold/tauri-e2e-ci:latest"
  54:            value: docker/tauri-e2e-ci
  ```
- **Files changed (across the stage)**:
  - `.tekton/build-tauri-e2e-ci.yaml`
- **AGENTS.md notes applied**: Followed neighboring Tekton BuildKit CI image pipeline patterns.
- **Subagent statuses**:
  - Task 2.1: inline implementation complete

- [x] Stage 2 complete

---

## Follow-ups

`<!-- FOLLOW-UP(2026-05-21): Update Cuthulu's preview WebDriver task to consume cr.holdenitdown.net/rfhold/tauri-e2e-ci:latest after this image build exists. Reference: cuthulu .tekton/cuthulu-server-preview-push.yaml. -->`

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: (none — CRITICAL findings return the change to `writing-specs` before planning)
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

# Tasks: add-bun-ci-image

**Status**: complete

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `deployment` ADDED: `Generic Bun CI Image` | 1.1 |
| `deployment` ADDED: `Bun CI Image Build Pipeline` | 1.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: Follow neighboring file patterns, do not commit secrets, use Bun instead of Yarn/NPM/Node where package tooling is needed.
- `/home/rfhold/repos/rfhold/homelab/docker/AGENTS.md`: New Docker images should test actual image functionality. Existing CI image directories (`go-ci`, `rust-ci`, `android-ci`) currently use Dockerfile-only image directories and Tekton build workflows, so this plan follows that local CI-image pattern rather than adding GitHub workflow or docker-compose files.

---

## Stage 1: Bun CI Image

### Task 1.1: Add Bun CI image and build workflow

- **Implements**: `deployment` ADDED Requirement: `Generic Bun CI Image`; `deployment` ADDED Requirement: `Bun CI Image Build Pipeline`
- **Depends on**: (none)
- **Files**: `docker/bun-ci/Dockerfile`, `.tekton/build-bun-ci.yaml`
- **Approach**: Add a pinned `oven/bun:1.3` based image that installs `git`, `openssh-client`, and `ca-certificates`. Configure supported package sources to use internal mirrors, including the apt mirror for OS packages and Bun's npm registry mirror for package resolution. Add a Tekton PipelineRun matching the existing homelab CI image build pattern, publishing `{{ CONTAINER_REGISTRY }}/rfhold/bun-ci:latest` from `docker/bun-ci` and scoped to `.tekton/build-bun-ci.yaml` plus `docker/bun-ci/**` path changes.
- **Dispatch**: inline
- **Dispatch rationale**: Small, mechanical change following an existing neighboring pattern; no context-isolation or parallelism benefit.

### Stage Verification

- **Commands**:
  ```
  git diff --check -- docker/bun-ci .tekton/build-bun-ci.yaml docs/specs/changes/add-bun-ci-image
  docker build -t rfhold/bun-ci:test docker/bun-ci
  docker run --rm rfhold/bun-ci:test sh -lc 'bun --version && git --version && ssh -V'
  docker run --rm rfhold/bun-ci:test sh -lc 'grep -R apt-mirrors.holdenitdown.net /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null && grep -R mirrors.holdenitdown.net/npm /root/.bunfig.toml /home/bun/.bunfig.toml 2>/dev/null'
  rg -n 'rfhold/bun-ci:latest|docker/bun-ci|homelab-build-bun-ci|on-path-change: "\[\.tekton/build-bun-ci\.yaml, docker/bun-ci/\*\*\]"' .tekton/build-bun-ci.yaml
  ```
- **Expected outcome**: Diff check passes; local image builds; container reports Bun, Git, and OpenSSH client versions; container shows internal apt and npm mirror configuration; Tekton workflow contains the expected image, context, name, and path filter.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-13
- **Commands**:
  ```
  git diff --check -- docker/bun-ci .tekton/build-bun-ci.yaml docs/specs/changes/add-bun-ci-image
  docker build -t rfhold/bun-ci:test docker/bun-ci
  docker run --rm rfhold/bun-ci:test sh -lc 'bun --version && git --version && ssh -V'
  docker run --rm rfhold/bun-ci:test sh -lc 'grep -R apt-mirrors.holdenitdown.net /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null && grep -R mirrors.holdenitdown.net/npm /root/.bunfig.toml /home/bun/.bunfig.toml 2>/dev/null'
  rg -n 'rfhold/bun-ci:latest|docker/bun-ci|homelab-build-bun-ci|on-path-change: "\[\.tekton/build-bun-ci\.yaml, docker/bun-ci/\*\*\]"' .tekton/build-bun-ci.yaml
  ```
- **Output**:
  ```
  #0 building with "default" instance using docker driver
  #1 [internal] load build definition from Dockerfile
  #1 transferring dockerfile: 702B done
  #1 DONE 0.0s
  #2 resolve image config for docker-image://docker.io/docker/dockerfile:1
  #2 DONE 0.3s
  #3 docker-image://docker.io/docker/dockerfile:1@sha256:2780b5c3bab67f1f76c781860de469442999ed1a0d7992a5efdf2cffc0e3d769
  #3 CACHED
  #4 [internal] load metadata for docker.io/oven/bun:1.3
  #4 DONE 0.2s
  #5 [internal] load .dockerignore
  #5 transferring context: 2B done
  #5 DONE 0.0s
  #6 [1/4] FROM docker.io/oven/bun:1.3@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
  #6 CACHED
  #7 [2/4] RUN touch /etc/apt/sources.list &&     sed -i 's|http://deb.debian.org|http://apt-mirrors.holdenitdown.net|g' /etc/apt/sources.list.d/debian.sources
  #7 DONE 0.1s
  #8 [3/4] RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends     ca-certificates     git     openssh-client   && rm -rf /var/lib/apt/lists/*
  #8 DONE 129.7s
  #9 [4/4] RUN printf '[install]\nregistry = "https://mirrors.holdenitdown.net/npm/"\n' > /root/.bunfig.toml &&     mkdir -p /home/bun &&     printf '[install]\nregistry = "https://mirrors.holdenitdown.net/npm/"\n' > /home/bun/.bunfig.toml &&     chown bun:bun /home/bun/.bunfig.toml
  #9 DONE 0.2s
  #10 exporting to image
  #10 naming to docker.io/rfhold/bun-ci:test done
  #10 DONE 4.3s
  1.3.14
  git version 2.47.3
  OpenSSH_10.0p2 Debian-7+deb13u2, OpenSSL 3.5.5 27 Jan 2026
  /etc/apt/sources.list.d/debian.sources:URIs: http://apt-mirrors.holdenitdown.net/debian
  /etc/apt/sources.list.d/debian.sources:URIs: http://apt-mirrors.holdenitdown.net/debian-security
  /root/.bunfig.toml:registry = "https://mirrors.holdenitdown.net/npm/"
  /home/bun/.bunfig.toml:registry = "https://mirrors.holdenitdown.net/npm/"
  4:  name: homelab-build-bun-ci
  8:    pipelinesascode.tekton.dev/on-path-change: "[.tekton/build-bun-ci.yaml, docker/bun-ci/**]"
  50:            value: "{{ CONTAINER_REGISTRY }}/rfhold/bun-ci:latest"
  54:            value: docker/bun-ci
  ```
- **Files changed (across the stage)**:
  - `.tekton/build-bun-ci.yaml`
  - `docker/bun-ci/Dockerfile`
  - `docs/specs/changes/add-bun-ci-image/specs/deployment/spec.md`
  - `docs/specs/changes/add-bun-ci-image/tasks.md`
- **AGENTS.md notes applied**: Followed neighboring homelab CI image and Tekton build patterns; did not add secrets; tested actual image functionality per `docker/AGENTS.md`.
- **Subagent statuses**: None; Task 1.1 executed inline.

- [x] Stage 1 complete

---

## Follow-ups

`<!-- FOLLOW-UP(2026-05-13): After rfhold/bun-ci:latest is built and available in the registry, update dot's opencode-plugin-pin-update workflow to use it and re-dispatch the workflow. -->`

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: (none — CRITICAL findings return the change to `writing-specs` before planning)
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

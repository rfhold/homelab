## Review Summary

No CRITICAL findings.

## WARNING

- **ADDED Requirement: Gemma llama.cpp Model Workload** — line 33 allows `unsloth/gemma-4-E2B-it-GGUF:Q6_K` or an equivalent resolved GGUF artifact. Implementation MUST pin the concrete llama.cpp server argument path or resolver behavior in stack configuration so verification can inspect it.

No SUGGESTION findings.

## AGENTS.md Notes

- `AGENTS.md`: Do not add comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets; always specify return types for public functions; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/specs/`, `src/`, or `programs/`.

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| `kubernetes-workloads` ADDED Requirement: Standalone Configurable llama.cpp Program | 1.1, 2.1 |
| `kubernetes-workloads` ADDED Requirement: Gemma llama.cpp Model Workload | 2.1 |
| `kubernetes-workloads` ADDED Requirement: llama.cpp Athena GPU Scheduling | 1.1, 2.1 |
| `kubernetes-workloads` ADDED Requirement: Agent Gateway Routing for Gemma llama.cpp | 4.1, 5.1 |
| `kubernetes-workloads` ADDED Requirement: Internal-Only llama.cpp Service | 1.1, 2.1 |
| `kubernetes-workloads` ADDED Requirement: Stash-Captured Hugging Face Token for Standalone Inference | 3.1 |

## Stage 1: llama.cpp Component

### Task 1.1: Add reusable llama.cpp server component

- **Implements**: `kubernetes-workloads` ADDED Requirement: Standalone Configurable llama.cpp Program; `kubernetes-workloads` ADDED Requirement: llama.cpp Athena GPU Scheduling; `kubernetes-workloads` ADDED Requirement: Internal-Only llama.cpp Service
- **Depends on**: none
- **Files**: `src/components/llama-cpp.ts`, `src/docker-images.ts`
- **Approach**: Add a reusable component that mirrors the existing vLLM component shape where appropriate: Deployment, internal Service, optional NFS-backed model cache, configurable image, runtime class, node selector, tolerations, resources, environment, and llama.cpp server arguments. Add a default CUDA-capable llama.cpp server image constant.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  ```
- **Expected outcome**: TypeScript compilation exits successfully with no errors.
- **Evidence artifact**: Inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  bun run typecheck
  ```
- **Output**:
  ```text
  $ tsc --noEmit
  ```
- **Files changed (across the stage)**:
  - `src/components/llama-cpp.ts`
  - `src/docker-images.ts`
  - `src/modules/grafana-stack.ts`
- **AGENTS.md notes applied**: Used Bun for verification; followed neighboring Pulumi component patterns; did not add new comments or secrets.
- **Subagent statuses**:
  - Task 1.1: DONE
- **Notes**: The first verification attempt exposed a new component type error and then an unrelated dirty-worktree Grafana tolerations type mismatch. The component error was fixed, and the user approved a minimal Grafana type fix so the exact Stage Verification command could pass.

- [x] Stage 1 complete

## Stage 2: Gemma Stack

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Add Gemma llama.cpp standalone program and stack

- **Implements**: `kubernetes-workloads` ADDED Requirement: Standalone Configurable llama.cpp Program; `kubernetes-workloads` ADDED Requirement: Gemma llama.cpp Model Workload; `kubernetes-workloads` ADDED Requirement: llama.cpp Athena GPU Scheduling; `kubernetes-workloads` ADDED Requirement: Internal-Only llama.cpp Service
- **Depends on**: 1.1
- **Files**: `programs/llama-cpp/Pulumi.yaml`, `programs/llama-cpp/index.ts`, `programs/llama-cpp/Pulumi.gemma-4-e2b.yaml`
- **Approach**: Add a standalone llama.cpp Pulumi program and `gemma-4-e2b` stack using namespace `llama-cpp`, internal Service, model cache on `mars.holdenitdown.net:/export/models`, NVIDIA runtime, Athena placement, GPU inference toleration, and configurable CPU/memory/GPU resources. Configure the client-facing model name as `gemma-4-e2b` and pin the concrete llama.cpp server model argument or resolver behavior for `unsloth/gemma-4-E2B-it-GGUF:Q6_K`.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/llama-cpp" -s gemma-4-e2b --non-interactive
  ```
- **Expected outcome**: TypeScript compilation exits successfully; Pulumi preview renders a llama.cpp Deployment and internal Service with NVIDIA runtime, Athena placement, GPU taint toleration, model cache, no HTTPRoute, and server arguments for model `gemma-4-e2b` backed by the pinned Gemma GGUF source.
- **Evidence artifact**: Inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  bun run typecheck
  pulumi stack init gemma-4-e2b -C "programs/llama-cpp" --non-interactive
  pulumi preview -C "programs/llama-cpp" -s gemma-4-e2b --non-interactive
  ```
- **Output**:
  ```text
  $ tsc --noEmit

  Created stack 'gemma-4-e2b'

  Previewing update (gemma-4-e2b):

   +  pulumi:pulumi:Stack llama-cpp-gemma-4-e2b create
   +  homelab:components:LlamaCpp gemma-4-e2b create
   +  kubernetes:core/v1:Namespace llama-cpp create
   +  kubernetes:core/v1:PersistentVolumeClaim gemma-4-e2b-model-cache create
   +  kubernetes:core/v1:PersistentVolume gemma-4-e2b-model-cache-pv create
   +  kubernetes:core/v1:Service gemma-4-e2b-service create
   +  kubernetes:apps/v1:Deployment gemma-4-e2b-deployment create

  Outputs:
      modelName  : "gemma-4-e2b"
      serviceName: "gemma-4-e2b"
      serviceUrl : "http://gemma-4-e2b.llama-cpp.svc.cluster.local:8000"

  Resources:
      + 7 to create
  ```
- **Files changed (across the stage)**:
  - `programs/llama-cpp/Pulumi.yaml`
  - `programs/llama-cpp/index.ts`
  - `programs/llama-cpp/Pulumi.gemma-4-e2b.yaml`
- **AGENTS.md notes applied**: Used Bun for verification; followed the existing standalone vLLM program pattern; did not add comments or secrets.
- **Subagent statuses**:
  - Task 2.1: DONE
- **Notes**: The first Pulumi preview attempt failed because the new stack did not exist yet, so `pulumi stack init` was run before rerunning the planned preview.

- [x] Stage 2 complete

## Stage 3: Hugging Face Token Stashing

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 3.1: Add Stash-captured Hugging Face token support

- **Implements**: `kubernetes-workloads` ADDED Requirement: Stash-Captured Hugging Face Token for Standalone Inference
- **Depends on**: 2.1
- **Files**: `programs/vllm/index.ts`, `src/components/llama-cpp.ts`, `programs/llama-cpp/index.ts`
- **Approach**: Update standalone vLLM and llama.cpp programs to capture `HF_TOKEN` with Pulumi Stash and fail before rendering token-dependent workloads when `HF_TOKEN` is unset. Reuse the existing vLLM Kubernetes Secret environment path, and add matching llama.cpp component Secret environment injection for `HF_TOKEN` and `HUGGING_FACE_HUB_TOKEN` as needed by llama.cpp Hugging Face downloads.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/vllm" -s qwen3-embedding --non-interactive
  pulumi preview -C "programs/llama-cpp" -s gemma-4-e2b --non-interactive
  ```
- **Expected outcome**: TypeScript compilation exits successfully; both previews render Pulumi Stash-backed token handling and Kubernetes Secret environment injection without exposing the Hugging Face token value in output.
- **Evidence artifact**: Inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/vllm" -s qwen3-embedding --non-interactive
  pulumi preview -C "programs/llama-cpp" -s gemma-4-e2b --non-interactive
  ```
- **Output**:
  ```text
  $ tsc --noEmit

  Previewing update (qwen3-embedding):

   +  pulumi:index:Stash hf-token create
   +  kubernetes:core/v1:Secret qwen3-embedding-secret create
   ~  kubernetes:apps/v1:Deployment qwen3-embedding-deployment update [diff: ~spec]
      pulumi:pulumi:Stack vllm-qwen3-embedding
  Resources:
      + 2 to create
      ~ 1 to update
      3 changes. 6 unchanged

  Previewing update (gemma-4-e2b):

   +  pulumi:pulumi:Stack llama-cpp-gemma-4-e2b create
   +  homelab:components:LlamaCpp gemma-4-e2b create
   +  pulumi:index:Stash hf-token create
   +  kubernetes:core/v1:Namespace llama-cpp create
   +  kubernetes:core/v1:Secret gemma-4-e2b-secret create
   +  kubernetes:core/v1:Service gemma-4-e2b-service create
   +  kubernetes:core/v1:PersistentVolume gemma-4-e2b-model-cache-pv create
   +  kubernetes:core/v1:PersistentVolumeClaim gemma-4-e2b-model-cache create
   +  kubernetes:apps/v1:Deployment gemma-4-e2b-deployment create
  Outputs:
      modelName  : "gemma-4-e2b"
      serviceName: "gemma-4-e2b"
      serviceUrl : "http://gemma-4-e2b.llama-cpp.svc.cluster.local:8000"

  Resources:
      + 9 to create
  ```
- **Files changed (across the stage)**:
  - `programs/vllm/index.ts`
  - `src/components/llama-cpp.ts`
  - `programs/llama-cpp/index.ts`
- **AGENTS.md notes applied**: Used Bun for verification; followed existing Pulumi Stash token patterns; did not expose the Hugging Face token value in preview output.
- **Subagent statuses**:
  - Task 3.1: DONE

- [x] Stage 3 complete

## Stage 4: Agent Gateway Routing

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 4.1: Add Agent Gateway Gemma route

- **Implements**: `kubernetes-workloads` ADDED Requirement: Agent Gateway Routing for Gemma llama.cpp
- **Depends on**: 3.1
- **Files**: `programs/agent-gateway/Pulumi.pantheon.yaml`
- **Approach**: Add an Agent Gateway provider entry like the existing Qwen vLLM backend, targeting the internal llama.cpp Gemma service and routing `/v1/chat/completions`, `/v1/models`, and passthrough requests for model alias `gemma-4-e2b`.
- **Dispatch**: inline
- **Dispatch rationale**: This is a small config-only follow-up that depends on the service name produced by Stage 2.

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/agent-gateway" -s pantheon --non-interactive
  ```
- **Expected outcome**: TypeScript compilation exits successfully; Pulumi preview renders an Agent Gateway backend and model route for `gemma-4-e2b` targeting the internal llama.cpp service without changing unrelated provider routes.
- **Evidence artifact**: Inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/agent-gateway" -s pantheon --non-interactive
  ```
- **Output**:
  ```text
  $ tsc --noEmit

  Previewing update (pantheon):

   ~  pulumi:index:Stash chutes-api-key update
   ~  pulumi:index:Stash anthropic-api-key update
   ~  pulumi:index:Stash openai-api-key update
   ~  pulumi:index:Stash cerebras-api-key update
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-llama-cpp-gemma-4-e2b-backend create
   ~  kubernetes:gateway.networking.k8s.io/v1:HTTPRoute agent-gateway-httproute update [diff: ~metadata,spec]
      pulumi:pulumi:Stack agent-gateway-pantheon
  Outputs:
    ~ backendNames: [
          [0]: "openai"
          [1]: "anthropic"
          [2]: "chutes"
          [3]: "cerebras"
          [4]: "vllm-qwen3-embedding-4b"
        + [5]: "llama-cpp-gemma-4-e2b"
      ]

  Resources:
      + 1 to create
      ~ 5 to update
      6 changes. 26 unchanged
  ```
- **Files changed (across the stage)**:
  - `programs/agent-gateway/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: Used Bun for verification; followed the existing local vLLM Agent Gateway provider pattern; did not add secrets.
- **Subagent statuses**: none; Task 4.1 executed inline.

- [x] Stage 4 complete

## Stage 5: Deployment Verification

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 5.1: Deploy and verify Gemma through Agent Gateway

- **Implements**: `kubernetes-workloads` ADDED Requirement: Gemma llama.cpp Model Workload; `kubernetes-workloads` ADDED Requirement: Agent Gateway Routing for Gemma llama.cpp; `kubernetes-workloads` ADDED Requirement: Internal-Only llama.cpp Service
- **Depends on**: 4.1
- **Files**: `docs/specs/changes/add-llama-cpp-gemma-server/tasks.md`
- **Approach**: Apply the llama.cpp stack, apply the Agent Gateway stack, verify the workload becomes ready on Pantheon, confirm the service remains internal-only, and send an OpenAI-compatible chat completion request for model `gemma-4-e2b` through `https://agent-gateway.holdenitdown.net`.
- **Dispatch**: inline
- **Dispatch rationale**: Live deployment verification needs coordinator control over Pulumi and cluster commands.

### Stage Verification

- **Commands**:
  ```bash
  pulumi up -C "programs/llama-cpp" -s gemma-4-e2b --non-interactive --yes
  pulumi up -C "programs/agent-gateway" -s pantheon --non-interactive --yes
  kubectl rollout status deployment/gemma-4-e2b -n llama-cpp --context=pantheon --timeout=600s
  kubectl get httproute -A --context=pantheon
  ```
- **Expected outcome**: Pulumi updates complete successfully; the Gemma llama.cpp Deployment is ready; no direct public llama.cpp HTTPRoute is present; a public Agent Gateway chat completion request for model `gemma-4-e2b` returns a successful OpenAI-compatible response.
- **Evidence artifact**: Inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  pulumi up -C "programs/llama-cpp" -s gemma-4-e2b --non-interactive --yes
  pulumi up -C "programs/agent-gateway" -s pantheon --non-interactive --yes
  kubectl rollout status deployment/gemma-4-e2b -n llama-cpp --context=pantheon --timeout=600s
  kubectl get httproute -A --context=pantheon
  python3 -c 'import json, urllib.request; data=json.dumps({"model":"gemma-4-e2b","messages":[{"role":"user","content":"Reply with exactly: gemma ok"}],"max_tokens":16,"temperature":0}).encode(); req=urllib.request.Request("https://agent-gateway.holdenitdown.net/v1/chat/completions", data=data, headers={"Content-Type":"application/json"}, method="POST"); res=urllib.request.urlopen(req, timeout=120); body=json.loads(res.read()); print(res.status); print(body.get("model")); print(body["choices"][0]["message"].get("content", ""))'
  ```
- **Output**:
  ```text
  Updating (gemma-4-e2b):
  Outputs:
      modelName  : "gemma-4-e2b"
      serviceName: "gemma-4-e2b"
      serviceUrl : "http://gemma-4-e2b.llama-cpp.svc.cluster.local:8000"

  Resources:
      + 9 created

  Duration: 1m27s

  Updating (pantheon):
  Outputs:
    ~ backendNames: [
          [0]: "openai"
          [1]: "anthropic"
          [2]: "chutes"
          [3]: "cerebras"
          [4]: "vllm-qwen3-embedding-4b"
        + [5]: "llama-cpp-gemma-4-e2b"
      ]
      gateway     : "agentgateway-proxy"
      routeUrl    : "https://agent-gateway.holdenitdown.net"

  Resources:
      + 1 created
      ~ 5 updated
      6 changes. 26 unchanged

  Duration: 11s

  deployment "gemma-4-e2b" successfully rolled out

  NAMESPACE             NAME                       HOSTNAMES                                      AGE
  agentgateway-system   agent-gateway              ["agent-gateway.holdenitdown.net"]             6h10m
  alloy                 grafana-stack-alloy-faro   ["faro.holdenitdown.net"]                      74d
  axol-preview          client                     ["preview-axol.holdenitdown.net"]              74d
  axol                  client                     ["axol.holdenitdown.net"]                      74d
  cuthulu-preview       cuthulu-server             ["cuthulu-preview.holdenitdown.net"]           3d4h
  cuthulu               cuthulu-server             ["cuthulu.holdenitdown.net"]                   75d
  firecrawl             firecrawl-route            ["firecrawl.holdenitdown.net"]                 178d
  home-assistant        reverse-proxy-route        ["home.holdenitdown.net"]                      189d
  litellm               litellm                    ["litellm.holdenitdown.net"]                   115d
  media-server          jellyfin                   ["jellyfin.holdenitdown.net"]                  125d
  media-server          overseerr                  ["overseerr.holdenitdown.net"]                 187d
  media-server          plex                       ["plex.holdenitdown.net"]                      187d
  media-server          prowlarr                   ["prowlarr.holdenitdown.net"]                  187d
  media-server          radarr                     ["radarr.holdenitdown.net"]                    187d
  media-server          sabnzbd                    ["sabnzbd.holdenitdown.net"]                   187d
  media-server          sonarr                     ["sonarr.holdenitdown.net"]                    187d
  media-server          tautulli                   ["tautulli.holdenitdown.net"]                  187d
  media-server          transmission               ["transmission.holdenitdown.net"]              187d
  package-mirrors       apt-proxy-route            ["apt-mirrors.holdenitdown.net"]               67d
  package-mirrors       mirrors-route              ["mirrors.holdenitdown.net"]                   67d
  re-search             re-search-server           ["re-search.holdenitdown.net"]                 46d
  scrybe                scrybe-backend             ["scrybe.holdenitdown.net"]                    34d
  tmux-server           tmux-server                ["tmux.holdenitdown.net"]                      97d
  walter-preview        atlassian-query            ["preview-atlassian-query.holdenitdown.net"]   67d
  walter-preview        gitops-query               ["preview-gitops-query.holdenitdown.net"]      72d
  walter-preview        grafana-query              ["preview-grafana-query.holdenitdown.net"]     78d
  walter-preview        gsuite-query               ["preview-gsuite-query.holdenitdown.net"]      38d
  walter-preview        slack-query                ["preview-slack-query.holdenitdown.net"]       47d
  walter-preview        walterd-route              ["preview-walter.holdenitdown.net"]            89d
  walter                gitops-query               ["gitops-query.holdenitdown.net"]              70d
  walter                kokoro-service-route       ["kokoro.holdenitdown.net"]                    97d
  walter                walterd-route              ["walter.holdenitdown.net"]                    89d
  walter                whisper-service-route      ["whisperx.holdenitdown.net"]                  106d
  whispers-preview      whispers-server-route      ["whispers-preview.holdenitdown.net"]          81d
  whispers              whispers-server-route      ["whispers.holdenitdown.net"]                  79d

  200
  gemma-4-e2b
  gemma ok
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/add-llama-cpp-gemma-server/tasks.md`
- **AGENTS.md notes applied**: Used explicit `--context=pantheon`; verified no direct llama.cpp HTTPRoute was present; public verification used Agent Gateway only.
- **Subagent statuses**: none; Task 5.1 executed inline.

- [x] Stage 5 complete

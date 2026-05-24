# Tasks: replace-ai-inference-with-mars-qwen-llama-cpp

## AGENTS.md Notes

- Root `AGENTS.md`: no comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets; public functions need return types; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/`, `programs/`, or `src/` for the planned file paths.

## Review Summary

- CRITICAL: None.
- WARNING: None.
- SUGGESTION: None.

## Requirements

- `kubernetes-workloads` ADDED Requirement: Legacy ai-inference Stack Retirement
- `kubernetes-workloads` ADDED Requirement: Qwen3.6 llama.cpp Model Workload
- `kubernetes-workloads` ADDED Requirement: llama.cpp Mars GPU Scheduling
- `kubernetes-workloads` ADDED Requirement: Agent Gateway Routing for Qwen3.6 llama.cpp
- `kubernetes-workloads` MODIFIED Requirement: Internal-Only llama.cpp Service

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| Legacy ai-inference Stack Retirement | 2.1 |
| Qwen3.6 llama.cpp Model Workload | 1.1, 2.2, 3.1 |
| llama.cpp Mars GPU Scheduling | 1.1, 2.2, 3.1 |
| Agent Gateway Routing for Qwen3.6 llama.cpp | 1.2, 2.3 |
| Internal-Only llama.cpp Service | 1.1, 2.2 |

## Stage 1: Configuration

Batch execute tasks that can be run in parallel sub agents.

### Task 1.1: Add Mars Qwen llama.cpp stack

- **Implements**: `kubernetes-workloads` ADDED Requirement: Qwen3.6 llama.cpp Model Workload; `kubernetes-workloads` ADDED Requirement: llama.cpp Mars GPU Scheduling; `kubernetes-workloads` MODIFIED Requirement: Internal-Only llama.cpp Service
- **Files**: `programs/llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml`; `programs/llama-cpp/index.ts`; `src/components/llama-cpp.ts`
- **Approach**: Add a separate stack configuration for `qwen3.6-35b-a3b` using `unsloth/Qwen3.6-35B-A3B-GGUF`, artifact `Qwen3.6-35B-A3B-UD-Q6_K.gguf`, Mars node placement, NVIDIA runtime, GPU taint toleration, existing NFS model cache, internal Service only, `contextSize: 65536`, and `parallel: 1`. Only change shared code if existing stack configuration fields cannot express the Mars placement or model artifact.
- **Dispatch**: subagent

### Task 1.2: Add Agent Gateway Qwen route

- **Implements**: `kubernetes-workloads` ADDED Requirement: Agent Gateway Routing for Qwen3.6 llama.cpp
- **Files**: `programs/agent-gateway/Pulumi.pantheon.yaml`; `programs/agent-gateway/index.ts`
- **Approach**: Add an Agent Gateway backend/provider route for client model `qwen3.6-35b-a3b` targeting the internal Qwen llama.cpp Service, preserving the existing `gemma-4-e2b` route unchanged. Only change program code if the current config schema cannot express the additional backend.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive
  pulumi preview -C "programs/agent-gateway" -s pantheon --non-interactive
  ```
- **Expected outcome**: Typecheck exits 0; llama.cpp preview renders a Mars-targeted internal Qwen service without modifying Gemma; Agent Gateway preview adds the Qwen route while preserving Gemma.
- **Evidence artifact**: Inline in this stage's Evidence block.

- [x] Stage 1 complete

### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive
  pulumi stack init qwen3.6-35b-a3b -C "programs/llama-cpp"
  pulumi preview -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive
  pulumi preview -C "programs/agent-gateway" -s pantheon --non-interactive
  ```
- **Output**:
  ```text
  $ bun run typecheck
  $ tsc --noEmit

  $ pulumi preview -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive
  error: no stack named 'qwen3.6-35b-a3b' found

  $ pulumi stack init qwen3.6-35b-a3b -C "programs/llama-cpp"
  Created stack 'qwen3.6-35b-a3b'

  $ pulumi preview -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive
  Previewing update (qwen3.6-35b-a3b):
  + pulumi:pulumi:Stack llama-cpp-qwen3.6-35b-a3b create
  + homelab:components:LlamaCpp qwen3-6-35b-a3b create
  + pulumi:index:Stash hf-token create
  + kubernetes:core/v1:Namespace llama-cpp create
  + kubernetes:core/v1:PersistentVolume qwen3-6-35b-a3b-model-cache-pv create
  + kubernetes:core/v1:Service qwen3-6-35b-a3b-service create
  + kubernetes:core/v1:PersistentVolumeClaim qwen3-6-35b-a3b-model-cache create
  + kubernetes:core/v1:Secret qwen3-6-35b-a3b-secret create
  + kubernetes:apps/v1:Deployment qwen3-6-35b-a3b-deployment create
  Outputs:
      modelName  : "qwen3.6-35b-a3b"
      serviceName: "qwen3-6-35b-a3b"
      serviceUrl : "http://qwen3-6-35b-a3b.llama-cpp.svc.cluster.local:8000"
  Resources:
      + 9 to create

  $ pulumi preview -C "programs/agent-gateway" -s pantheon --non-interactive
  Previewing update (pantheon):
  + kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-llama-cpp-qwen3-6-35b-a3b-backend create
  ~ kubernetes:gateway.networking.k8s.io/v1:HTTPRoute agent-gateway-httproute update [diff: ~metadata,spec]
  Outputs:
    ~ backendNames: [..., "llama-cpp-gemma-4-e2b", "llama-cpp-qwen3-6-35b-a3b"]
  Resources:
      + 1 to create
      ~ 1 to update
      2 changes. 31 unchanged
  ```
- **Files changed (across the stage)**:
  - `programs/llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml`
  - `programs/agent-gateway/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: Followed root notes to avoid comments, preserve neighboring patterns, avoid secrets, and use Bun for typecheck.
- **Subagent statuses**:
  - Task 1.1: DONE
  - Task 1.2: DONE

---

## Stage 2: Reconcile And Verify

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Destroy legacy ai-inference stack

- **Implements**: `kubernetes-workloads` ADDED Requirement: Legacy ai-inference Stack Retirement
- **Depends on**: Stage 1
- **Files**: `programs/ai-inference/Pulumi.pantheon.yaml`; `programs/ai-inference/index.ts`; `programs/ai-inference/Pulumi.yaml`
- **Approach**: Run the legacy Pantheon ai-inference stack destroy and confirm active client-facing model serving no longer depends on `ai-inference` namespace workloads. Do not remove standalone `vllm` Qwen embedding resources.
- **Dispatch**: inline
- **Dispatch rationale**: Destructive infrastructure command requires coordinator control after plan approval.

### Task 2.2: Deploy Mars Qwen llama.cpp stack

- **Implements**: `kubernetes-workloads` ADDED Requirement: Qwen3.6 llama.cpp Model Workload; `kubernetes-workloads` ADDED Requirement: llama.cpp Mars GPU Scheduling; `kubernetes-workloads` MODIFIED Requirement: Internal-Only llama.cpp Service
- **Depends on**: Stage 1
- **Files**: `programs/llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml`
- **Approach**: Deploy the Qwen stack, wait for rollout, verify pod placement on Mars, inspect `/props` for the served model and 64k context, and verify no direct public HTTPRoute exists for the service.
- **Dispatch**: inline

### Task 2.3: Deploy Agent Gateway and test Qwen route

- **Implements**: `kubernetes-workloads` ADDED Requirement: Agent Gateway Routing for Qwen3.6 llama.cpp
- **Depends on**: 2.2
- **Files**: `programs/agent-gateway/Pulumi.pantheon.yaml`
- **Approach**: Deploy Agent Gateway changes, then send OpenAI-compatible chat completion requests through `https://agent-gateway.holdenitdown.net` for `qwen3.6-35b-a3b` and `gemma-4-e2b` to verify independent routing.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```bash
  pulumi destroy -C "programs/ai-inference" -s pantheon --non-interactive --yes
  pulumi up -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive --yes
  kubectl rollout status deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon
  pulumi up -C "programs/agent-gateway" -s pantheon --non-interactive --yes
  ```
- **Expected outcome**: `ai-inference` stack destroy succeeds; Qwen llama.cpp rollout completes on Mars; Qwen `/props` reports model `qwen3.6-35b-a3b` and `n_ctx: 65536`; Agent Gateway chat completions succeed for both `qwen3.6-35b-a3b` and existing `gemma-4-e2b`.
- **Evidence artifact**: Inline in this stage's Evidence block.

- [x] Stage 2 complete

### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  pulumi destroy -C "programs/ai-inference" -s pantheon --non-interactive --yes
  pulumi up -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive --yes
  kubectl rollout status deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon
  pulumi up -C "programs/agent-gateway" -s pantheon --non-interactive --yes
  kubectl get pods -n llama-cpp --context=pantheon -l app=qwen3-6-35b-a3b -o wide
  kubectl get httproute -A --context=pantheon
  kubectl get ns ai-inference --context=pantheon
  kubectl exec deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon -- curl -s http://127.0.0.1:8000/props
  python3 - <<'PY'
  import json, time, urllib.request
  for model, prompt, max_tokens in [("qwen3.6-35b-a3b", "Reply with exactly: qwen ok", 256), ("gemma-4-e2b", "Reply exactly: gemma ok", 16)]:
      payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens, "temperature": 0}
      req = urllib.request.Request("https://agent-gateway.holdenitdown.net/v1/chat/completions", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"}, method="POST")
      start = time.perf_counter()
      with urllib.request.urlopen(req, timeout=300) as res:
          body = json.loads(res.read())
          msg = body["choices"][0]["message"]
          print(json.dumps({"model": model, "status": res.status, "elapsed": round(time.perf_counter() - start, 3), "content": msg.get("content", ""), "reasoning_len": len(msg.get("reasoning_content", "")), "usage": body.get("usage")}, sort_keys=True))
  PY
  ```
- **Output**:
  ```text
  $ pulumi destroy -C "programs/ai-inference" -s pantheon --non-interactive --yes
  Resources:
      - 11 deleted
  Duration: 16s
  The resources in the stack have been deleted, but the history and configuration associated with the stack are still maintained.

  $ pulumi up -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive --yes
  Outputs:
      modelName  : "qwen3.6-35b-a3b"
      serviceName: "qwen3-6-35b-a3b"
      serviceUrl : "http://qwen3-6-35b-a3b.llama-cpp.svc.cluster.local:8000"
  Resources:
      + 9 created
  Duration: 5m21s

  $ kubectl rollout status deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon
  deployment "qwen3-6-35b-a3b" successfully rolled out

  $ pulumi up -C "programs/agent-gateway" -s pantheon --non-interactive --yes
  Resources:
      + 1 created
      ~ 1 updated
      2 changes. 31 unchanged
  Outputs:
      backendNames: [..., "llama-cpp-gemma-4-e2b", "llama-cpp-qwen3-6-35b-a3b"]
      routeUrl    : "https://agent-gateway.holdenitdown.net"
  Duration: 7s

  $ kubectl get pods -n llama-cpp --context=pantheon -l app=qwen3-6-35b-a3b -o wide
  NAME                               READY   STATUS    RESTARTS   AGE     IP            NODE
  qwen3-6-35b-a3b-546f7874cc-4vm9j   1/1     Running   0          6m43s   10.42.1.102   mars

  $ kubectl get httproute -A --context=pantheon
  NAMESPACE             NAME                       HOSTNAMES
  agentgateway-system   agent-gateway              ["agent-gateway.holdenitdown.net"]
  ...
  No llama-cpp namespace HTTPRoute was present.

  $ kubectl get ns ai-inference --context=pantheon
  Error from server (NotFound): namespaces "ai-inference" not found

  $ kubectl exec deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon -- curl -s http://127.0.0.1:8000/props
  {"default_generation_settings":{"params":{...},"n_ctx":65536},"total_slots":1,"model_alias":"qwen3.6-35b-a3b","model_path":"/root/.cache/huggingface/hub/models--unsloth--Qwen3.6-35B-A3B-GGUF/snapshots/a483e9e6cbd595906af30beda3187c2663a1118c/Qwen3.6-35B-A3B-UD-Q6_K.gguf",...}

  $ python3 gateway chat checks
  {"content": "qwen ok", "elapsed": 1.6, "model": "qwen3.6-35b-a3b", "reasoning_len": 631, "status": 200, "usage": {"completion_tokens": 179, "prompt_tokens": 17, "prompt_tokens_details": {"cached_tokens": 0}, "total_tokens": 196}}
  {"content": "gemma ok", "elapsed": 0.401, "model": "gemma-4-e2b", "reasoning_len": 0, "status": 200, "usage": {"completion_tokens": 4, "prompt_tokens": 22, "prompt_tokens_details": {"cached_tokens": 0}, "total_tokens": 26}}
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/replace-ai-inference-with-mars-qwen-llama-cpp/tasks.md`
- **AGENTS.md notes applied**: Followed root notes to avoid comments, preserve neighboring patterns, avoid secrets, and use Bun for verification.
- **Subagent statuses**: None; Stage 2 tasks were inline.

---

## Stage 3: Max Context Update

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 3.1: Raise Qwen context to 262144

- **Implements**: `kubernetes-workloads` ADDED Requirement: Qwen3.6 llama.cpp Model Workload; `kubernetes-workloads` ADDED Requirement: llama.cpp Mars GPU Scheduling
- **Depends on**: Stage 2
- **Files**: `programs/llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml`
- **Approach**: Update the Qwen llama.cpp stack context size to `262144` while keeping `parallel: 1`, deploy the stack, wait for rollout, confirm `/props` reports `n_ctx: 262144`, and run a boundary test through Agent Gateway that verifies the enlarged context is accepted without truncation.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive
  pulumi up -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive --yes
  kubectl rollout status deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon
  ```
- **Expected outcome**: Typecheck exits 0; preview shows only the Qwen context-size update; rollout completes on Mars; Qwen `/props` reports `model_alias: qwen3.6-35b-a3b`, `total_slots: 1`, and `n_ctx: 262144`; an Agent Gateway prompt larger than 64k tokens is accepted without truncation.
- **Evidence artifact**: Inline in this stage's Evidence block.

- [x] Stage 3 complete

### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive
  pulumi up -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive --yes
  kubectl rollout status deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon
  kubectl exec deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon -- curl -s http://127.0.0.1:8000/props
  kubectl get pods -n llama-cpp --context=pantheon -l app=qwen3-6-35b-a3b -o wide
  kubectl exec deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon -- nvidia-smi
  python3 gateway near-262k prompt test
  kubectl logs deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon --since=8m
  kubectl exec deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon -- nvidia-smi
  ```
- **Output**:
  ```text
  $ bun run typecheck
  $ tsc --noEmit

  $ pulumi preview -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive
  Previewing update (qwen3.6-35b-a3b):
  ~ kubernetes:apps/v1:Deployment qwen3-6-35b-a3b-deployment update [diff: ~spec]
  Resources:
      ~ 1 to update
      8 unchanged

  $ pulumi up -C "programs/llama-cpp" -s qwen3.6-35b-a3b --non-interactive --yes
  ~ kubernetes:apps/v1:Deployment qwen3-6-35b-a3b-deployment updated (271s) [diff: ~spec]
  Outputs:
      modelName  : "qwen3.6-35b-a3b"
      serviceName: "qwen3-6-35b-a3b"
      serviceUrl : "http://qwen3-6-35b-a3b.llama-cpp.svc.cluster.local:8000"
  Resources:
      ~ 1 updated
      8 unchanged
  Duration: 4m35s

  $ kubectl rollout status deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon
  deployment "qwen3-6-35b-a3b" successfully rolled out

  $ kubectl exec deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon -- curl -s http://127.0.0.1:8000/props
  {"default_generation_settings":{"params":{...},"n_ctx":262144},"total_slots":1,"model_alias":"qwen3.6-35b-a3b","model_path":"/root/.cache/huggingface/hub/models--unsloth--Qwen3.6-35B-A3B-GGUF/snapshots/a483e9e6cbd595906af30beda3187c2663a1118c/Qwen3.6-35B-A3B-UD-Q6_K.gguf",...}

  $ kubectl get pods -n llama-cpp --context=pantheon -l app=qwen3-6-35b-a3b -o wide
  NAME                               READY   STATUS    RESTARTS   AGE     IP            NODE
  qwen3-6-35b-a3b-79d647689-g9w4t   1/1     Running   0          6m31s   10.42.1.103   mars

  $ kubectl exec deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon -- nvidia-smi
  NVIDIA RTX A6000, Memory-Usage: 36913MiB / 49140MiB, GPU-Util: 0%

  $ python3 gateway near-262k prompt test
  {"rejected_n": 9900, "http": 400, "err": "request (266254 tokens) exceeds the available context size (262144 tokens)"}
  {"accepted_n": 9700, "status": 200, "elapsed": 173.909, "chars": 1337610, "content": "", "reasoning_len": 123, "finish_reason": "length", "usage": {"completion_tokens": 32, "prompt_tokens": 260854, "prompt_tokens_details": {"cached_tokens": 0}, "total_tokens": 260886}}

  $ kubectl logs deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon --since=8m
  slot load_model: id 0 | task -1 | new slot, n_ctx = 262144
  send_error: request (266254 tokens) exceeds the available context size (262144 tokens)
  slot print_timing: id 0 | task 18 | prompt eval time = 172318.40 ms / 260854 tokens (0.66 ms per token, 1513.79 tokens per second)
  slot print_timing: id 0 | task 18 | eval time = 550.71 ms / 32 tokens (17.21 ms per token, 58.11 tokens per second)
  slot print_timing: id 0 | task 18 | total time = 172869.11 ms / 260886 tokens
  slot release: id 0 | task 18 | stop processing: n_tokens = 260885, truncated = 0

  $ kubectl exec deployment/qwen3-6-35b-a3b -n llama-cpp --context=pantheon -- nvidia-smi
  NVIDIA RTX A6000, Memory-Usage: 36933MiB / 49140MiB, GPU-Util: 0%
  ```
- **Files changed (across the stage)**:
  - `programs/llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml`
  - `docs/specs/changes/replace-ai-inference-with-mars-qwen-llama-cpp/tasks.md`
- **AGENTS.md notes applied**: Followed root notes to avoid comments, preserve neighboring patterns, avoid secrets, and use Bun for verification.
- **Subagent statuses**: None; Stage 3 tasks were inline.

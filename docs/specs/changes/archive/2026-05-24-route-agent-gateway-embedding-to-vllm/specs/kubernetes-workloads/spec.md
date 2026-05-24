## Change Overview

### Why

Agent Gateway still routes the Qwen3 embedding backend to the old `ai-inference` Service even though the served embedding workload is now the standalone vLLM stack in namespace `vllm`.

### Impact

Agent Gateway routes `Qwen/Qwen3-Embedding-4B` embedding requests to the standalone `qwen3-embedding` vLLM Service and no longer depends on the old `ai-inference` embedding Service.

### Non-goals

- Changing the standalone `programs/vllm/Pulumi.qwen3-embedding.yaml` stack.
- Changing the `Qwen/Qwen3-Embedding-4B` model alias.
- Adding temporary dual routing for the old embedding Service.

### Rollback

Rollback is performed by reverting the Agent Gateway backend host to the previous embedding Service only if the standalone vLLM embedding Service is unavailable.

## MODIFIED Requirements

### Requirement: Self-Hosted Model Name Preservation
The system MUST preserve complete self-hosted model names when routing to local vLLM-compatible backends that remain served by Agent Gateway.

#### Scenario: retired GLM self-hosted model is excluded
Given a client-facing model inventory is rendered for Agent Gateway
When GLM 4.7 Flash is no longer served
Then the system MUST NOT include `zai-org/GLM-4.7-Flash` as an available self-hosted model

#### Scenario: embedding self-hosted model keeps full name
Given a client requests model `Qwen/Qwen3-Embedding-4B`
When Agent Gateway forwards the request to the local embedding backend
Then the system MUST send model `Qwen/Qwen3-Embedding-4B` to the upstream backend

#### Scenario: embedding backend targets standalone vLLM Service
Given Agent Gateway renders the backend for model `Qwen/Qwen3-Embedding-4B`
When the backend provider target is inspected
Then the system MUST target `qwen3-embedding.vllm.svc.cluster.local:8000`
And the system MUST NOT target `ai-inference-qwen3-embedding-4b.ai-inference.svc.cluster.local`

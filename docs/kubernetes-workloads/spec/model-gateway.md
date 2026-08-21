# Model Gateway

## Purpose

This specification governs client-facing model routing, provider transformations, and the internal backends owned by Agent Gateway and Codex Proxy. Edge hostname and certificate behavior is defined by the [edge route specification](../../edge-networking/spec/routes.md).

## Requirements

### Requirement: Dedicated Agent Gateway Program

Agent Gateway MUST be owned by a dedicated Pantheon Pulumi program rather than the ingress or LiteLLM programs. Its controller and CRD charts MUST use stable release `v1.4.1`.

#### Scenario: Gateway resources are rendered

- Given the Agent Gateway stack is selected
- When Pulumi constructs the gateway resources
- Then the dedicated program creates Agent Gateway resources for Pantheon with both charts at `v1.4.1`

### Requirement: Agent Gateway Replaces LiteLLM Routing

Client-facing LLM routing MUST use Agent Gateway and MUST NOT require a LiteLLM Deployment or Service. Agent Gateway MUST represent OpenAI, Anthropic, Chutes, Cerebras, Codex Proxy, standalone vLLM, and standalone llama.cpp backends. No compatibility route for `litellm.holdenitdown.net` is required.

#### Scenario: A client sends a model request

- Given the requested model has a configured Agent Gateway provider
- When the request reaches the model endpoint
- Then Agent Gateway selects that provider without a LiteLLM runtime dependency

#### Scenario: Provider coverage is rendered

- Given the Agent Gateway stack is selected
- When its backend configuration is inspected
- Then it represents OpenAI, Anthropic, Chutes, Cerebras, Codex Proxy, standalone vLLM, and standalone llama.cpp backends

### Requirement: Read-Only Admin UI

Agent Gateway MUST expose its Kubernetes Admin UI at `https://agent-gateway.holdenitdown.net/ui/` through the existing Gateway. An `AgentgatewayParameters` resource attached through the Gateway infrastructure MUST bind the admin listener to pod interfaces on port `15000`. A dedicated ClusterIP Service MUST proxy exact paths `/` and `/config_dump` plus prefixes `/ui` and `/api` to that listener without path modification. Exact `/config_dump` MUST provide the read-only xDS route inventory required by the UI. The UI MUST remain read-only while exposing administrative runtime, configuration, and log inspection. The body-derived PreRouting model policy MUST target the Gateway and MUST conditionally exclude exact `/`, exact `/config_dump`, and the `/ui` and `/api` path segments from model extraction.

#### Scenario: An operator inspects Agent Gateway

- Given an operator requests `/`, `/config_dump`, `/ui`, or `/api` on `agent-gateway.holdenitdown.net`
- When the Admin UI HTTPRoute forwards the request
- Then the attached `AgentgatewayParameters` binds the admin listener to pod interfaces on port `15000`
- And the dedicated ClusterIP Service sends the unchanged path to that listener
- And the UI permits read-only runtime, configuration, and log inspection
- And exact `/config_dump` returns the read-only xDS route inventory required by the UI
- And the Gateway-level body-derived model policy condition does not process the request, including exact `/config_dump`

### Requirement: Standalone Backend Ownership

Active local model routing MUST target standalone vLLM or llama.cpp Services and MUST NOT depend on the legacy `ai-inference` namespace or its model Services.

#### Scenario: Local backends are rendered

- Given Agent Gateway configuration declares a self-hosted model
- When its provider target is inspected
- Then it resolves to the corresponding standalone `vllm` or `llama-cpp` Service

### Requirement: Legacy ai-inference Retirement

The legacy `ai-inference` Pulumi stack MUST remain retired from active Pantheon model serving. Active client-facing model routing MUST NOT depend on its namespace or model Services, and retirement MUST NOT remove the standalone vLLM Qwen3 embedding stack.

#### Scenario: Active model serving is reconciled

- Given model serving is owned by standalone inference stacks and Agent Gateway
- When Pantheon model-serving dependencies are inspected
- Then no active route requires the legacy `ai-inference` stack, namespace, or model Services
- And the standalone `Qwen/Qwen3-Embedding-4B` vLLM backend remains independently owned

### Requirement: Provider Model Transformation

Providers configured with a client prefix MUST remove only that prefix before forwarding upstream. Providers configured with exact model aliases MUST map the client model to the declared upstream value. Self-hosted aliases MAY preserve the complete model name.

#### Scenario: A prefixed external model is requested

- Given a client model starts with `openai/`, `anthropic/`, or `codex/`
- When Agent Gateway forwards the request
- Then it removes the matching configured prefix and preserves the remainder

#### Scenario: The embedding model is requested

- Given a client requests `Qwen/Qwen3-Embedding-4B`
- When Agent Gateway selects the local embedding backend
- Then it targets `qwen3-embedding.vllm.svc.cluster.local:8000` and preserves the complete model name

### Requirement: Codex Proxy Boundary

Codex Proxy MUST be owned by a dedicated Pantheon Pulumi program rather than Agent Gateway, LiteLLM, or ingress. Its workload MUST use `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76`, persist data at `/app/data`, and provide an internal ClusterIP Service. Request-body logging, automatic updates, and proxy IP health checks MUST be disabled or omitted by default, and Agent Gateway MUST NOT send an authorization credential to the proxy unless a later contract explicitly requires one.

#### Scenario: Codex-backed model routing is rendered

- Given a client requests a `codex/` model
- When Agent Gateway selects Codex Proxy
- Then it targets the internal OpenAI-compatible Service and forwards the model after removing only `codex/`

#### Scenario: Codex Proxy workload is rendered

- Given the dedicated Codex Proxy Pantheon stack is selected
- When its workload image is inspected
- Then it uses `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76`
- And it does not use `latest` or an upstream image directly

### Requirement: Standalone Local Model Aliases

Agent Gateway MUST route `gemma-4-e2b`, `qwen3.6-35b-a3b`, and `gpt-oss-120b` independently to their declared llama.cpp Services. It MUST route `Qwen/Qwen3-Embedding-4B` independently to the vLLM embedding Service. It MUST NOT advertise the retired self-hosted model `zai-org/GLM-4.7-Flash`; this exclusion does not apply to the external Chutes model `chutes/zai-org/GLM-5-TEE`.

#### Scenario: One local backend changes

- Given several local model aliases are configured
- When one backend is added or modified
- Then the other aliases and backend targets remain independent

#### Scenario: Retired self-hosted GLM is excluded

- Given Agent Gateway's client-facing model inventory is rendered
- When local and external model aliases are inspected
- Then `zai-org/GLM-4.7-Flash` is absent as a self-hosted model
- And `chutes/zai-org/GLM-5-TEE` may remain available through the external Chutes provider

## References

- [`programs/agent-gateway/index.ts`](../../../programs/agent-gateway/index.ts)
- [`programs/agent-gateway/Pulumi.pantheon.yaml`](../../../programs/agent-gateway/Pulumi.pantheon.yaml)
- [`src/components/agent-gateway.ts`](../../../src/components/agent-gateway.ts)
- [`programs/codex-proxy/Pulumi.pantheon.yaml`](../../../programs/codex-proxy/Pulumi.pantheon.yaml)
- [`src/components/codex-proxy.ts`](../../../src/components/codex-proxy.ts)

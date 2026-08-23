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

Client-facing LLM routing MUST use Agent Gateway and MUST NOT require a LiteLLM Deployment or Service. Agent Gateway MUST represent OpenAI, Anthropic, Chutes, Cerebras, Codex Proxy, and standalone vLLM backends. No compatibility route for `litellm.holdenitdown.net` is required.

#### Scenario: A client sends a model request

- Given the requested model has a configured Agent Gateway provider
- When the request reaches the model endpoint
- Then Agent Gateway selects that provider without a LiteLLM runtime dependency

#### Scenario: Provider coverage is rendered

- Given the Agent Gateway stack is selected
- When its backend configuration is inspected
- Then it represents OpenAI, Anthropic, Chutes, Cerebras, Codex Proxy, and standalone vLLM backends

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

### Requirement: Workload-Owned Audio Routes

The `rfhold/whisperx-server` repository MUST own the ordinary HTTPRoute for exact `/v1/audio/transcriptions`. The `rfhold/kokoro-server` repository MUST own the ordinary HTTPRoute for exact `/v1/audio/speech`. Each route MUST target its workload Service so Service EndpointSlices form the future-balanced backend pool. The workload repositories MUST preserve `whisperx.holdenitdown.net` and `kokoro.holdenitdown.net` as direct hostnames. Homelab MUST NOT render either audio HTTPRoute. Both endpoints MUST remain public and MUST NOT require a gateway client credential.

Agent Gateway v1.4.1 has no typed audio route. Its Gateway-level body-derived model policy MUST exclude both exact audio paths before model extraction. The exclusion MUST use exact path comparisons and MUST NOT bypass model extraction for child paths.

#### Scenario: A client submits audio

- Given an unauthenticated client requests an exact audio path on `agent-gateway.holdenitdown.net`
- When Gateway API evaluates the workload-owned HTTPRoute
- Then the route targets the workload Service rather than an Agent Gateway model backend
- And the Gateway-level policy does not derive a model from the request body
- And the Service EndpointSlices provide the backend pool

#### Scenario: A client uses a direct audio hostname

- Given a client uses `whisperx.holdenitdown.net` or `kokoro.holdenitdown.net`
- When the matching workload-owned HTTPRoute handles the request
- Then the route preserves public unauthenticated access to the corresponding Service

### Requirement: Standalone Backend Ownership

Active local model routing MUST target standalone vLLM Services and MUST NOT depend on the legacy `ai-inference` namespace, its model Services, or a rollback-only llama.cpp Service.

#### Scenario: Local backends are rendered

- Given Agent Gateway configuration declares a self-hosted model
- When its provider target is inspected
- Then it resolves to the corresponding standalone `vllm` Service

### Requirement: Legacy ai-inference Retirement

The legacy `ai-inference` Pulumi stack MUST remain retired from active Pantheon model serving. Active client-facing model routing MUST NOT depend on its namespace or model Services, and retirement MUST NOT remove the standalone vLLM Qwen3 embedding stack.

#### Scenario: Active model serving is reconciled

- Given model serving is owned by standalone inference stacks and Agent Gateway
- When Pantheon model-serving dependencies are inspected
- Then no active route requires the legacy `ai-inference` stack, namespace, or model Services
- And the standalone `Qwen/Qwen3-Embedding-0.6B` vLLM backend remains independently owned

### Requirement: Provider Model Transformation

Providers configured with a client prefix MUST remove only that prefix before forwarding upstream. Providers configured with exact model aliases MUST map the client model to the declared upstream value. Local provider policies MUST NOT duplicate model sampling defaults.

#### Scenario: A prefixed external model is requested

- Given a client model starts with `openai/`, `anthropic/`, or `codex/`
- When Agent Gateway forwards the request
- Then it removes the matching configured prefix and preserves the remainder

#### Scenario: The embedding model is requested

- Given a client requests `local-embedding`
- When Agent Gateway selects the local embedding backend
- Then it targets `qwen3-embedding.vllm.svc.cluster.local:8000` and forwards `Qwen/Qwen3-Embedding-0.6B`

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

### Requirement: Stable Local Model Aliases

Agent Gateway's local model inventory MUST expose only `local-embedding` and `local-small`. It MUST map `local-embedding` to `Qwen/Qwen3-Embedding-0.6B` at `qwen3-embedding.vllm.svc.cluster.local:8000` and `local-small` to `Qwen/Qwen3.8-27B-FP8` at `qwen3-8-27b.vllm.svc.cluster.local:8000`. The old model-specific embedding, Gemma, Qwen3.6, and GPT-OSS aliases and providers MUST be absent. The rollback-only Qwen3.6 llama.cpp Service MUST NOT be advertised. Agent Gateway MUST NOT advertise the retired self-hosted model `zai-org/GLM-4.7-Flash`; this exclusion does not apply to the external Chutes model `chutes/zai-org/GLM-5-TEE`.

#### Scenario: Stable local aliases are rendered

- Given Agent Gateway local providers are configured
- When the client-facing local model aliases are inspected
- Then only `local-embedding` and `local-small` are present
- And each maps directly to its static standalone vLLM Service FQDN and exact upstream model name

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

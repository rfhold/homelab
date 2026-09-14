# Model Gateway

## Purpose

This specification governs client-facing model routing, provider transformations, and the internal backends owned by Agent Gateway, Claude Proxy, and Codex Proxy. Edge hostname and certificate behavior is defined by the [edge route specification](../../edge-networking/spec/routes.md).

## Requirements

### Requirement: Dedicated Agent Gateway Program

The dedicated Pantheon Pulumi program MUST own Agent Gateway. The ingress and LiteLLM programs MUST NOT own the model gateway. The program MUST unconditionally create standalone Agent Gateway v1.5.0.

The program MUST NOT create the Agent Gateway Kubernetes controller, its CRDs, an Agent Gateway GatewayClass or Gateway, `agentgateway.dev` Backends, or attached policies. When the selected route-storage state includes database routes, the program MUST use the repository's Pulumi dynamic resource provider to manage them. Normalized token accounting MUST retain v1.5 semantics, including prompt-cache tokens.

#### Scenario: The model gateway is rendered

- Given the Agent Gateway stack is selected
- When Pulumi constructs the gateway resources
- Then the program creates standalone Agent Gateway v1.5.0
- And it creates no Agent Gateway Kubernetes control-plane resources

### Requirement: Standalone Resource Graph

Standalone Agent Gateway MUST use ClusterIP Service `agentgateway-system/agent-gateway` on HTTP port `4000`. HTTPRoute `agentgateway-system/agent-gateway` MUST attach to `ingress/default-gateway`, target Service `agent-gateway:4000`, and serve `agent-gateway.holdenitdown.net`. The internal standalone listener MUST accept the Host value forwarded by that route.

The program MUST create a one-instance CloudNativePG database with `10Gi` storage for analytics and persistent standalone resources. The `agent-gateway-postgres` Pulumi resource MUST use `protect: true`. Removing, replacing, or unprotecting it MUST require a separate database backup and recovery boundary plus exact authorization for the destructive action. It MUST create two Agent Gateway replicas and a PodDisruptionBudget with `maxUnavailable: 1`. The pod termination grace period MUST remain `660s`, the fronting HTTPRoute request timeout, internal LLM route timeout, and connection termination deadline MUST remain `600s`, and readiness MUST remain available on port `15021`.

The desired graph MUST exclude all superseded Agent Gateway Kubernetes control-plane resources. External audio mutations and every Agent Gateway preview, destructive action, and live apply MUST require separate exact authorization.

#### Scenario: Standalone owns production routing

- Given the standalone-only source is selected
- When Pulumi constructs the model gateway
- Then `agent-gateway.holdenitdown.net` routes through `ingress/default-gateway`
- And the route targets the standalone ClusterIP Service on HTTP port `4000`
- And no Agent Gateway Kubernetes control-plane graph is present

### Requirement: Stable Resource Identity

The Pulumi component logical name MUST be `agent-gateway`, and its component token MUST be `homelab:components:AgentGateway`. Its Secret MUST be `agent-gateway-env`; chart logical child MUST be `agent-gateway-chart`; and Helm release and fullname MUST be `agent-gateway`. The upstream chart key, URL, or mode MAY retain `standalone` where required by the upstream artifact.

The Kubernetes ServiceAccount, Service, Deployment, PodDisruptionBudget, and HTTPRoute MUST all be named `agent-gateway` in `agentgateway-system`. The ConfigMap MUST be `agent-gateway-config`. Metrics instance MUST be `agent-gateway`. Workload identity labels and selectors MUST use name and instance `agent-gateway` and component `llm-gateway`.

#### Scenario: Agent Gateway resources are identified

- Given the standalone Agent Gateway chart and explicit resources are rendered
- When Pulumi and Kubernetes identities are inspected
- Then every resource uses the stable identities above
- And the production HTTPRoute targets Service `agent-gateway:4000`

### Requirement: Agent Gateway Replaces LiteLLM Routing

Client-facing LLM routing MUST use Agent Gateway and MUST NOT require a LiteLLM Deployment or Service. Agent Gateway MUST preserve all ten provider contracts. No compatibility route for `litellm.holdenitdown.net` is required.

| Provider name | Upstream contract | Client model contract | Legacy `traffic.route` API routes |
| --- | --- | --- | --- |
| `openai` | Native OpenAI with its provider credential | Remove only `openai/` | Responses, chat completions, models, and passthrough |
| `anthropic` | Native Anthropic with its provider credential | Remove only `anthropic/` | Messages, models, and passthrough |
| `claude` | Native Anthropic at `claude-proxy.claude-proxy.svc.cluster.local:8080`, without an upstream credential | Remove only `claude/` | Messages, models, and passthrough |
| `chutes` | OpenAI-compatible TLS endpoint `llm.chutes.ai:443` with its provider credential | Preserve the exact aliases listed below | Chat completions, models, and passthrough |
| `codex` | OpenAI-compatible endpoint `codex-proxy.codex-proxy.svc.cluster.local:8080`, without an upstream credential | Remove only `codex/` | Responses, chat completions, models, and passthrough |
| `cerebras` | OpenAI-compatible TLS endpoint `api.cerebras.ai:443` with its provider credential | Map `cerebras/zai-org/zai-glm-4.7` to `zai-glm-4.7` | Chat completions, models, and passthrough |
| `bifrost` | OpenAI-compatible TLS endpoint `gateway.skysquid.net:443` | Remove only `bifrost/` | `/openai/v1/chat/completions` and passthrough |
| `vllm-local-embedding` | OpenAI-compatible endpoint `qwen3-embedding.vllm.svc.cluster.local:8000` | Map `local-embedding` to `Qwen/Qwen3-Embedding-0.6B` | Embeddings, models, and passthrough |
| `llama-cpp-local-small` | OpenAI-compatible endpoint `qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local:8000` | Map `local-small` to `qwen3.8-27b` | Chat completions, models, and passthrough |
| `llama-cpp-vulkan` | OpenAI-compatible endpoint `vulkan.holdenitdown.net:8000` | Map `local-fast` to `qwen3.6-35b-a3b` | Chat completions, models, and passthrough |

The Chutes provider MUST preserve these exact client-to-upstream aliases:

| Client alias | Upstream model |
| --- | --- |
| `chutes/moonshotai/Kimi-K2-Instruct-0905` | `moonshotai/Kimi-K2-Instruct-0905` |
| `chutes/moonshotai/Kimi-K2-Thinking-TEE` | `moonshotai/Kimi-K2-Thinking-TEE` |
| `chutes/moonshotai/Kimi-K2.5-TEE` | `moonshotai/Kimi-K2.5-TEE` |
| `chutes/Qwen/Qwen3-235B-A22B-Instruct-2507-TEE` | `Qwen/Qwen3-235B-A22B-Instruct-2507-TEE` |
| `chutes/Qwen/Qwen3-Coder-Next-TEE` | `Qwen/Qwen3-Coder-Next-TEE` |
| `chutes/zai-org/GLM-5-TEE` | `zai-org/GLM-5-TEE` |
| `chutes/Qwen/Qwen3.5-397B-A17B-TEE` | `Qwen/Qwen3.5-397B-A17B-TEE` |

Chutes backend TLS MUST use SNI `llm.chutes.ai`, Cerebras backend TLS MUST use SNI `api.cerebras.ai`, and Bifrost backend TLS MUST use SNI `gateway.skysquid.net`.

The legacy route column defines behavior while a provider is represented by `traffic.route`. First-class providers and models MUST use Agent Gateway v1.5's fixed LLM route table rather than reproducing these per-provider route allowlists. Bifrost MUST remain the sole legacy route in `first-class` mode so inbound `/openai/v1/chat/completions` and `bifrost/` model-prefix stripping remain available.

#### Scenario: A client sends a model request

- Given the requested model has a configured Agent Gateway provider
- When the request reaches the model endpoint
- Then Agent Gateway selects that provider without a LiteLLM runtime dependency

#### Scenario: Provider coverage is rendered

- Given the Agent Gateway stack is selected
- When its backend configuration is inspected
- Then it represents the ten named provider contracts without alias or prefix changes

### Requirement: Provider Credential Stashes

The program MUST preserve exactly four provider Stashes with token `pulumi:index:Stash`: `openai-api-key`, `anthropic-api-key`, `chutes-api-key`, and `cerebras-api-key`. Their values MUST feed only the corresponding provider Secret references.

`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CHUTES_API_KEY`, and `CEREBRAS_API_KEY` MUST seed newly created Stashes. When an environment variable is absent, the program MUST pass a secret empty-string input so an existing Stash can retain its output. Before the program uses a resolved Stash output as a provider Secret value, it MUST require a non-empty, non-blank value. A non-empty retained output MUST remain valid when the environment variable is absent. An empty or blank resolved output MUST fail with a non-secret error that names only the corresponding environment variable and exposes no credential value. Operators MUST supply all four variables when creating fresh Stashes. Credential values MUST NOT appear in documentation, outputs, previews, or operational evidence.

#### Scenario: Retained Stashes are reused

- Given the four existing provider Stashes were excluded from the hard destroy
- And each retained Stash output is non-empty
- When the standalone program is constructed without provider credential environment variables
- Then each exact Stash identity is retained and supplies only its corresponding provider authentication reference
- And no credential value is exposed as a non-secret output

#### Scenario: A resolved Stash output is empty

- Given a provider Stash resolves to an empty or blank value
- When the program prepares the corresponding provider Secret value
- Then construction fails before that value is used
- And the non-secret error names only the corresponding environment variable
- And the error exposes no credential value

### Requirement: First-Class Routing Representation

`routingRepresentationMode` MUST be orthogonal to `routeStorageMode` and accept exactly these four values:

| Mode | Legacy `traffic.route` resources | `llm.provider` resources | `llm.model` resources |
| --- | --- | --- | --- |
| `routes` | Ten final routes | None | None |
| `prepare-first-class` | Ten final routes | Nine | Fifteen |
| `first-class` | Bifrost only | Nine | Fifteen |
| `prepare-routes` | Ten final routes | Nine | Fifteen |

Every representation other than `routes` MUST require `routeStorageMode: database`. The safe forward sequence MUST be `routes -> prepare-first-class -> first-class`. The safe reverse sequence MUST be `first-class -> prepare-routes -> routes`. Operators MUST NOT skip representation transition states.

The nine `llm.provider` IDs MUST be `openai`, `anthropic`, `claude`, `chutes`, `codex`, `cerebras`, `vllm-local-embedding`, `llama-cpp-local-small`, and `llama-cpp-vulkan`; Bifrost MUST NOT have a first-class provider. Host-derived `baseUrl` values MUST contain only scheme, host, and port so the fixed LLM route table preserves each inbound path. The four credentialed providers MUST use literal `$OPENAI_API_KEY`, `$ANTHROPIC_API_KEY`, `$CHUTES_API_KEY`, and `$CEREBRAS_API_KEY` placeholders. Chutes and Cerebras MUST retain their explicit TLS SNI hostnames. Wildcard provider defaults MUST remove only the corresponding configured model prefix.

The fifteen `llm.model` IDs MUST be the wildcard families `openai/*`, `anthropic/*`, `claude/*`, and `codex/*`; the seven exact Chutes aliases listed above; `cerebras/zai-org/zai-glm-4.7`; and `local-embedding`, `local-small`, and `local-fast`. Every model's `id` and `name` MUST equal its resource ID and reference one of the nine first-class provider IDs. Exact aliases MUST set `params.model` to the declared upstream model; wildcard models MUST rely on their provider's prefix-removal default.

In every non-`routes` representation, the file bootstrap MUST attach first-class LLM routing to gateway `default` with `llm.gateways: [default]`, retain an empty file-owned `llm.models` list, and own a `600s` timeout policy targeting internal route `internal/llm:request`. Body-model extraction into `x-model` MUST remain because legacy routes coexist during preparation and Bifrost remains legacy after activation.

Agent Gateway's first-class `/v1/models` behavior MUST return the configured client-facing model inventory through the private hostname, including wildcard entries, and MUST NOT forward that request to upstream providers. First-class models MUST accept Agent Gateway v1.5's fixed LLM route surface rather than the legacy per-provider route allowlists. In the UI, Bifrost MUST be the only entry represented as a Legacy Backend when `first-class` is selected.

Pulumi MUST own the selected representation's declared `traffic.route`, `llm.provider`, and `llm.model` IDs. Undeclared IDs and kinds MUST remain UI-owned. The resource sets MUST reconcile in dependency order after the chart and HTTPRoute: providers before models, and models before legacy routes. Configuration API responses MUST contain the requested kind, and resource kinds and IDs, including wildcard and slash model IDs, MUST be encoded as strict URL path segments.

#### Scenario: First-class routing is prepared

- Given route storage is `database` and representation is `routes`
- When separately authorized updates select `prepare-first-class`
- Then all ten legacy routes remain available
- And nine providers and fifteen models are created before any legacy route is removed

#### Scenario: First-class routing is activated

- Given `prepare-first-class` is active
- When a separately authorized update selects `first-class`
- Then the nine providers and fifteen models remain
- And Bifrost becomes the sole legacy route
- And `/v1/models` returns the configured local inventory instead of forwarding upstream

#### Scenario: Legacy routes are restored

- Given `first-class` is active
- When separately authorized updates advance through `prepare-routes` and then `routes`
- Then all ten legacy routes coexist with first-class resources before those first-class resources are removed

### Requirement: Standalone UI And Configuration

The normal standalone UI MUST use the production hostname through `ingress/default-gateway` and target port `4000`.

The standalone debug admin listener MUST remain loopback-only. No HTTPRoute or Service MUST expose it. Public `/config_dump` MUST remain absent.

Agent Gateway MUST support a reversible hybrid configuration transition. Pulumi MUST own the file-backed startup configuration containing the process addresses, PostgreSQL connection placeholder when the selected state uses the database, tracing, one `default` listener on port `4000`, body-model extraction and its exclusions, and UI attachment. These listener, UI, process, database-connection, and tracing settings MUST NOT be transferred to UI ownership.

`routeStorageMode` MUST accept exactly these four values. It controls storage for the legacy route set selected by `routingRepresentationMode`:

| Mode | Helm mode | File routes | PostgreSQL `traffic.route` resources |
| --- | --- | --- | --- |
| `file` | `readonly` | Ten final routes | None |
| `prepare-database` | `database` | Ten final routes | Ten semantically equivalent temporary routes named `pulumi-migration-<final-id>` |
| `database` | `database` | None | The selected final legacy routes: ten in `routes`, `prepare-first-class`, or `prepare-routes`; Bifrost only in `first-class` |
| `prepare-file` | `database` | None | Ten temporary routes named `pulumi-migration-<final-id>` |

The safe forward sequence MUST be `file -> prepare-database -> database`. The safe reverse sequence MUST be `database -> prepare-file -> prepare-database -> file`. These route-storage transitions MUST use `routingRepresentationMode: routes` whenever they pass through a non-`database` storage state. Operators MUST NOT skip transition states. For an in-place resource-set update, the dynamic provider MUST upsert the complete desired set and validate that the response contains every expected ID with a canonically equal value before deleting removed Pulumi-owned IDs. A missing ID, mismatched returned value, or failed upsert MUST prevent deletion of the old owned IDs.

When the selected representation declares all ten legacy routes, their final IDs MUST be `openai`, `anthropic`, `claude`, `chutes`, `codex`, `cerebras`, `bifrost`, `vllm-local-embedding`, `llama-cpp-local-small`, and `llama-cpp-vulkan`. Temporary storage-transition IDs MUST add the `pulumi-migration-` prefix to those exact final IDs, and their route values MUST be semantically equivalent except for the temporary route name. All route values MUST preserve the provider contracts in this specification. Provider credentials MUST remain only in Kubernetes Secret-backed environment variables; persisted route values MUST contain `$ENV_VAR` references rather than credential values.

Pulumi MUST own the exact final or temporary route IDs declared by the selected state. The UI MUST own every resource ID and kind not declared by Pulumi, including future keys, budgets, models, policies, and experimental resources. Pulumi collection operations MUST preserve unrelated UI-owned records.

During creation, the provider MUST safely adopt a pre-existing declared ID only when its value canonically equals the desired value, including recovery after an uncertain prior response; it MUST reject a differing value without overwriting it. Before an update acquires an ID not present in the prior Pulumi-owned set, the provider MUST list the target collection: an absent ID proceeds, a canonically identical value is adopted, and a differing value MUST fail before any PUT or DELETE. IDs already present in the prior Pulumi-owned set remain Pulumi-authoritative and MAY be reconciled to their desired values without that acquisition preflight. Removing an ID from the Pulumi set or deleting the resource set MUST delete only IDs previously owned by that set. A UI edit to a Pulumi-owned route ID is drift and MAY be reconciled by a Pulumi refresh followed by an authorized update; UI-owned IDs and kinds MUST remain untouched.

Changing the resource-set endpoint or kind MUST use delete-before-replace. Such a replacement intentionally deletes the old owned objects and MUST NOT be represented as a seamless endpoint or kind migration. It requires an explicit preview and the applicable authorization for the resulting mutations. Configuration API requests MUST have a 10-second timeout for each attempt covering response receipt and consumption or parsing of the complete response body; timeout failures use bounded retries.

Raw `/api/config` MUST remain the read-only, file-backed configuration view. Persistent UI changes MUST use the `/api/config/resources/*` resource editors; the hybrid model MUST NOT imply that whole-file saves become writable. The normal UI and configuration API MUST be reachable only through the private Agent Gateway hostname, while debug administration remains loopback-only. This change MUST NOT add a cost catalog, virtual keys, budgets, Alloy changes, or client authentication.

#### Scenario: An operator opens the standalone UI

- Given standalone Agent Gateway serves the production hostname
- When the operator requests the normal UI through that hostname
- Then `ingress/default-gateway` forwards the request to standalone port `4000`
- And no route exposes the debug admin listener or `/config_dump`

#### Scenario: An operator persists a UI-owned resource

- Given the operator reaches the resource editor through the private Agent Gateway hostname
- And the resource ID and kind are not declared by Pulumi
- When the operator saves the resource through `/api/config/resources/*`
- Then Agent Gateway persists it in PostgreSQL
- And a later Pulumi collection upsert preserves it
- And raw `/api/config` remains read-only

#### Scenario: A Pulumi-owned route is edited through the UI

- Given the edited resource is a `traffic.route`, `llm.provider`, or `llm.model` ID owned in the selected state
- When Pulumi refreshes and performs a separately authorized update
- Then the declared route value may replace the UI edit as drift
- And unrelated UI-owned resources remain unchanged

#### Scenario: Route storage moves to PostgreSQL

- Given `file` mode is the active declared state
- When separately authorized updates advance through `prepare-database` and then `database`
- Then final file routes remain present while equivalent temporary database routes are prepared
- And the final update replaces both representations with the ten final database routes

#### Scenario: Route storage returns to the file

- Given `database` mode is the active declared state
- When separately authorized updates advance through `prepare-file`, `prepare-database`, and then `file`
- Then temporary database routes bridge the transition before final file routes return
- And the final update removes the database route set only after the file representation is selected

### Requirement: Telemetry Preservation

The standalone target MUST preserve Prometheus metrics on port `15020` and OTLP gRPC tracing to `telemetry.holdenitdown.net:4317`. The hard cutover MUST NOT require an Alloy change.

#### Scenario: Standalone telemetry is rendered

- Given the stack creates standalone Agent Gateway
- When Pulumi constructs standalone telemetry configuration
- Then metrics remain available on port `15020`
- And traces use the configured OTLP destination

### Requirement: Stable Stack Outputs

The `routeUrl`, `uiRouteUrl`, and `backendNames` outputs MUST preserve their meanings. `routeUrl` MUST identify the production model URL. `uiRouteUrl` MUST identify the production UI at `/ui/`. `backendNames` MUST retain the ten provider identities.

The `gateway` output MUST identify `default-gateway`. The `gatewayNamespace` output MUST identify `ingress`.

#### Scenario: A stack consumer reads standalone outputs

- Given the stack creates standalone Agent Gateway
- When a consumer reads Agent Gateway outputs
- Then the route and UI outputs retain their established meanings
- And the gateway outputs identify name `default-gateway` and namespace `ingress`

### Requirement: Workload-Owned Audio Routes

The `rfhold/whisperx-server` repository MUST own the ordinary HTTPRoute for exact `/v1/audio/transcriptions`. The `rfhold/kokoro-server` repository MUST own the ordinary HTTPRoute for exact `/v1/audio/speech`. Each route MUST target its workload Service so Service EndpointSlices form the future-balanced backend pool. The workload repositories MUST preserve `whisperx.holdenitdown.net` and `kokoro.holdenitdown.net` as direct hostnames. Homelab MUST NOT render either audio HTTPRoute. Both endpoints MUST remain available through the private network and MUST NOT require a gateway client credential.

Before the Agent Gateway destroy, separately authorized work in each workload repository MUST reparent its exact shared-host route to `ingress/default-gateway`. Each route MUST report `Accepted=True` and `ResolvedRefs=True`. Direct probes MUST verify each Service backend and direct hostname before the destroy.

#### Scenario: A client submits audio

- Given an unauthenticated client requests an exact audio path on `agent-gateway.holdenitdown.net`
- When Gateway API evaluates the workload-owned HTTPRoute
- Then the route targets the workload Service rather than an Agent Gateway model backend
- And the exact audio route bypasses Agent Gateway model extraction
- And the Service EndpointSlices provide the backend pool

#### Scenario: A client uses a direct audio hostname

- Given a client uses `whisperx.holdenitdown.net` or `kokoro.holdenitdown.net`
- When the matching workload-owned HTTPRoute handles the request
- Then the route preserves unauthenticated private-network access to the corresponding Service

### Requirement: Standalone Backend Ownership

Active local model routing MUST target the corresponding standalone vLLM or llama.cpp Service, except `local-fast`, which MUST target the inventory-driven Vulkan llama.cpp host at `vulkan.holdenitdown.net:8000`. Active local model routing MUST NOT depend on the legacy `ai-inference` namespace, its model Services, or a rollback-only model Service.

#### Scenario: Local backends are rendered

- Given Agent Gateway configuration declares a self-hosted model
- When its provider target is inspected
- Then it resolves to the corresponding standalone vLLM or llama.cpp Service, or `local-fast` resolves to the Vulkan host

### Requirement: Legacy ai-inference Retirement

The legacy `ai-inference` Pulumi stack MUST remain retired from active Pantheon model serving. Active client-facing model routing MUST NOT depend on its namespace or model Services, and retirement MUST NOT remove the standalone vLLM Qwen3 embedding stack.

#### Scenario: Active model serving is reconciled

- Given model serving is owned by standalone inference stacks and Agent Gateway
- When Pantheon model-serving dependencies are inspected
- Then no active route requires the legacy `ai-inference` stack, namespace, or model Services
- And the standalone `Qwen/Qwen3-Embedding-0.6B` vLLM backend remains independently owned

### Requirement: Provider Model Transformation

Providers configured with a client prefix MUST remove only that prefix before forwarding upstream. Providers configured with exact model aliases MUST map the client model to the declared upstream value. Local provider policies MUST NOT duplicate model sampling defaults.

Standalone body-model extraction MUST continue to set `x-model` from the request body's `model` field. Exact `/v1/audio/transcriptions` and `/v1/audio/speech` requests MUST remain excluded from that extraction.

#### Scenario: A prefixed external model is requested

- Given a client model starts with `openai/`, `anthropic/`, `claude/`, or `codex/`
- When Agent Gateway forwards the request
- Then it removes the matching configured prefix and preserves the remainder

#### Scenario: The embedding model is requested

- Given a client requests `local-embedding`
- When Agent Gateway selects the local embedding backend
- Then it targets `qwen3-embedding.vllm.svc.cluster.local:8000` and forwards `Qwen/Qwen3-Embedding-0.6B`

### Requirement: Codex Proxy Boundary

The `rfhold/codex-proxy` repository MUST own the Codex Proxy namespace and workload resources. Its service-owned Tekton PipelineRun MUST build the image and invoke that repository's Pulumi program with an immutable image digest. The workload MUST persist data at `/app/data` and provide an internal ClusterIP Service. Request-body logging, automatic updates, and proxy IP health checks MUST be disabled or omitted by default. Agent Gateway MUST NOT send an authorization credential to the proxy unless a later contract explicitly requires one.

#### Scenario: Codex-backed model routing is rendered

- Given a client requests a `codex/` model
- When Agent Gateway selects Codex Proxy
- Then it targets `codex-proxy.codex-proxy.svc.cluster.local:8080` and forwards the model after removing only `codex/`

#### Scenario: Codex Proxy workload is reconciled

- Given the service-owned Tekton PipelineRun resolves a multi-platform image digest
- When the service repository invokes its Pulumi program
- Then that program owns the Codex Proxy namespace and workload resources
- And the workload uses the immutable image digest

### Requirement: Claude Proxy Boundary

The `rfhold/claude-proxy` repository MUST own the Claude Proxy namespace, workload, PVC, Service, CI, and Pulumi program. Agent Gateway MUST target `claude-proxy.claude-proxy.svc.cluster.local:8080` with its native Anthropic provider and MUST remove only the `claude/` model prefix before forwarding. Agent Gateway MUST NOT send an authorization credential to Claude Proxy unless a later contract explicitly requires one. The direct Anthropic provider and its `anthropic/` prefix MUST remain separate and unchanged.

#### Scenario: Claude-backed model routing is rendered

- Given a client requests a `claude/` model
- When Agent Gateway selects Claude Proxy
- Then it targets `claude-proxy.claude-proxy.svc.cluster.local:8080` through the native Anthropic provider
- And it forwards the model after removing only `claude/`
- And it sends no upstream authorization credential

#### Scenario: Claude Proxy ownership is inspected

- Given the Claude Proxy implementation boundary is inspected
- When repository ownership is identified
- Then `rfhold/claude-proxy` owns the namespace, workload, PVC, Service, CI, and Pulumi program
- And Homelab owns only the Agent Gateway routing representations that target that internal Service

### Requirement: Stable Local Model Aliases

Agent Gateway's local model inventory MUST expose only `local-embedding`, `local-small`, and `local-fast`. It MUST map `local-embedding` to `Qwen/Qwen3-Embedding-0.6B` at `qwen3-embedding.vllm.svc.cluster.local:8000`, `local-small` to `qwen3.8-27b` at `qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local:8000`, and `local-fast` to `qwen3.6-35b-a3b` at `vulkan.holdenitdown.net:8000`. The `local-fast` provider MUST be named `llama-cpp-vulkan` and use the OpenAI provider type with plaintext host and port configuration. Its legacy route representation MUST provide chat completions, models, and passthrough; its first-class representation MUST use Agent Gateway's fixed LLM route surface. Agent Gateway does not source-check this static provider's reachability or protocol compatibility and does not health-aware-withdraw it when unavailable. The old model-specific embedding, Gemma, and GPT-OSS aliases and providers MUST be absent. The rollback-only Qwen3.6 llama.cpp Service and Qwen3.8 FP8 vLLM Service MUST NOT be advertised. Agent Gateway MUST NOT advertise the retired self-hosted model `zai-org/GLM-4.7-Flash`; this exclusion does not apply to the external Chutes model `chutes/zai-org/GLM-5-TEE`.

#### Scenario: Stable local aliases are rendered

- Given Agent Gateway local providers are configured
- When the client-facing local model aliases are inspected
- Then only `local-embedding`, `local-small`, and `local-fast` are present
- And each maps directly to its configured static target and exact upstream model name
- And `local-fast` maps to `qwen3.6-35b-a3b` at `vulkan.holdenitdown.net:8000` through provider `llama-cpp-vulkan`
- And the static Vulkan provider has no configured reachability check, protocol compatibility check, or health-aware withdrawal

#### Scenario: Retired self-hosted GLM is excluded

- Given Agent Gateway's client-facing model inventory is rendered
- When local and external model aliases are inspected
- Then `zai-org/GLM-4.7-Flash` is absent as a self-hosted model
- And `chutes/zai-org/GLM-5-TEE` may remain available through the external Chutes provider

## References

- [`programs/agent-gateway/index.ts`](../../../programs/agent-gateway/index.ts)
- [`programs/agent-gateway/Pulumi.pantheon.yaml`](../../../programs/agent-gateway/Pulumi.pantheon.yaml)
- [`src/components/agent-gateway.ts`](../../../src/components/agent-gateway.ts)
- [`src/components/agent-gateway.test.ts`](../../../src/components/agent-gateway.test.ts)
- [`src/providers/agent-gateway/config-resource-set.ts`](../../../src/providers/agent-gateway/config-resource-set.ts)
- [`src/providers/agent-gateway/config-resource-set.test.ts`](../../../src/providers/agent-gateway/config-resource-set.test.ts)
- [`src/providers/agent-gateway/client.ts`](../../../src/providers/agent-gateway/client.ts)
- [`src/providers/agent-gateway/client.test.ts`](../../../src/providers/agent-gateway/client.test.ts)

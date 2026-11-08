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

Client-facing LLM routing MUST use Agent Gateway and MUST NOT require a LiteLLM Deployment or Service. Agent Gateway MUST preserve the ten prior provider identities. It MUST add `vllm-vulkan-embedding` and `llama-cpp-vulkan-small`. No compatibility route for `litellm.holdenitdown.net` is required.

| Provider name | Upstream contract | Client model contract | Legacy `traffic.route` API routes |
| --- | --- | --- | --- |
| `openai` | Native OpenAI with its provider credential | Remove only `openai/` | Responses, chat completions, models, and passthrough |
| `anthropic` | Native Anthropic with its provider credential | Remove only `anthropic/` | Messages, models, and passthrough |
| `claude` | Native Anthropic at `claude-proxy.claude-proxy.svc.cluster.local:8080`, without an upstream credential | Remove only `claude/` | Messages, models, and passthrough |
| `chutes` | OpenAI-compatible TLS endpoint `llm.chutes.ai:443` with its provider credential | Preserve the exact aliases listed below | Chat completions, models, and passthrough |
| `codex` | OpenAI-compatible endpoint `codex-proxy.codex-proxy.svc.cluster.local:8080`, without an upstream credential | Remove only `codex/`; preserve the exact Codex aliases below | Responses, chat completions, models, and passthrough |
| `cerebras` | OpenAI-compatible TLS endpoint `api.cerebras.ai:443` with its provider credential | Map `cerebras/zai-org/zai-glm-4.7` to `zai-glm-4.7` | Chat completions, models, and passthrough |
| `bifrost` | OpenAI-compatible TLS endpoint `gateway.skysquid.net:443` | Remove only `bifrost/` | `/openai/v1/chat/completions` and passthrough |
| `vllm-local-embedding` | OpenAI-compatible Athena endpoint `qwen3-embedding.vllm.svc.cluster.local:8000` | Internal target `local-embedding-athena` for virtual `local-embedding`, with upstream `Qwen/Qwen3-Embedding-0.6B` | Historical embeddings, models, and passthrough |
| `vllm-vulkan-embedding` | OpenAI-compatible endpoint `vulkan.holdenitdown.net:8001` | Internal target `local-embedding-vulkan` for virtual `local-embedding`, with upstream `Qwen/Qwen3-Embedding-0.6B` | Unsupported with virtual configuration |
| `llama-cpp-local-small` | OpenAI-compatible endpoint `qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local:8000` | Internal target `local-small-mars` for virtual `local-small`, upstream `qwen3.5-9b-hauhaucs-aggressive` | Historical chat completions, models, and passthrough |
| `llama-cpp-vulkan-small` | OpenAI-compatible endpoint `vulkan.holdenitdown.net:8002` | Internal target `local-small-vulkan` for virtual `local-small`, upstream `qwen3.5-9b-hauhaucs-aggressive` | Unsupported with virtual configuration |
| `llama-cpp-vulkan` | OpenAI-compatible endpoint `vulkan.holdenitdown.net:8000` | Map `local-medium` to `flint` | Chat completions, models, and passthrough |

The Codex provider MUST preserve these exact client-to-upstream aliases alongside `codex/*`:

| Client alias | Equivalent prefixed model | Upstream model |
| --- | --- | --- |
| `dreamer` | `codex/gpt-6-astra` | `gpt-6-astra` |
| `workhorse` | `codex/gpt-6.1-sol` | `gpt-6.1-sol` |
| `turbo` | `codex/gpt-6-luna` | `gpt-6-luna` |

These aliases MUST reference provider `codex` and MUST NOT include `codex/` in the upstream model value.

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
- Then it preserves the prior provider identities and public aliases
- And it adds the Vulkan embedding provider independently of Flint on port `8000`

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

`routingRepresentationMode` MUST be orthogonal to `routeStorageMode` and accept exactly these three values:

| Mode | Legacy `traffic.route` resources | `llm.provider` resources | `llm.model` resources | `llm.virtualModel` resources |
| --- | --- | --- | --- | --- |
| `routes` before virtual configuration | Ten final routes | None | None | None |
| `prepare-first-class` before virtual configuration | Ten final routes | Nine | Eighteen | None |
| Embedding-only `first-class`, phase 1 handoff | Bifrost only | Ten | Twenty | One |
| Embedding-only `first-class`, phase 2 after verified handoff | Bifrost only | Ten | Nineteen | One |
| Pantheon `first-class`, local-small phase 1 handoff | Bifrost only | Eleven | Twenty-one | Two |
| `first-class`, local-small phase 2 after verified handoff | Bifrost only | Eleven | Twenty | Two |

Virtual models and concrete model settings MUST require `first-class` representation. Pantheon's virtual configuration MUST fail construction in earlier migration modes. Earlier modes remain available only for configuration without virtual models and model settings; they MUST NOT silently render internal target names as public legacy aliases.

Every representation other than `routes` MUST require `routeStorageMode: database`. The supported forward sequence MUST be `routes -> prepare-first-class -> first-class`. Operators MUST NOT skip representation transition states. Reverse representation migration MUST remain unsupported. The parser MUST reject the removed `prepare-routes` mode.

After runtime keys exist, operators MUST NOT select legacy-only `routes` mode. Agent Gateway v1.5 requires `llm.policies.apiKey` to materialize persisted database keys. The static mode parser validates selected values, not transition history or database contents. It does not detect a direct backward selection of an otherwise valid initial mode. Pulumi MUST NOT delete runtime keys or add a hidden LLM stub to enable rollback.

The eleven `llm.provider` IDs MUST be `openai`, `anthropic`, `claude`, `chutes`, `codex`, `cerebras`, `vllm-local-embedding`, `vllm-vulkan-embedding`, `llama-cpp-local-small`, `llama-cpp-vulkan-small`, and `llama-cpp-vulkan`. Bifrost MUST NOT have a first-class provider. Host-derived `baseUrl` values MUST contain only scheme, host, and port so the fixed LLM route table preserves each inbound path. The four credentialed providers MUST use literal `$OPENAI_API_KEY`, `$ANTHROPIC_API_KEY`, `$CHUTES_API_KEY`, and `$CEREBRAS_API_KEY` placeholders. Chutes and Cerebras MUST retain their explicit TLS SNI hostnames. Wildcard provider defaults MUST remove only the corresponding configured model prefix.

The final twenty `llm.model` IDs MUST comprise:

- The wildcard families `openai/*`, `anthropic/*`, `claude/*`, and `codex/*`.
- The Codex aliases `dreamer`, `workhorse`, and `turbo`.
- The seven exact Chutes aliases listed above.
- `cerebras/zai-org/zai-glm-4.7`.
- Internal targets `local-embedding-athena`, `local-embedding-vulkan`, `local-small-mars`, and `local-small-vulkan`, plus public `local-medium`.

Every concrete model's `id` and `name` MUST equal its resource ID and reference a declared first-class provider ID. Exact aliases MUST set `params.model` to the declared upstream model; wildcard models MUST rely on their provider's prefix-removal default. The public alias `local-embedding` MUST use kind `llm.virtualModel`. During the phase 1 handoff, its unchanged prior concrete alias MUST coexist until the separately authorized phase 2 cleanup.

In every non-`routes` representation, the file bootstrap MUST attach first-class LLM routing to gateway `default` with `llm.gateways: [default]`, retain an empty file-owned `llm.models` list, and own a `600s` timeout policy targeting internal route `internal/llm:request`. Body-model extraction into `x-model` MUST remain because legacy routes coexist during preparation and Bifrost remains legacy after activation.

Agent Gateway's first-class `/v1/models` behavior MUST return the configured client-facing model inventory through the private hostname, including wildcard entries, and MUST NOT forward that request to upstream providers. First-class models MUST accept Agent Gateway v1.5's fixed LLM route surface rather than the legacy per-provider route allowlists. In the UI, Bifrost MUST be the only entry represented as a Legacy Backend when `first-class` is selected.

Pulumi MUST own the selected representation's declared `traffic.route`, `llm.provider`, `llm.model`, and `llm.virtualModel` IDs. Undeclared IDs and kinds MUST remain UI-owned. The resource sets MUST reconcile after the chart and HTTPRoute: providers before concrete models, concrete models before virtual models, and virtual models before legacy routes. Configuration API responses MUST contain the requested kind, and resource kinds and IDs, including wildcard and slash model IDs, MUST be encoded as strict URL path segments.

#### Scenario: First-class routing is prepared

- Given route storage is `database` and representation is `routes`
- And no virtual model configuration exists yet
- When separately authorized updates select `prepare-first-class`
- Then all ten legacy routes remain available
- And nine providers and eighteen models are created before any legacy route is removed

#### Scenario: First-class routing is activated

- Given `prepare-first-class` is active
- And no virtual model configuration exists yet
- When a separately authorized update selects `first-class`
- Then the nine providers and eighteen models remain
- And Bifrost becomes the sole legacy route
- And `/v1/models` returns the configured local inventory instead of forwarding upstream

### Requirement: Local Embedding Health And Latency Selection

The forward handoff MUST use two separately authorized phases. Phase 1 MUST retain the prior `llm.model/local-embedding` value unchanged through provider `vllm-local-embedding`. It MUST add the two internal targets before creation of `llm.virtualModel/local-embedding`. This state MUST declare twenty concrete models, one virtual model, ten first-class providers, and eleven `backendNames` entries.

The typed virtual-model migration option `retainConcreteAlias: true` MUST explicitly permit the same-name exact concrete alias during phase 1. Validation MUST reject that flag without a same-name concrete alias. It MUST reject accidental collisions, duplicate virtual names, and wildcard shadow conflicts even with the flag. The flag MUST NOT appear in the upstream virtual resource value. Pinned v1.5 resolves the virtual model before the concrete model during their coexistence.

Before phase 2, operators MUST independently verify virtual resource creation and both replicas' configuration reloads. A separately authorized source change MUST then remove only the retained concrete `local-embedding` alias and `retainConcreteAlias` flag. The virtual resource value MUST remain unchanged. Phase 2 MUST leave nineteen concrete models and preserve the public virtual alias. A failed phase 1 virtual-set update MUST NOT remove the prior concrete alias. Neither phase implies deployment authorization or verified live state.

These phase counts describe the embedding-only handoff before shared `local-small`. Pantheon's tracked configuration omits the retained concrete embedding alias and migration flag. Shared `local-small` adds one provider, one net concrete model, and one virtual model. Source selection does not prove cleanup deployment.

The public `local-embedding` virtual model MUST target `local-embedding-athena` and `local-embedding-vulkan` at equal failover priority `0`. Both concrete models MUST use `visibility: internal` and upstream model `Qwen/Qwen3-Embedding-0.6B`. Public `/v1/models` MUST exclude the concrete target names. Athena MUST retain provider `vllm-local-embedding`; Vulkan embeddings MUST use `vllm-vulkan-embedding` at port `8001`. Flint at Vulkan port `8000` MUST remain unchanged.

Agent Gateway v1.5 MUST select targets within this group by its composite health and latency score. Each concrete target MUST explicitly set `health.eviction.consecutiveFailures: 1` and `duration: 30s`. Default unhealthy classification MUST remain in effect. Health detection is passive, not an active probe; recovery does not prove protocol compatibility. Repeated eviction can extend the base eviction duration through upstream multiplicative backoff.

The timeout policy `internal/llm-request-timeout` MUST retain `requestTimeout: 600s` on `internal/llm:request`. A separate policy `internal/llm-request-retry` MUST attach the bounded retry to the same route. Each top-level policy entry MUST contain exactly one policy kind; timeout and retry MUST NOT share one entry. The retry precondition MUST match only `POST /v1/embeddings` with extracted `x-model: local-embedding`; absent headers MUST disable retries safely. Retry status codes MUST be `500`, `502`, `503`, and `504`, with `100ms` backoff. Other model requests MUST retain a single attempt. Retryable upstream connection, DNS, and upstream-call timeout errors MUST follow v1.5 error classification. Replay remains subject to upstream request-body buffering limits.

Pinned v1.5.0 runtime code adds one to the configured `retry.attempts`, despite its schema description of total attempts. This configuration MUST use `attempts: 1` for at most two runtime attempts. A version change MUST recheck this discrepancy before retention of that value.

This contract MUST NOT add global retries for other models, a separate route, per-attempt timeouts, or connection-timeout overrides. The shared `600s` budget can expire before a blackholed backend permits another attempt. Eviction and retry MUST NOT imply seamless recovery or guaranteed success when both targets fail.

#### Scenario: An embedding target fails quickly

- Given a replayable `POST /v1/embeddings` request uses `local-embedding`
- When the selected target returns a retryable failure within the shared request budget
- Then passive health can evict that target before the next provider selection
- And Agent Gateway permits at most one retry after `100ms`
- And other model requests receive no additional attempts

### Requirement: Shared Local-Small Health And Latency Selection

The public `local-small` alias MUST use `llm.virtualModel` with equal-priority `0` targets `local-small-mars` and `local-small-vulkan`. Both concrete targets MUST use upstream model `qwen3.5-9b-hauhaucs-aggressive` and `visibility: internal`. Public `/v1/models` MUST exclude both concrete target names.

The local-small handoff MUST use two separately authorized phases. Tracked phase 1 MUST preserve the prior concrete `local-small` alias unchanged through provider `llama-cpp-local-small`. Its upstream model MUST remain `qwen3.5-9b-hauhaucs-aggressive`. The virtual configuration MUST set `retainConcreteAlias: true` during coexistence. Virtual-first resolution selects the virtual alias; the flag MUST NOT enter the upstream resource value. Phase 1 MUST declare twenty-one concrete models, two virtual models, eleven first-class providers, and twelve `backendNames` entries. If virtual-set reconciliation fails, the prior concrete alias MUST remain available.

Before phase 2, operators MUST independently verify virtual resource creation and both replicas' configuration reloads. A separately authorized cleanup MUST remove only the retained concrete `local-small` alias and its migration flag. The virtual resource value MUST remain unchanged. Phase 2 MUST leave twenty concrete models, two virtual models, eleven first-class providers, and twelve `backendNames` entries. Neither phase MUST alter the selected phase 2 embedding configuration. Tracked source selects local-small phase 1; it does not prove deployment or authorize cleanup.

Mars MUST retain provider `llama-cpp-local-small` at `qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local:8000`. Vulkan MUST use provider `llama-cpp-vulkan-small` at plaintext endpoint `http://vulkan.holdenitdown.net:8002`. The optional Vulkan host serves the same Qwen3.5-9B model on its RX7900XTX. Flint at port `8000` and embeddings at port `8001` MUST remain unchanged.

Both targets MUST set `health.eviction.consecutiveFailures: 1` and base `duration: 30s`. Selection MUST use Agent Gateway v1.5 passive health and latency scores. This mechanism does not actively probe an absent Vulkan service. A request can fail before passive eviction affects later selections. Repeated failures can extend the base eviction duration.

The embedding-only retry precondition MUST remain unchanged. Chat and Responses requests MUST NOT gain automatic retries because replay risks duplicate generation and partial streams. This contract does not guarantee transparent first-failure fallback. Host deployment, protocol compatibility, recovery, and sustained behavior require separate verification.

#### Scenario: Vulkan Qwen is absent

- Given a client requests `local-small`
- When Agent Gateway selects the absent Vulkan target
- Then that request can fail without an automatic retry
- And passive health can evict Vulkan from later selections after a qualifying failure
- And the Mars target remains eligible

### Requirement: Standalone UI And Configuration

The normal standalone UI MUST use the production hostname through `ingress/default-gateway` and target port `4000`.

The standalone debug admin listener MUST remain loopback-only. No HTTPRoute or Service MUST expose it. Public `/config_dump` MUST remain absent.

Agent Gateway MUST support forward hybrid configuration migration. Pulumi MUST own the file-backed startup configuration containing the process addresses, PostgreSQL connection placeholder when the selected state uses the database, tracing, one `default` listener on port `4000`, body-model extraction and its exclusions, and UI attachment. These listener, UI, process, database-connection, and tracing settings MUST NOT be transferred to UI ownership.

`routeStorageMode` MUST accept exactly these three values. It controls storage for the legacy route set selected by `routingRepresentationMode`:

| Mode | Helm mode | File routes | PostgreSQL `traffic.route` resources |
| --- | --- | --- | --- |
| `file` | `readonly` | Ten final routes | None |
| `prepare-database` | `database` | Ten final routes | Ten semantically equivalent temporary routes named `pulumi-migration-<final-id>` |
| `database` | `database` | None | The selected final legacy routes: ten in `routes` or `prepare-first-class`; Bifrost only in `first-class` |

The supported forward sequence MUST be `file -> prepare-database -> database`. Reverse route-storage migration MUST remain unsupported. The parser MUST reject the removed `prepare-file` mode. These forward transitions MUST use `routingRepresentationMode: routes` in non-`database` storage states. Operators MUST NOT skip transition states. The initial `file` and `prepare-database` states are not rollback targets after first-class activation or runtime key creation. For an in-place resource-set update, the dynamic provider MUST upsert the complete desired set and validate that the response contains every expected ID with a canonically equal value before deleting removed Pulumi-owned IDs. A missing ID, mismatched returned value, or failed upsert MUST prevent deletion of the old owned IDs.

When the selected representation declares all ten legacy routes, their final IDs MUST be `openai`, `anthropic`, `claude`, `chutes`, `codex`, `cerebras`, `bifrost`, `vllm-local-embedding`, `llama-cpp-local-small`, and `llama-cpp-vulkan`. Temporary storage-transition IDs MUST add the `pulumi-migration-` prefix to those exact final IDs, and their route values MUST be semantically equivalent except for the temporary route name. All route values MUST preserve the provider contracts in this specification. Provider credentials MUST remain only in Kubernetes Secret-backed environment variables; persisted route values MUST contain `$ENV_VAR` references rather than credential values.

Pulumi MUST own the exact final or temporary route IDs declared by the selected state. The UI and self-service clients MUST own every resource ID and kind not declared by Pulumi, including runtime keys, budgets, models, policies, and experimental resources. Pulumi collection operations MUST preserve unrelated UI-owned records.

During creation, the provider MUST safely adopt a pre-existing declared ID only when its value canonically equals the desired value, including recovery after an uncertain prior response; it MUST reject a differing value without overwriting it. Before an update acquires an ID not present in the prior Pulumi-owned set, the provider MUST list the target collection: an absent ID proceeds, a canonically identical value is adopted, and a differing value MUST fail before any PUT or DELETE. IDs already present in the prior Pulumi-owned set remain Pulumi-authoritative and MAY be reconciled to their desired values without that acquisition preflight. Removing an ID from the Pulumi set or deleting the resource set MUST delete only IDs previously owned by that set. A UI edit to a Pulumi-owned route ID is drift and MAY be reconciled by a Pulumi refresh followed by an authorized update; UI-owned IDs and kinds MUST remain untouched.

Changing the resource-set endpoint or kind MUST use delete-before-replace. Such a replacement intentionally deletes the old owned objects and MUST NOT be represented as a seamless endpoint or kind migration. It requires an explicit preview and the applicable authorization for the resulting mutations. Configuration API requests MUST have a 10-second timeout for each attempt covering response receipt and consumption or parsing of the complete response body; timeout failures use bounded retries.

Raw `/api/config` MUST remain the read-only, file-backed configuration view. Persistent UI changes MUST use the `/api/config/resources/*` resource editors; the hybrid model MUST NOT imply that whole-file saves become writable. The normal UI and configuration API MUST be reachable only through the private Agent Gateway hostname, while debug administration remains loopback-only. The hybrid configuration MUST NOT add a cost catalog, budgets, Alloy changes, or mandatory client authentication. The self-service attribution contract below governs runtime virtual keys.

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

- Given the edited resource is a `traffic.route`, `llm.provider`, `llm.model`, or `llm.virtualModel` ID owned in the selected state
- When Pulumi refreshes and performs a separately authorized update
- Then the declared route value may replace the UI edit as drift
- And unrelated UI-owned resources remain unchanged

#### Scenario: Route storage moves to PostgreSQL

- Given `file` mode is the active declared state
- When separately authorized updates advance through `prepare-database` and then `database`
- Then final file routes remain present while equivalent temporary database routes are prepared
- And the final update replaces both representations with the ten final database routes

### Requirement: Self-Service Repository Key Attribution

Every non-`routes` representation MUST attach `llm.policies.apiKey` with `mode: permissive` and an empty file-owned `keys` list. This file policy permits PostgreSQL `llm.apiKey` resources to merge into the first-class LLM configuration. The policy MUST NOT use `optional` or `strict` mode. Requests without keys and requests with invalid placeholder keys MUST retain open access.

Valid repository keys MUST supply metadata `name: opencode:<repo>`, `user: rfhold`, and `group: <repo>` for request attribution. Repository identity MUST use `group`; this contract MUST NOT introduce budgets or model restrictions. Legacy routes, including Bifrost, MUST remain unchanged; this LLM policy does not promise attribution for legacy routes.

Self-service clients MUST use the private hostname's `PUT /api/config/resources/llm.apiKey` collection API with this shape:

```json
{
  "resources": [
    {
      "value": {
        "keyHash": "sha256:<64 hexadecimal digits>",
        "metadata": {
          "name": "opencode:<repo>",
          "user": "rfhold",
          "group": "<repo>"
        }
      }
    }
  ]
}
```

The client MUST omit a resource ID from this creation request. Agent Gateway assigns the resource ID and reserved metadata. The client MUST retain its raw key locally and MUST send only its SHA-256 hash to this configuration API. Pulumi MUST NOT create, reconcile, or delete these runtime keys. Pulumi collection operations for other kinds MUST preserve them.

The private local network defines the trust boundary for this unauthenticated self-service configuration API. Permissive key validation provides attribution, not access control or a security boundary. Self-service metadata does not establish verified identity. This contract MUST NOT expose another endpoint or expand network access. Existing provider credentials, routing resources, and audio access MUST remain unchanged.

#### Scenario: A repository provisions an attribution key

- Given a self-service client reaches the private configuration API
- And the first-class LLM bootstrap contains the permissive empty-key policy
- When the client submits its key hash and repository metadata without a resource ID
- Then Agent Gateway assigns an ID and persists the key resource in PostgreSQL
- And valid-key LLM requests carry `user: rfhold` and the repository `group`
- And later Pulumi updates preserve the runtime key

#### Scenario: An open client retains access

- Given a client sends no key or an invalid placeholder key
- When the first-class LLM policy evaluates the request
- Then permissive mode preserves access without repository attribution
- And the policy adds no budget or model restriction

### Requirement: Telemetry Preservation

The standalone target MUST preserve Prometheus metrics on port `15020` and OTLP gRPC tracing to `telemetry.holdenitdown.net:4317`. The hard cutover MUST NOT require an Alloy change.

#### Scenario: Standalone telemetry is rendered

- Given the stack creates standalone Agent Gateway
- When Pulumi constructs standalone telemetry configuration
- Then metrics remain available on port `15020`
- And traces use the configured OTLP destination

### Requirement: Stable Stack Outputs

The `routeUrl`, `uiRouteUrl`, and `backendNames` outputs MUST preserve their meanings. `routeUrl` MUST identify the production model URL. `uiRouteUrl` MUST identify the production UI at `/ui/`. `backendNames` MUST retain the ten prior provider identities and include `vllm-vulkan-embedding` and `llama-cpp-vulkan-small`: twelve entries total.

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

Active local model routing MUST target the corresponding standalone vLLM or llama.cpp Service, except the Vulkan targets. Vulkan uses `vulkan.holdenitdown.net` ports `8000` for `local-medium`, `8001` for embeddings, and `8002` for Qwen. Active local model routing MUST NOT depend on the legacy `ai-inference` namespace, its model Services, or a rollback-only model Service.

#### Scenario: Local backends are rendered

- Given Agent Gateway configuration declares a self-hosted model
- When its provider target is inspected
- Then it resolves to its declared standalone Service or Vulkan host and model-specific port

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
- Then it selects Athena or Vulkan through the health-and-latency virtual model
- And it forwards `Qwen/Qwen3-Embedding-0.6B` to the selected target

### Requirement: Codex Proxy Boundary

The `rfhold/codex-proxy` repository MUST own the Codex Proxy namespace and workload resources. Its service-owned Tekton PipelineRun MUST build the image and invoke that repository's Pulumi program with an immutable image digest. The workload MUST persist data at `/app/data` and provide an internal ClusterIP Service. Request-body logging, automatic updates, and proxy IP health checks MUST be disabled or omitted by default. Agent Gateway MUST NOT send an authorization credential to the proxy unless a later contract explicitly requires one.

#### Scenario: Codex-backed model routing is rendered

- Given a client requests a `codex/` model
- When Agent Gateway selects Codex Proxy
- Then it targets `codex-proxy.codex-proxy.svc.cluster.local:8080` and forwards the model after removing only `codex/`

#### Scenario: A Codex alias is requested

- Given a client requests `dreamer`, `workhorse`, or `turbo`
- When Agent Gateway selects provider `codex`
- Then it targets `codex-proxy.codex-proxy.svc.cluster.local:8080`
- And it forwards the corresponding exact upstream model from the Codex alias table without `codex/`
- And the `codex/*` wildcard remains available

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

Agent Gateway's local model inventory MUST expose only `local-embedding`, `local-small`, and `local-medium`.

| Client alias | Upstream model | Target |
| --- | --- | --- |
| `local-embedding` | `Qwen/Qwen3-Embedding-0.6B` | Equal-priority Athena `qwen3-embedding.vllm.svc.cluster.local:8000` and Vulkan `vulkan.holdenitdown.net:8001` |
| `local-small` | `qwen3.5-9b-hauhaucs-aggressive` | Equal-priority Mars `qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local:8000` and Vulkan `vulkan.holdenitdown.net:8002` |
| `local-medium` | `flint` | `vulkan.holdenitdown.net:8000` |

The Mars `local-small` target MUST retain provider identity `llama-cpp-local-small` and its historical Service hostname. Its selected backend accepts text and image inputs through the same model repository's automatically discovered BF16 projector. This contract does not promise video support. Its [standalone inference contract](standalone-inference.md#requirement-request-controlled-reasoning) defines reasoning off by default, explicit request enablement, and optional token budgets. Gateway policies MUST NOT force reasoning or duplicate backend sampling defaults. The Vulkan target MUST preserve the same model identity; its host contract owns runtime configuration and hardware selection.

The `local-medium` provider MUST retain identity `llama-cpp-vulkan`. It MUST use the OpenAI provider type with plaintext host and port configuration. Its legacy route representation MUST provide chat completions, models, and passthrough. Its first-class representation MUST use Agent Gateway's fixed LLM route surface. Agent Gateway does not check this static provider's reachability or protocol compatibility. It does not withdraw the provider when unavailable. The old model-specific embedding, Gemma, and GPT-OSS aliases and providers MUST be absent. The rollback-only Qwen3.6 llama.cpp Service and Qwen3.8 FP8 vLLM Service MUST NOT appear in the model inventory. Agent Gateway MUST NOT advertise the retired self-hosted model `zai-org/GLM-4.7-Flash`. This exclusion does not apply to the external Chutes model `chutes/zai-org/GLM-5-TEE`.

#### Scenario: Stable local aliases are rendered

- Given Agent Gateway local providers are configured
- When the client-facing local model aliases are inspected
- Then only `local-embedding`, `local-small`, and `local-medium` are present
- And each retains its exact upstream model name
- And `local-embedding` selects between its two internal targets
- And `local-small` selects between its internal Mars and Vulkan targets with upstream `qwen3.5-9b-hauhaucs-aggressive`
- And Mars preserves its provider, Service hostname, and text and image support
- And `local-medium` maps to `flint` at `vulkan.holdenitdown.net:8000` through provider `llama-cpp-vulkan`
- And the static Flint provider has no configured reachability check, protocol compatibility check, or health-aware withdrawal

#### Scenario: Retired self-hosted GLM is excluded

- Given Agent Gateway's client-facing model inventory is rendered
- When local and external model aliases are inspected
- Then `zai-org/GLM-4.7-Flash` is absent as a self-hosted model
- And `chutes/zai-org/GLM-5-TEE` may remain available through the external Chutes provider

## References

- [Agent Gateway v1.5 virtual models](https://agentgateway.dev/docs/standalone/1.5.x/documentation/llm/virtual-models/)
- [Pinned v1.5.0 schema](https://github.com/agentgateway/agentgateway/blob/v1.5.0/schema/config.json)
- [Pinned v1.5.0 retry execution and eviction test](https://github.com/agentgateway/agentgateway/blob/v1.5.0/crates/agentgateway/src/proxy/httpproxy.rs)
- [Pinned v1.5.0 retryable errors](https://github.com/agentgateway/agentgateway/blob/v1.5.0/crates/agentgateway/src/proxy/mod.rs)
- [Pinned v1.5.0 virtual-first model resolution](https://github.com/agentgateway/agentgateway/blob/v1.5.0/crates/agentgateway/src/llm/model_router.rs)
- [Pinned v1.5.0 top-level policy translation](https://github.com/agentgateway/agentgateway/blob/v1.5.0/crates/agentgateway/src/types/local.rs)
- [`programs/agent-gateway/index.ts`](../../../programs/agent-gateway/index.ts)
- [`programs/agent-gateway/Pulumi.pantheon.yaml`](../../../programs/agent-gateway/Pulumi.pantheon.yaml)
- [`src/components/agent-gateway.ts`](../../../src/components/agent-gateway.ts)
- [`src/components/agent-gateway.test.ts`](../../../src/components/agent-gateway.test.ts)
- [`src/providers/agent-gateway/config-resource-set.ts`](../../../src/providers/agent-gateway/config-resource-set.ts)
- [`src/providers/agent-gateway/config-resource-set.test.ts`](../../../src/providers/agent-gateway/config-resource-set.test.ts)
- [`src/providers/agent-gateway/client.ts`](../../../src/providers/agent-gateway/client.ts)
- [`src/providers/agent-gateway/client.test.ts`](../../../src/providers/agent-gateway/client.test.ts)

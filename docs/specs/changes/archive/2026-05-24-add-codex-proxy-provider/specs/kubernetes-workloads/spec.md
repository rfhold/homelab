# Kubernetes Workloads Delta Spec

Delta spec at `docs/specs/changes/add-codex-proxy-provider/specs/kubernetes-workloads/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

The homelab needs an internal Codex Proxy deployment so Agent Gateway can expose ChatGPT Codex-backed models through a single provider prefix without making Codex Proxy a public client endpoint.

### Impact

- **Breaking changes**: none
- **Migration**: clients that want Codex-backed models use the `codex/` model prefix through Agent Gateway; Agent Gateway calls the internal Codex Proxy Service without a proxy API key
- **Cross-change dependencies**: none

### Non-goals

- Patching Codex Proxy source code
- Changing the Codex Proxy image build pipeline
- Exposing Codex Proxy with its own public hostname
- Changing non-Codex Agent Gateway providers

### Rollback

Rollback removes the `codex-proxy` Pulumi program deployment and the Agent Gateway `codex/` provider configuration, restoring the prior Agent Gateway model inventory. The internal Codex Proxy image tag can remain in the registry unused.

---

## MODIFIED Requirements

### Requirement: Provider Prefix Model Routing
The system MUST route external model providers by client model-name prefix and remove the provider prefix before forwarding upstream.

#### Scenario: OpenAI model prefix is stripped
Given a client requests model `openai/gpt-5.2`
When Agent Gateway forwards the request to OpenAI
Then the system MUST send model `gpt-5.2` to the upstream provider

#### Scenario: Anthropic model prefix is stripped
Given a client requests model `anthropic/claude-sonnet-4-6`
When Agent Gateway forwards the request to Anthropic
Then the system MUST send model `claude-sonnet-4-6` to the upstream provider

#### Scenario: custom OpenAI-compatible provider prefix is stripped
Given a client requests a model with a configured external provider prefix such as `chutes/`
When Agent Gateway forwards the request to that OpenAI-compatible provider
Then the system MUST remove the configured provider prefix before forwarding upstream

#### Scenario: Codex proxy prefix is stripped
Given a client requests model `codex/gpt-5.5`
When Agent Gateway forwards the request to Codex Proxy
Then the system MUST send model `gpt-5.5` to Codex Proxy
And the system MUST NOT send the `codex/` provider prefix to Codex Proxy

## ADDED Requirements

### Requirement: Dedicated Codex Proxy Program
The system MUST provide a dedicated Pantheon-only Pulumi program for Codex Proxy.

#### Scenario: Codex Proxy program exists
Given homelab Pulumi programs are enumerated
When Codex Proxy is deployed
Then the system MUST provide a separate Codex Proxy program instead of deploying Codex Proxy from the Agent Gateway, LiteLLM, or ingress programs

#### Scenario: Codex Proxy program targets Pantheon
Given Codex Proxy stack configuration is inspected
When cluster-specific configuration is rendered
Then the system MUST provide Pantheon configuration
And the system MUST NOT require Romulus configuration for the initial deployment

### Requirement: Codex Proxy Internal Workload
The system MUST deploy Codex Proxy as an internal-only Kubernetes workload with persistent application data.

#### Scenario: Codex Proxy workload is rendered
Given the Codex Proxy program is deployed
When Kubernetes workload resources are rendered
Then the system MUST create a Codex Proxy workload using a pinned internal registry image tag
And the system MUST NOT use the `latest` image tag

#### Scenario: Codex Proxy image uses internal registry tag
Given the Codex Proxy workload is rendered
When container image references are inspected
Then the system MUST use `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76` for the Codex Proxy container image
And the system MUST NOT reference the upstream Codex Proxy image directly for the workload

#### Scenario: Codex Proxy data is persistent
Given the Codex Proxy workload is rendered
When persistent storage resources are inspected
Then the system MUST provide persistent storage for Codex Proxy application data
And the system MUST mount that storage at `/app/data`

#### Scenario: Codex Proxy service is internal
Given the Codex Proxy workload is deployed
When Kubernetes service resources are rendered
Then the system MUST create an internal Service for Codex Proxy
And the system MUST NOT create a public route directly to Codex Proxy

### Requirement: Codex Proxy Conservative Runtime Defaults
The system MUST configure Codex Proxy with conservative runtime defaults for logging, updates, and proxy checks.

#### Scenario: request body logging is disabled
Given Codex Proxy configuration is rendered
When logging settings are inspected
Then the system MUST disable request body capture by default

#### Scenario: update checks are disabled by default
Given Codex Proxy configuration is rendered
When update settings are inspected
Then the system MUST disable update and self-update behavior by default where the application exposes configuration for those behaviors

#### Scenario: proxy IP checks are not configured by default
Given Codex Proxy configuration is rendered
When proxy settings are inspected
Then the system MUST NOT configure proxy IP health checks unless a later change explicitly enables upstream proxy support

### Requirement: Agent Gateway Codex Provider
The system MUST route Agent Gateway models with the `codex/` prefix to Codex Proxy as a single OpenAI-compatible provider.

#### Scenario: Codex provider targets Codex Proxy
Given Agent Gateway configuration is rendered
When the `codex/` provider is inspected
Then the system MUST target the internal Codex Proxy Service
And the system MUST use Codex Proxy's OpenAI-compatible API endpoint

#### Scenario: Codex provider preserves model passthrough after prefix removal
Given a client requests a Codex-backed model through Agent Gateway
When the client model starts with `codex/`
Then the system MUST route the request to Codex Proxy
And the system MUST forward the model name after removing only the `codex/` prefix

#### Scenario: Codex provider uses no proxy API key
Given Agent Gateway forwards requests to the internal Codex Proxy Service
When provider credentials are rendered
Then the system MUST NOT configure an Agent Gateway-to-Codex-Proxy API key
And the system MUST NOT send an authorization credential from Agent Gateway to Codex Proxy by default

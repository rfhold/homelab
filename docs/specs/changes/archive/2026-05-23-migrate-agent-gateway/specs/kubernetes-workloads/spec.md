# Kubernetes Workloads Delta Spec

Delta spec at `docs/specs/changes/migrate-agent-gateway/specs/kubernetes-workloads/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

This delta cross-references the Change Overview in `docs/specs/changes/migrate-agent-gateway/specs/edge-networking/spec.md`.

## ADDED Requirements

### Requirement: Dedicated Agent Gateway Program
The system MUST provide a dedicated Pantheon-only Pulumi program for Agent Gateway.

#### Scenario: Agent Gateway program exists
Given homelab Pulumi programs are enumerated
When Agent Gateway is deployed
Then the system MUST provide a separate Agent Gateway program instead of deploying Agent Gateway from the ingress or LiteLLM programs

#### Scenario: Agent Gateway program targets Pantheon
Given Agent Gateway stack configuration is inspected
When cluster-specific configuration is rendered
Then the system MUST provide Pantheon configuration
And the system MUST NOT require Romulus configuration for the initial deployment

### Requirement: Agent Gateway Stable Release
The system MUST deploy Agent Gateway stable release `v1.2.1` for the dedicated Agent Gateway program.

#### Scenario: Agent Gateway charts use stable release
Given the Agent Gateway program renders Helm releases
When Agent Gateway CRDs and controller charts are selected
Then the system MUST use Agent Gateway chart version `v1.2.1`

#### Scenario: alpha release is excluded
Given Agent Gateway release versions are configured
When the dedicated Agent Gateway program is rendered
Then the system MUST NOT use Agent Gateway `v1.3.0-alpha.1`

### Requirement: LiteLLM Workload Replacement
The system MUST replace the LiteLLM workload with Agent Gateway for client-facing LLM routing.

#### Scenario: LiteLLM deployment is removed from active routing
Given the Agent Gateway replacement is deployed
When client-facing LLM routing resources are rendered
Then the system MUST route LLM client traffic through Agent Gateway
And the system MUST NOT require the LiteLLM Deployment or Service for client-facing LLM routing

#### Scenario: LiteLLM provider configuration is migrated
Given the existing LiteLLM stack contains OpenAI, Anthropic, Cerebras, Chutes, and vLLM provider configuration
When Agent Gateway configuration is rendered
Then the system MUST represent those upstream providers or local model backends with Agent Gateway backend resources

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

### Requirement: Self-Hosted Model Name Preservation
The system MUST preserve complete self-hosted model names when routing to local vLLM-compatible backends.

#### Scenario: GLM self-hosted model keeps full name
Given a client requests model `zai-org/GLM-4.7-Flash`
When Agent Gateway forwards the request to the local GLM backend
Then the system MUST send model `zai-org/GLM-4.7-Flash` to the upstream backend

#### Scenario: embedding self-hosted model keeps full name
Given a client requests model `Qwen/Qwen3-Embedding-4B`
When Agent Gateway forwards the request to the local embedding backend
Then the system MUST send model `Qwen/Qwen3-Embedding-4B` to the upstream backend

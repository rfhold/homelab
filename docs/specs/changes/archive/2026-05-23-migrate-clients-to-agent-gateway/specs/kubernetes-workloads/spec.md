## Change Overview

### Why

Sibling repositories still reference the retired LiteLLM endpoint and model inventory after Agent Gateway became the client-facing LLM gateway.

### Impact

All source-controlled sibling repository references to LiteLLM endpoints and client-facing model names are migrated to Agent Gateway semantics. GLM 4.7 Flash is removed from client-facing references because it is no longer served.

### Non-goals

- Preserving `litellm.holdenitdown.net` as a compatibility hostname.
- Keeping `zai-org/GLM-4.7-Flash` or GLM 4.7 Flash aliases available to clients.
- Editing dependency, generated, VCS, or build-output directories unless they are active source-controlled configuration.

### Rollback

Rollback is performed by reverting the affected repository changes and restoring clients to the previous endpoint and model inventory only if LiteLLM service availability is restored separately.

## ADDED Requirements

### Requirement: Sibling Repository Agent Gateway Client Migration
The system MUST migrate source-controlled sibling repository references from LiteLLM client endpoints and retired model names to Agent Gateway client endpoint and model names.

#### Scenario: LiteLLM endpoint references are replaced
Given sibling repositories are scanned for client-facing LLM endpoint references
When source-controlled files contain references to the LiteLLM endpoint
Then the system MUST replace those references with `agent-gateway.holdenitdown.net`
And the system MUST NOT leave active client configuration pointing at `litellm.holdenitdown.net`

#### Scenario: repository-wide references are covered
Given sibling repositories contain documentation, examples, tests, prompts, and configuration files
When the migration is performed
Then the system MUST update every source-controlled LiteLLM endpoint or retired model reference outside dependency, generated, VCS, and build-output directories

#### Scenario: retired GLM model references are removed
Given sibling repositories reference GLM 4.7 Flash models or aliases
When client-facing model references are migrated
Then the system MUST remove references to GLM 4.7 Flash as an available served model
And the system MUST NOT advertise `zai-org/GLM-4.7-Flash` or GLM 4.7 Flash aliases for Agent Gateway clients

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

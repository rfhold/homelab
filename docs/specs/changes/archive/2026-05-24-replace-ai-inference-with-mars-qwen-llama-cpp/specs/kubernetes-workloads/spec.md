## Change Overview

### Why
The legacy `ai-inference` stack is unused after local model serving moved to standalone inference stacks and Agent Gateway. A new Qwen3.6 35B A3B GGUF chat backend is needed on Mars without disrupting the existing Gemma 4 E2B llama.cpp service on Athena.

### Impact
The `ai-inference` Pulumi stack is removed as an active deployed workload. A new standalone llama.cpp stack serves `unsloth/Qwen3.6-35B-A3B-GGUF` from Mars as `qwen3.6-35b-a3b` with a 262144-token context target, and Agent Gateway routes client chat requests to that internal service. The existing Gemma 4 E2B llama.cpp stack remains active.

### Non-goals
This change does not remove the standalone vLLM Qwen3 embedding stack. This change does not modify the Gemma 4 E2B llama.cpp stack. This change does not replace Agent Gateway.

### Rollback
Rollback restores the previous Agent Gateway model routing and leaves the Mars Qwen llama.cpp stack undeployed or destroyed. If legacy ai-inference endpoints are required again, the archived ai-inference stack can be redeployed from source control history.

## ADDED Requirements

### Requirement: Legacy ai-inference Stack Retirement
The system MUST retire the legacy `ai-inference` Pulumi stack from active Pantheon model serving.

#### Scenario: ai-inference stack is destroyed
Given local model serving has moved to standalone inference stacks and Agent Gateway
When legacy Pantheon inference resources are reconciled
Then the system MUST destroy the `ai-inference` Pulumi stack resources
And the system MUST NOT require the `ai-inference` namespace workloads for active client-facing model serving

#### Scenario: standalone embedding stack is preserved
Given the standalone vLLM Qwen3 embedding stack exists outside the legacy `ai-inference` stack
When the legacy `ai-inference` stack is retired
Then the system MUST NOT remove the standalone vLLM Qwen3 embedding stack as part of this change

### Requirement: Qwen3.6 llama.cpp Model Workload
The system MUST provide a standalone llama.cpp stack for serving Qwen3.6 35B A3B GGUF as the client-facing model `qwen3.6-35b-a3b`.

#### Scenario: Qwen3.6 llama.cpp stack exists
Given standalone llama.cpp stack files are enumerated
When the Qwen3.6 GGUF llama.cpp server is configured
Then the system MUST provide a separate stack configuration for `qwen3.6-35b-a3b`
And the system MUST configure the backend model source as `unsloth/Qwen3.6-35B-A3B-GGUF`
And the system MUST configure the GGUF artifact as `Qwen3.6-35B-A3B-UD-Q6_K.gguf`
And the system MUST configure the served client-facing model name as `qwen3.6-35b-a3b`

#### Scenario: Qwen3.6 targets 262144 context
Given the `qwen3.6-35b-a3b` standalone llama.cpp stack renders its Kubernetes workload
When the llama.cpp server arguments are inspected
Then the system MUST configure a context size of `262144`
And the system MUST configure a single parallel slot for capacity testing

### Requirement: llama.cpp Mars GPU Scheduling
The system MUST allow stack configuration to schedule llama.cpp server workloads onto Mars with NVIDIA runtime access and configurable GPU resource requests.

#### Scenario: Qwen3.6 workload targets Mars
Given the `qwen3.6-35b-a3b` standalone llama.cpp workload is rendered
When Kubernetes scheduling fields are inspected
Then the system MUST constrain the workload to run on Mars according to stack configuration
And the system MUST use the NVIDIA runtime class required by the cluster
And the system MUST tolerate the cluster GPU inference taint

#### Scenario: Gemma workload remains on Athena
Given the existing Gemma 4 E2B llama.cpp workload is deployed on Athena
When the Qwen3.6 llama.cpp workload is added on Mars
Then the system MUST preserve the Gemma workload placement and configuration
And the system MUST NOT replace the Gemma Agent Gateway model route

### Requirement: Agent Gateway Routing for Qwen3.6 llama.cpp
The system MUST route Agent Gateway requests for model `qwen3.6-35b-a3b` to the internal Mars llama.cpp Qwen3.6 service.

#### Scenario: Agent Gateway provider targets Qwen3.6 llama.cpp service
Given Agent Gateway renders the backend for model `qwen3.6-35b-a3b`
When the backend provider target is inspected
Then the system MUST target the internal llama.cpp Qwen3.6 service in the Kubernetes cluster
And the system MUST use OpenAI-compatible upstream routing

#### Scenario: Client-facing Qwen3.6 model name is routed
Given a client requests model `qwen3.6-35b-a3b` through `agent-gateway.holdenitdown.net`
When Agent Gateway evaluates model routing
Then the system MUST route the request to the llama.cpp Qwen3.6 backend
And the system MUST preserve `qwen3.6-35b-a3b` as the upstream model name

#### Scenario: Gemma route remains available
Given Agent Gateway routes model `gemma-4-e2b` to the existing Gemma llama.cpp backend
When the Qwen3.6 Agent Gateway route is added
Then the system MUST continue routing `gemma-4-e2b` to the Gemma llama.cpp backend
And the system MUST route `qwen3.6-35b-a3b` independently to the Qwen3.6 llama.cpp backend

## MODIFIED Requirements

### Requirement: Internal-Only llama.cpp Service
The system MUST expose standalone llama.cpp workloads only through internal Kubernetes Services and Agent Gateway routing.

#### Scenario: Internal llama.cpp service is rendered
Given a standalone llama.cpp workload is deployed
When Kubernetes service resources are rendered
Then the system MUST create an internal Service that targets the llama.cpp OpenAI-compatible API port

#### Scenario: llama.cpp direct public route is omitted
Given Agent Gateway will serve client traffic for a standalone llama.cpp backend
When the standalone llama.cpp program is rendered
Then the system MUST NOT create an HTTPRoute for the standalone llama.cpp service
And the system MUST NOT expose a direct public hostname for the standalone llama.cpp service

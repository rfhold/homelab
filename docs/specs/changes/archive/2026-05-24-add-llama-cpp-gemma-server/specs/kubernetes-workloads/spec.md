## Change Overview

- **Why**: The Gemma 4 E2B GGUF model failed under vLLM because vLLM could not map the model's GGUF vision-tower parameters, and the homelab needs a llama.cpp-native server path for that model.
- **Impact**: Adds a standalone Pantheon llama.cpp Pulumi program, a Gemma 4 E2B stack, Hugging Face token stashing for standalone inference servers, and Agent Gateway routing for the client-facing `gemma-4-e2b` model name.
- **Non-goals**: This change does not add a direct public llama.cpp hostname, add multi-model llama.cpp hosting, repair vLLM compatibility for the Gemma GGUF, or tune performance beyond initial startup and fit-oriented settings.
- **Rollback**: Remove the llama.cpp Gemma stack and remove the Agent Gateway provider alias for `gemma-4-e2b`.

## ADDED Requirements

### Requirement: Standalone Configurable llama.cpp Program
The system MUST provide a standalone Pulumi program for running llama.cpp server workloads from stack-provided model, runtime, placement, service, storage, and resource configuration.

#### Scenario: Standalone llama.cpp program exists
Given homelab Pulumi programs are enumerated
When a llama.cpp server stack is deployed
Then the system MUST provide a separate `programs/llama-cpp/` Pulumi program instead of adding llama.cpp serving to the vLLM program

#### Scenario: Stack config selects llama.cpp deployment details
Given the standalone llama.cpp program configuration is inspected
When a model-specific stack is rendered
Then the system MUST read the served model configuration from stack configuration
And the system MUST read node placement from stack configuration
And the system MUST read GPU runtime and resource settings from stack configuration
And the system MUST read service and model-cache configuration from stack configuration

### Requirement: Gemma llama.cpp Model Workload
The system MUST provide a standalone llama.cpp stack for serving Gemma 4 E2B GGUF as the client-facing model `gemma-4-e2b`.

#### Scenario: Gemma llama.cpp stack exists
Given standalone llama.cpp stack files are enumerated
When the Gemma GGUF llama.cpp server is configured
Then the system MUST provide `programs/llama-cpp/Pulumi.gemma-4-e2b.yaml`
And the system MUST configure the backend model source for `unsloth/gemma-4-E2B-it-GGUF:Q6_K` or an equivalent resolved GGUF artifact
And the system MUST configure the served client-facing model name as `gemma-4-e2b`

#### Scenario: llama.cpp server image is configured
Given the `gemma-4-e2b` standalone llama.cpp stack renders its Kubernetes workload
When the llama.cpp container specification is inspected
Then the system MUST use a CUDA-capable llama.cpp server image
And the system MUST start an OpenAI-compatible llama.cpp server endpoint

### Requirement: llama.cpp Athena GPU Scheduling
The system MUST allow stack configuration to schedule llama.cpp server workloads onto Athena with NVIDIA runtime access and configurable GPU resource requests.

#### Scenario: NVIDIA runtime is configured
Given a llama.cpp workload targets Athena
When Kubernetes scheduling fields are inspected
Then the system MUST use the NVIDIA runtime class required by the cluster
And the system MUST constrain the workload to run on Athena according to stack configuration
And the system MUST tolerate the cluster GPU inference taint

#### Scenario: GPU resources are configurable
Given a llama.cpp stack includes Kubernetes resource settings
When the workload container resources are rendered
Then the system MUST render the resource requests and limits provided by stack configuration

### Requirement: Agent Gateway Routing for Gemma llama.cpp
The system MUST route Agent Gateway requests for model `gemma-4-e2b` to the internal llama.cpp Gemma service.

#### Scenario: Agent Gateway provider targets llama.cpp service
Given Agent Gateway renders the backend for model `gemma-4-e2b`
When the backend provider target is inspected
Then the system MUST target the internal llama.cpp Gemma service in the Kubernetes cluster
And the system MUST use OpenAI-compatible upstream routing

#### Scenario: Client-facing Gemma model name is routed
Given a client requests model `gemma-4-e2b` through `agent-gateway.holdenitdown.net`
When Agent Gateway evaluates model routing
Then the system MUST route the request to the llama.cpp Gemma backend
And the system MUST preserve `gemma-4-e2b` as the upstream model name

#### Scenario: Chat completion succeeds through Agent Gateway
Given the llama.cpp Gemma workload is ready
When a client sends a chat completion request for model `gemma-4-e2b` through Agent Gateway
Then the system MUST return a successful OpenAI-compatible chat completion response

### Requirement: Internal-Only llama.cpp Service
The system MUST expose standalone llama.cpp workloads only through internal Kubernetes Services and Agent Gateway routing.

#### Scenario: Internal llama.cpp service is rendered
Given the standalone llama.cpp Gemma workload is deployed
When Kubernetes service resources are rendered
Then the system MUST create an internal Service that targets the llama.cpp OpenAI-compatible API port

#### Scenario: llama.cpp direct public route is omitted
Given Agent Gateway will serve client traffic for the standalone llama.cpp Gemma backend
When the standalone llama.cpp program is rendered
Then the system MUST NOT create an HTTPRoute for the standalone llama.cpp service
And the system MUST NOT expose a direct public hostname for the standalone llama.cpp service

### Requirement: Stash-Captured Hugging Face Token for Standalone Inference
The system MUST support Pulumi Stash-captured Hugging Face tokens for standalone vLLM and llama.cpp server programs.

#### Scenario: Standalone vLLM captures Hugging Face token
Given the standalone vLLM program is run with an `HF_TOKEN` environment variable
When the vLLM stack renders a workload that uses Hugging Face model access
Then the system MUST capture the token with Pulumi Stash
And the system MUST provide the token to the vLLM container through the existing Kubernetes Secret environment path

#### Scenario: Standalone llama.cpp captures Hugging Face token
Given the standalone llama.cpp program is run with an `HF_TOKEN` environment variable
When the llama.cpp stack renders a workload that uses Hugging Face model access
Then the system MUST capture the token with Pulumi Stash
And the system MUST provide the token to the llama.cpp container through a Kubernetes Secret environment path

#### Scenario: Missing Hugging Face token fails before deployment
Given a standalone inference program requires Hugging Face model access
When the `HF_TOKEN` environment variable is not set
Then the system MUST fail before rendering Kubernetes resources that require the token

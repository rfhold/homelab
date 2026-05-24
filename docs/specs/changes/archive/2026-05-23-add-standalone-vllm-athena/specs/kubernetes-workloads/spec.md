## Change Overview

### Why
Athena has a 16GB NVIDIA GPU that needs an isolated vLLM experiment for determining whether `Qwen/Qwen3-Embedding-4B` can run with the standard vLLM OpenAI-compatible image.

### Impact
Adds a standalone vLLM Pulumi program with model, node placement, and GPU settings supplied by stack configuration. The initial stack deploys an internal Kubernetes workload and Service for the Qwen3 embedding model on Athena without changing public routing.

### Non-goals
This change does not expose a public HTTPRoute, wire Agent Gateway backends, or optimize beyond initial fit-oriented vLLM deployment defaults.

### Rollback
Remove the standalone vLLM stack resources to stop the experiment without affecting existing AI inference workloads.

## ADDED Requirements

### Requirement: Standalone Configurable vLLM Program
The system MUST provide a standalone Pulumi program for running vLLM from stack-provided model, node placement, and GPU configuration.

#### Scenario: Standalone program exists
Given homelab Pulumi programs are enumerated
When a standalone vLLM stack is deployed
Then the system MUST provide a separate vLLM program instead of deploying the experiment from the existing ai-inference program

#### Scenario: Stack config selects deployment details
Given the standalone vLLM program configuration is inspected
When a model-specific stack is rendered
Then the system MUST read the served model from stack configuration
And the system MUST read node placement from stack configuration
And the system MUST read GPU runtime and resource settings from stack configuration

#### Scenario: Qwen3 embedding stack exists
Given standalone vLLM stack files are enumerated
When the Qwen3 embedding experiment is configured
Then the system MUST provide `programs/vllm/Pulumi.qwen3-embedding.yaml`
And the system MUST NOT require a model-specific Pulumi program directory for Qwen3 embedding

### Requirement: Qwen3 Embedding Model Workload
The system MUST deploy `Qwen/Qwen3-Embedding-4B` using the standard vLLM OpenAI-compatible image.

#### Scenario: Model and image are configured
Given the `qwen3-embedding` standalone vLLM stack renders its Kubernetes workload
When the vLLM container specification is inspected
Then the system MUST use a standard vLLM OpenAI-compatible image
And the system MUST configure the served model as `Qwen/Qwen3-Embedding-4B`

#### Scenario: Fit-oriented deployment is attempted
Given Athena has 16GB of GPU VRAM
When the `qwen3-embedding` standalone vLLM workload starts
Then the system MUST configure vLLM with initial deployment settings intended to attempt fitting `Qwen/Qwen3-Embedding-4B` within the available GPU memory

### Requirement: Athena GPU Scheduling
The system MUST allow stack configuration to schedule the standalone vLLM workload onto Athena with NVIDIA GPU access.

#### Scenario: GPU resources are requested
Given the `qwen3-embedding` standalone vLLM workload is rendered
When Kubernetes scheduling fields are inspected
Then the system MUST request NVIDIA GPU resources for the vLLM container
And the system MUST use the NVIDIA runtime class required by the cluster

#### Scenario: Workload targets Athena
Given the `qwen3-embedding` standalone vLLM workload is rendered
When node placement fields are inspected
Then the system MUST constrain the workload to run on Athena according to stack configuration
And the system MUST tolerate the cluster GPU inference taint

### Requirement: Internal-Only vLLM Service
The system MUST expose the standalone vLLM workload only through an internal Kubernetes Service.

#### Scenario: Internal service is rendered
Given the standalone vLLM workload is deployed
When Kubernetes service resources are rendered
Then the system MUST create an internal Service that targets the vLLM OpenAI-compatible API port

#### Scenario: Public route is omitted
Given the standalone vLLM program is deployed
When edge routing resources are rendered
Then the system MUST NOT create an HTTPRoute for the standalone vLLM service
And the system MUST NOT expose a public hostname for the standalone vLLM service

#### Scenario: Gateway integration remains separate
Given Agent Gateway will serve client traffic for the standalone vLLM backend
When the standalone vLLM program is rendered
Then the system MUST NOT create Agent Gateway backend or route resources

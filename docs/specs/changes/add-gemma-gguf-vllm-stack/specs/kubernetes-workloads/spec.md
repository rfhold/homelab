## Change Overview

- **Why**: Athena has remaining GPU memory after the Qwen embedding workload was tuned down, and the homelab needs a separate vLLM experiment to test Gemma 4 E2B in GGUF format.
- **Impact**: Adds tokenizer-aware standalone vLLM configuration and a new internal-only Gemma GGUF stack using the official vLLM OpenAI-compatible image.
- **Non-goals**: This change does not expose a public route, add Agent Gateway routing, optimize GGUF performance, enable multimodal inputs, or guarantee GGUF compatibility beyond rendering and deploying the experiment configuration.
- **Rollback**: Remove the Gemma GGUF stack file and any tokenizer-specific configuration support if the experiment is abandoned.

## ADDED Requirements

### Requirement: Gemma GGUF Model Workload
The system MUST provide a standalone vLLM stack for testing `unsloth/gemma-4-E2B-it-GGUF:Q6_K` with the `google/gemma-4-E2B-it` tokenizer.

#### Scenario: GGUF model and tokenizer are configured
Given standalone vLLM stack files are enumerated
When the Gemma GGUF experiment is configured
Then the system MUST provide `programs/vllm/Pulumi.gemma-4-e2b.yaml`
And the system MUST configure the served model as `unsloth/gemma-4-E2B-it-GGUF:Q6_K`
And the system MUST configure the tokenizer as `google/gemma-4-E2B-it`

#### Scenario: GGUF workload remains experimental
Given the Gemma GGUF stack renders its Kubernetes workload
When the vLLM container arguments are inspected
Then the system MUST use the GGUF Hugging Face `repo_id:quant_type` model format
And the system MUST use the standard vLLM OpenAI-compatible image

## MODIFIED Requirements

### Requirement: Standalone Configurable vLLM Program
The system MUST provide a standalone Pulumi program for running vLLM from stack-provided model, tokenizer, node placement, runtime, and resource configuration.

#### Scenario: Standalone program exists
Given homelab Pulumi programs are enumerated
When a standalone vLLM stack is deployed
Then the system MUST provide a separate vLLM program instead of deploying the experiment from the existing ai-inference program

#### Scenario: Stack config selects deployment details
Given the standalone vLLM program configuration is inspected
When a model-specific stack is rendered
Then the system MUST read the served model from stack configuration
And the system MUST read tokenizer configuration when a stack provides it
And the system MUST read node placement from stack configuration
And the system MUST read GPU runtime and resource settings from stack configuration

#### Scenario: Qwen3 embedding stack exists
Given standalone vLLM stack files are enumerated
When the Qwen3 embedding experiment is configured
Then the system MUST provide `programs/vllm/Pulumi.qwen3-embedding.yaml`
And the system MUST NOT require a model-specific Pulumi program directory for Qwen3 embedding

#### Scenario: Gemma GGUF stack exists
Given standalone vLLM stack files are enumerated
When the Gemma GGUF experiment is configured
Then the system MUST provide `programs/vllm/Pulumi.gemma-4-e2b.yaml`
And the system MUST NOT require a model-specific Pulumi program directory for Gemma GGUF

### Requirement: Athena GPU Scheduling
The system MUST allow stack configuration to schedule the standalone vLLM workload onto Athena with NVIDIA runtime access and optional Kubernetes GPU resource requests.

#### Scenario: NVIDIA runtime is configured
Given a standalone vLLM workload targets Athena
When Kubernetes scheduling fields are inspected
Then the system MUST use the NVIDIA runtime class required by the cluster
And the system MUST constrain the workload to run on Athena according to stack configuration
And the system MUST tolerate the cluster GPU inference taint

#### Scenario: GPU resources are configurable
Given a standalone vLLM stack includes Kubernetes resource settings
When the workload container resources are rendered
Then the system MUST render the resource requests and limits provided by stack configuration

#### Scenario: GPU resources may be omitted
Given a standalone vLLM stack omits Kubernetes GPU resource settings
When the workload container resources are rendered
Then the system MUST NOT add a default `nvidia.com/gpu` request or limit

# Kubernetes Workloads Delta Spec

Delta spec at `docs/specs/changes/switch-gpt-oss-stack-to-20b/specs/kubernetes-workloads/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why
ROCm GPU detection now succeeds for the GPT-OSS llama.cpp workload when the container runs privileged. Restoring the GGUF GPT-OSS 120B backend lets the existing `gpt-oss-120b` stack retry the intended model with working ROCm device access, while shared inference components keep Hugging Face model caches on persistent storage.

### Impact
- **Breaking changes**: none
- **Migration**: operators redeploy llama.cpp stacks with the 120B GGUF backend model, privileged ROCm access where configured, and component-managed Hugging Face cache paths targeting the configured model cache volume
- **Contract surfaces**: none known
- **Cross-change dependencies**: none

### Non-goals
- Renaming the stack, Kubernetes Service, Agent Gateway provider, or client-facing model alias
- Changing context size, parallelism, scheduling, host device mounts, or resource guardrails beyond privileged ROCm access
- Building a custom ROCm image or adding an AMD device plugin/CDI path
- Changing vLLM model cache behavior beyond the already-configured persistent Hugging Face cache mount

### Rollback
Rollback restores the smaller GPT-OSS 20B repository and file in the existing stack configuration and removes the privileged container setting if it is not needed.

---

## MODIFIED Requirements

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

#### Scenario: Model cache uses Hugging Face cache paths
Given a standalone vLLM stack configures a model cache volume
When the vLLM workload is rendered
Then the system MUST mount the model cache volume at the Hugging Face cache root
And the system MUST configure Hugging Face cache environment variables to target that persistent volume

#### Scenario: Qwen3 embedding stack exists
Given standalone vLLM stack files are enumerated
When the Qwen3 embedding experiment is configured
Then the system MUST provide `programs/vllm/Pulumi.qwen3-embedding.yaml`
And the system MUST NOT require a model-specific Pulumi program directory for Qwen3 embedding

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

#### Scenario: Model cache uses Hugging Face cache paths
Given a standalone llama.cpp stack configures a model cache volume
When the llama.cpp workload is rendered
Then the system MUST mount the model cache volume into the llama.cpp container
And the system MUST configure Hugging Face cache environment variables to target that persistent volume

### Requirement: GPT-OSS llama.cpp Strix Halo Workload
The system MUST provide a standalone llama.cpp stack for serving GPT-OSS on Strix Halo using the upstream ROCm llama.cpp server image.

#### Scenario: GPT-OSS llama.cpp stack exists
Given standalone llama.cpp stack files are enumerated
When the GPT-OSS llama.cpp server is configured
Then the system MUST provide a separate stack configuration for `gpt-oss-120b`
And the system MUST configure the served client-facing model name as `gpt-oss-120b`

#### Scenario: GPT-OSS 120B backend model is configured
Given the `gpt-oss-120b` standalone llama.cpp stack renders its model source configuration
When the Hugging Face model source is inspected
Then the system MUST configure the backend model repository as `ggml-org/gpt-oss-120b-GGUF`
And the system MUST configure the backend model file as `gpt-oss-120b-mxfp4-00001-of-00003.gguf`
And the system MUST NOT rename the served client-facing model from `gpt-oss-120b`

#### Scenario: Upstream ROCm server image is configured
Given the `gpt-oss-120b` standalone llama.cpp stack renders its Kubernetes workload
When the llama.cpp container specification is inspected
Then the system MUST use `ghcr.io/ggml-org/llama.cpp:server-rocm`
And the system MUST start an OpenAI-compatible llama.cpp server endpoint

#### Scenario: GPT-OSS starts with 128k context
Given the `gpt-oss-120b` standalone llama.cpp stack renders its Kubernetes workload
When the llama.cpp server arguments are inspected
Then the system MUST configure a context size of `131072`
And the system MUST configure a single parallel slot for initial capacity testing

#### Scenario: GPT-OSS allows extended startup
Given the `gpt-oss-120b` standalone llama.cpp stack renders its Kubernetes workload
When the startup probe is inspected
Then the system MUST allow enough startup probe failures for 120B cold start and model loading on Strix Halo

### Requirement: llama.cpp AMD Device Scheduling
The system MUST allow stack configuration to schedule llama.cpp server workloads onto Strix Halo AMD APU nodes with ROCm device access.

#### Scenario: AMD devices are mounted
Given a llama.cpp workload targets a Strix Halo AMD APU node
When Kubernetes workload resources are rendered
Then the system MUST mount `/dev/kfd` into the llama.cpp container
And the system MUST mount `/dev/dri` into the llama.cpp container

#### Scenario: GPT-OSS uses privileged ROCm access
Given the `gpt-oss-120b` standalone llama.cpp workload is rendered
When the llama.cpp container security context is inspected
Then the system MUST run the container with privileged access for ROCm device cgroup access

#### Scenario: GPT-OSS workload targets Strix Halo
Given the `gpt-oss-120b` standalone llama.cpp workload is rendered
When Kubernetes scheduling fields are inspected
Then the system MUST constrain the workload to run on a Strix Halo AMD APU node according to stack configuration
And the system MUST tolerate the cluster GPU inference taint

#### Scenario: Existing NVIDIA llama.cpp stacks are preserved
Given existing Gemma and Qwen3.6 llama.cpp workloads target NVIDIA nodes
When AMD device support is added for the GPT-OSS llama.cpp workload
Then the system MUST preserve the existing NVIDIA runtime and resource configuration for those stacks
And the system MUST NOT require AMD device mounts for llama.cpp stacks that do not configure them

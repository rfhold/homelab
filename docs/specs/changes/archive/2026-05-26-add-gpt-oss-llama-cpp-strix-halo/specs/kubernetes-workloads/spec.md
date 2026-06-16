# Kubernetes Workloads Delta Spec

Delta spec at `docs/specs/changes/add-gpt-oss-llama-cpp-strix-halo/specs/kubernetes-workloads/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why
GPT-OSS 120B needs an experimental local serving path on the Strix Halo AMD APU node. The existing standalone llama.cpp stacks target CUDA/NVIDIA placement, so this change adds a ROCm/HIP-oriented llama.cpp stack that can test upstream AMD support before introducing a custom internal image.

### Impact
- **Breaking changes**: none
- **Migration**: operators can deploy the new GPT-OSS stack independently of existing Gemma and Qwen3.6 llama.cpp stacks
- **Contract surfaces**: none known
- **Cross-change dependencies**: none

### Non-goals
- Automating ROCm host installation, BIOS VRAM configuration, or TTM/GTT tuning
- Building or publishing a custom internal llama.cpp ROCm image
- Replacing existing Gemma or Qwen3.6 llama.cpp stacks
- Adding public direct ingress for the GPT-OSS llama.cpp service

### Rollback
Rollback removes the new GPT-OSS llama.cpp stack configuration or destroys the stack while preserving the shared standalone llama.cpp program and existing model stacks.

---

## ADDED Requirements

### Requirement: GPT-OSS llama.cpp Strix Halo Workload
The system MUST provide a standalone llama.cpp stack for serving GPT-OSS 120B on Strix Halo using the upstream ROCm llama.cpp server image.

#### Scenario: GPT-OSS llama.cpp stack exists
Given standalone llama.cpp stack files are enumerated
When the GPT-OSS 120B llama.cpp server is configured
Then the system MUST provide a separate stack configuration for `gpt-oss-120b`
And the system MUST configure the served client-facing model name as `gpt-oss-120b`

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

### Requirement: llama.cpp AMD Device Scheduling
The system MUST allow stack configuration to schedule llama.cpp server workloads onto Strix Halo AMD APU nodes with ROCm device access.

#### Scenario: AMD devices are mounted
Given a llama.cpp workload targets a Strix Halo AMD APU node
When Kubernetes workload resources are rendered
Then the system MUST mount `/dev/kfd` into the llama.cpp container
And the system MUST mount `/dev/dri` into the llama.cpp container

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

### Requirement: Agent Gateway Routing for GPT-OSS llama.cpp
The system MUST route Agent Gateway requests for model `gpt-oss-120b` to the internal Strix Halo llama.cpp GPT-OSS service.

#### Scenario: Agent Gateway provider targets GPT-OSS llama.cpp service
Given Agent Gateway renders the backend for model `gpt-oss-120b`
When the backend provider target is inspected
Then the system MUST target the internal llama.cpp GPT-OSS service in the Kubernetes cluster
And the system MUST use OpenAI-compatible upstream routing

#### Scenario: Client-facing GPT-OSS model name is routed
Given a client requests model `gpt-oss-120b` through `agent-gateway.holdenitdown.net`
When Agent Gateway evaluates model routing
Then the system MUST route the request to the llama.cpp GPT-OSS backend
And the system MUST preserve `gpt-oss-120b` as the upstream model name

#### Scenario: Existing llama.cpp routes remain available
Given Agent Gateway routes existing llama.cpp models to their backends
When the GPT-OSS Agent Gateway route is added
Then the system MUST continue routing existing llama.cpp models to their current backends
And the system MUST route `gpt-oss-120b` independently to the GPT-OSS llama.cpp backend

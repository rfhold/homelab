# Standalone Inference

## Purpose

This specification governs reusable vLLM and llama.cpp programs, model-specific stack configuration, GPU and host-device scheduling, persistent model caches, and secret delivery.

## Requirements

### Requirement: Configurable vLLM Program

The repository MUST provide a standalone vLLM program whose stack configuration selects the model, optional tokenizer, inference settings, runtime class, placement, resources, optional host devices, and model cache. The component MUST emit `--tokenizer` only when a tokenizer is configured.

#### Scenario: A tokenizer is configured

- Given a vLLM stack supplies a tokenizer distinct from its model source
- When the Deployment arguments are rendered
- Then `--tokenizer` contains the supplied value

#### Scenario: A tokenizer is omitted

- Given a vLLM stack does not supply a tokenizer
- When the Deployment arguments are rendered
- Then no tokenizer argument is added

### Requirement: Qwen Embedding Configuration

The `qwen3-embedding` stack MUST configure `Qwen/Qwen3-Embedding-4B` with the standard vLLM OpenAI-compatible image, pooling behavior, NVIDIA runtime, GPU-inference toleration, Athena placement, persistent Hugging Face cache paths, and an NVIDIA GPU resource request.

#### Scenario: Qwen resources are rendered

- Given the Qwen embedding stack is selected
- When the container resources and scheduling fields are inspected
- Then the pod targets Athena, tolerates the GPU taint, uses the NVIDIA runtime, and requests an NVIDIA GPU

The tracked GPU request gap is recorded in [verification](../verification.md); this requirement remains the intended contract.

### Requirement: Configurable llama.cpp Program

The repository MUST provide a standalone llama.cpp program whose stack configuration selects model source, client alias, server settings, runtime, placement, resources, service, probes, storage, and optional host devices.

#### Scenario: Host devices are configured

- Given a stack declares host and container device paths
- When the llama.cpp Deployment is rendered
- Then each device becomes a hostPath volume and matching container mount

#### Scenario: Host devices are omitted

- Given a stack does not declare host devices
- When the llama.cpp Deployment is rendered
- Then it does not receive AMD device mounts by default

### Requirement: Model-Specific llama.cpp Stacks

The standalone program MUST support these independent configurations:

| Client model | Backend source and placement |
| --- | --- |
| `gemma-4-e2b` | `unsloth/gemma-4-E2B-it-GGUF` and `gemma-4-E2B-it-Q6_K.gguf` on Athena with NVIDIA runtime and GPU request |
| `qwen3.6-35b-a3b` | `unsloth/Qwen3.6-35B-A3B-GGUF` and `Qwen3.6-35B-A3B-UD-Q6_K.gguf` on Mars with context `262144`, one parallel slot, NVIDIA runtime, and GPU request |
| `gpt-oss-120b` | `ggml-org/gpt-oss-120b-GGUF` and `gpt-oss-120b-mxfp4-00001-of-00003.gguf` on Vulkan with context `131072`, one parallel slot, and the upstream ROCm server image |

#### Scenario: The ROCm stack is rendered

- Given the GPT-OSS stack is selected
- When its pod specification is inspected
- Then it mounts `/dev/kfd` and `/dev/dri`, uses privileged container access, tolerates the GPU-inference taint, and allows its extended startup probe window

### Requirement: Persistent Hugging Face Cache

When either component receives a model-cache volume, it MUST mount that volume for model data and set `HF_HOME` and `HUGGINGFACE_HUB_CACHE` to paths on that volume unless the stack explicitly overrides them.

#### Scenario: A cache is configured without environment overrides

- Given a standalone inference stack supplies persistent model storage
- When the container environment is rendered
- Then both Hugging Face cache variables point into the mounted persistent volume

### Requirement: Hugging Face Credential Boundary

Standalone vLLM and Hugging Face-backed llama.cpp stacks MUST capture `HF_TOKEN` with Pulumi Stash, treat it as secret, and inject it through a Kubernetes Secret. A token-dependent stack MUST fail before rendering its workload when the environment variable is absent.

#### Scenario: Required token is absent

- Given a selected model requires Hugging Face repository access
- When the standalone program starts without `HF_TOKEN`
- Then it stops before constructing the token-dependent Kubernetes workload

### Requirement: Internal Service Exposure

Standalone inference programs MUST expose their model server through ClusterIP Services and MUST NOT create direct HTTPRoute, Ingress, or Agent Gateway resources. Client routing MUST remain separately owned by Agent Gateway.

#### Scenario: A standalone model stack is rendered

- Given a vLLM or llama.cpp stack is selected
- When edge resources are enumerated
- Then the program has an internal Service and no direct public route

## References

- [`programs/vllm/index.ts`](../../../programs/vllm/index.ts)
- [`src/components/vllm.ts`](../../../src/components/vllm.ts)
- [`programs/llama-cpp/index.ts`](../../../programs/llama-cpp/index.ts)
- [`src/components/llama-cpp.ts`](../../../src/components/llama-cpp.ts)
- [Gemma serving decision](../decisions/gemma-serving.md)

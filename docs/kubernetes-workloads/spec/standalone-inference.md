# Standalone Inference

## Purpose

This specification governs reusable vLLM and llama.cpp programs, model-specific stack configuration, GPU and host-device scheduling, persistent model caches, and secret delivery.

## Requirements

### Requirement: Configurable vLLM Program

The repository MUST provide a standalone vLLM program whose stack configuration selects the model, optional tokenizer, inference settings, runtime class, placement, resources, optional host devices, Deployment strategy, startup probe, namespace ownership, and model cache. Configurable inference settings MUST include maximum batched tokens, KV-cache data type, KV-scale calculation, and speculative decoding. The component MUST emit the corresponding vLLM argument only when that setting is configured, and omitted settings MUST preserve existing stack behavior.

The program MUST create and retain its configured Namespace by default. A stack that sets `createNamespace: false` MUST reference the existing physical Namespace with `Namespace.get` instead of creating or owning it. Standalone stacks intended to coexist in one physical Namespace MUST designate one stack to retain the default ownership behavior and use the reference path for the others.

#### Scenario: A tokenizer is configured

- Given a vLLM stack supplies a tokenizer distinct from its model source
- When the Deployment arguments are rendered
- Then `--tokenizer` contains the supplied value

#### Scenario: A tokenizer is omitted

- Given a vLLM stack does not supply a tokenizer
- When the Deployment arguments are rendered
- Then no tokenizer argument is added

#### Scenario: Optional batching and KV-cache settings are configured

- Given a vLLM stack supplies maximum batched tokens, a KV-cache data type, and KV-scale calculation
- When the Deployment arguments are rendered
- Then it includes `--max-num-batched-tokens`, `--kv-cache-dtype`, and `--calculate-kv-scales` with the configured behavior

#### Scenario: A stack shares an existing namespace

- Given another standalone stack owns the configured physical Namespace
- When the stack sets `createNamespace: false`
- Then the program references that Namespace without creating or owning another Namespace resource

### Requirement: Qwen Embedding Configuration

The `qwen3-embedding` stack MUST configure `Qwen/Qwen3-Embedding-0.6B` in BF16 with model length `32768`, GPU memory utilization `0.35`, four concurrent sequences, pooling behavior, eager execution, NVIDIA runtime, GPU-inference toleration, Athena placement, and persistent Hugging Face cache paths. It MUST preserve the deliberate scheduler behavior of omitting an `nvidia.com/gpu` resource request because Athena is shared with Gemma and planned speech services. This omission does not define or prove formal GPU partitioning; the unaccounted sharing boundary is recorded in [verification](../verification.md).

#### Scenario: Qwen resources are rendered

- Given the Qwen embedding stack is selected
- When the container resources and scheduling fields are inspected
- Then the pod targets Athena, tolerates the GPU taint, uses the NVIDIA runtime, and does not request `nvidia.com/gpu`

### Requirement: Qwen3.8 Full-Vision Configuration

The `qwen3.8-27b` stack MUST serve exactly `Qwen/Qwen3.8-27B-FP8` through the standard `docker.io/vllm/vllm-openai:v0.21.0-cu129-ubuntu2404` image on Mars. It MUST reference the existing `vllm` Namespace without owning it; the embedding stack remains the Namespace owner. It MUST retain full multimodal vision support, set model length `131072`, allow at least two concurrent sequences, use one NVIDIA GPU, use a `Recreate` Deployment strategy, and allow approximately two hours for startup.

The stack MUST use FP8 KV cache with calculated scales, chunked prefill, maximum batched tokens `2048`, GPU memory utilization `0.92`, the `qwen3` reasoning parser, automatic tool choice with the `qwen3_coder` parser, built-in MTP speculative decoding with exactly three speculative tokens, and default chat-template keyword arguments that enable thinking, request `xhigh` reasoning effort, and preserve thinking. It MUST omit forced eager execution so vLLM's default hybrid CUDA graph behavior remains enabled. It MUST leave generation configuration on vLLM's implicit `auto` behavior so official model defaults apply. It MUST NOT select language-model-only mode or forced quantization.

#### Scenario: The Mars Qwen stack is rendered

- Given the `qwen3.8-27b` stack is selected
- When its container arguments and pod specification are inspected
- Then the stack targets Mars with one NVIDIA GPU and the declared context, concurrency, cache, batching, reasoning, tool-use, MTP, and chat-template settings
- And `--speculative-config` contains exactly `method` set to `mtp` and `num_speculative_tokens` set to `3`
- And it does not add a forced-eager, language-model-only, forced-quantization, or generation-configuration argument

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
| `qwen3.6-35b-a3b` | Rollback-only `unsloth/Qwen3.6-35B-A3B-GGUF` and `Qwen3.6-35B-A3B-UD-Q6_K.gguf` resources on Mars with context `262144`, one parallel slot, NVIDIA runtime, GPU request, extended startup probe, and zero replicas |
| `gpt-oss-120b` | `ggml-org/gpt-oss-120b-GGUF` and `gpt-oss-120b-mxfp4-00001-of-00003.gguf` on Vulkan with context `131072`, one parallel slot, and the upstream ROCm server image |

#### Scenario: The ROCm stack is rendered

- Given the GPT-OSS stack is selected
- When its pod specification is inspected
- Then it mounts `/dev/kfd` and `/dev/dri`, uses privileged container access, tolerates the GPU-inference taint, and allows its extended startup probe window

#### Scenario: The Qwen3.6 rollback stack is rendered

- Given the Qwen3.6 llama.cpp stack remains available for rollback
- When its Deployment is rendered without a separate rollback authorization
- Then its desired replica count is zero

### Requirement: Persistent Hugging Face Cache

When either component receives a model-cache volume, it MUST mount that volume for model data and set `HF_HOME` and `HUGGINGFACE_HUB_CACHE` to paths on that volume unless the stack explicitly overrides them.

#### Scenario: A cache is configured without environment overrides

- Given a standalone inference stack supplies persistent model storage
- When the container environment is rendered
- Then both Hugging Face cache variables point into the mounted persistent volume

### Requirement: Hugging Face Credential Boundary

Standalone vLLM and Hugging Face-backed llama.cpp stacks MUST capture a supplied `HF_TOKEN` with Pulumi Stash, treat it as secret, and inject the Stash output through a Kubernetes Secret. The standalone vLLM program MUST use a supplied token to seed a newly created `hf-token` Stash. Once created, the Stash MUST retain its original output regardless of later input changes. When `HF_TOKEN` is absent, the program MUST fail before constructing the Stash unless the stack explicitly sets `reuseRetainedHfToken: true`. An operator MUST enable that opt-in only after verifying that the selected stack already has a seeded immutable `hf-token` Stash. With the opt-in enabled, the program MUST pass a secret empty-string input so the existing Stash retains its original output. A fresh vLLM stack MUST receive `HF_TOKEN` for initial token seeding. A token-dependent llama.cpp stack MUST fail before rendering its workload when the environment variable is absent.

#### Scenario: A retained vLLM token is reused

- Given the vLLM stack has a previously seeded `hf-token` Stash
- And the stack sets `reuseRetainedHfToken: true`
- When the standalone program starts without `HF_TOKEN`
- Then the Stash receives a secret empty-string input and retains its prior output
- And the Kubernetes Secret receives the retained Stash output

#### Scenario: A fresh vLLM token is seeded

- Given the vLLM stack does not have a previously seeded `hf-token` Stash
- When the standalone program starts with `HF_TOKEN`
- Then the Stash captures the supplied token as a secret for Kubernetes Secret delivery

#### Scenario: Retained token reuse is not enabled

- Given a vLLM stack does not set `reuseRetainedHfToken: true`
- When the standalone program starts without `HF_TOKEN`
- Then it stops before constructing the `hf-token` Stash

#### Scenario: A required llama.cpp token is absent

- Given a selected model requires Hugging Face repository access
- When the standalone llama.cpp program starts without `HF_TOKEN`
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

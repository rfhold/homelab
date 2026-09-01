# Tracked Runtime Implementation

This document describes tracked repository source. It does not establish that any stack is deployed, healthy, or configured the same way in a live cluster.

## Workload Metadata

[`withWorkloadLabels`](../../src/types.ts) is a Pulumi resource transformation used by many components and modules. When labels are supplied, it merges them into Kubernetes resource metadata and into pod templates for Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, and CronJobs. Existing resource labels take precedence. When labels are omitted, the helper leaves resource options unchanged.

Stack configuration commonly supplies the five `app.kubernetes.io/*` identity labels and `rholden.dev/workload-layer`. Coverage is not universal; see [verification](verification.md).

The planned reboot implementation in [`scripts/planned-node-reboot.sh`](../../scripts/planned-node-reboot.sh) selects labeled, non-storage pods by default.

## Model Gateway

[`programs/agent-gateway`](../../programs/agent-gateway) is a Pantheon-configured Pulumi program separate from ingress. The reusable component renders Agent Gateway charts, a dedicated Gateway, provider Secrets, backends, and separate model and Admin UI HTTPRoutes. Both Agent Gateway charts are pinned to `v1.4.1` in [`src/helm-charts.ts`](../../src/helm-charts.ts).

The Admin UI route uses `agent-gateway.holdenitdown.net` with exact `/`, exact `/config_dump`, and prefixes `/ui` and `/api`. When Admin UI resources are enabled, tracked source creates a namespaced `AgentgatewayParameters` with `ADMIN_ADDR=0.0.0.0:15000` and attaches it through the Gateway infrastructure. This binds the admin listener to pod interfaces so the dedicated ClusterIP Service can reach port `15000`; it does not establish live listener or route health. The route preserves request paths, and exact `/config_dump` provides the read-only xDS route inventory required by the UI. The Kubernetes UI provides read-only administrative runtime, configuration, and log inspection, but remains administratively sensitive. The body-derived PreRouting model policy targets the Gateway, as required for content-based routing. Its condition excludes the administrative paths plus exact `/v1/audio/transcriptions` and `/v1/audio/speech`, so those requests bypass model extraction.

The tracked route contract assigns the audio workloads and ordinary Gateway API HTTPRoutes to `rfhold/whisperx-server` and `rfhold/kokoro-server`. It assigns exact `/v1/audio/transcriptions` and `/v1/audio/speech` routes to workload Services and preserves `whisperx.holdenitdown.net` and `kokoro.holdenitdown.net` as direct hostnames. Service EndpointSlices form the future-balanced backend pool as replicas increase. Homelab source renders neither audio HTTPRoute. The contract retains public unauthenticated access for both audio endpoints; workload-repository and live state remain unverified.

Tracked provider configuration includes direct OpenAI and Anthropic providers, external OpenAI-compatible providers, Claude Proxy, Codex Proxy, a local vLLM embedding provider, and a local llama.cpp chat provider. The stable local aliases are `local-embedding`, mapped to `Qwen/Qwen3-Embedding-0.6B` at `qwen3-embedding.vllm.svc.cluster.local:8000`, and `local-small`, mapped to `qwen3.8-27b` at `qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local:8000`. Local policies do not duplicate model sampling defaults. Prefix policies remove `openai/`, `anthropic/`, `claude/`, or `codex/` before forwarding.

[`programs/codex-proxy`](../../programs/codex-proxy) configures a Pantheon workload with image `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76`, a persistent `/app/data` mount, disabled request-body logging, disabled automatic updates, no proxy API key or proxy IP health-check configuration, a ClusterIP Service, and an administrative HTTPRoute. Agent Gateway reaches that Service without an upstream authorization Secret.

The `rfhold/claude-proxy` repository owns the Claude Proxy namespace, workload, PVC, Service, CI, and Pulumi program. Homelab configures only the Agent Gateway backend route. That route uses the native Anthropic provider, targets `claude-proxy.claude-proxy.svc.cluster.local:8080`, removes only `claude/`, and supplies no upstream authorization Secret. The direct Anthropic provider retains its separate `anthropic/` prefix and credential.

## Standalone Inference

The standalone programs render one model stack per Pulumi stack and create ClusterIP Services:

| Program and stack | Tracked configuration |
| --- | --- |
| [`vllm/Pulumi.qwen3-embedding.yaml`](../../programs/vllm/Pulumi.qwen3-embedding.yaml) | `Qwen/Qwen3-Embedding-0.6B`, BF16, `32768` model length, pooling runner, eager execution, Athena placement, NVIDIA runtime, NFS model cache, and no NVIDIA GPU resource request |
| [`vllm/Pulumi.qwen3.8-27b.yaml`](../../programs/vllm/Pulumi.qwen3.8-27b.yaml) | Rollback Qwen3.8 FP8 vLLM configuration retained at zero replicas |
| [`llama-cpp/Pulumi.gemma-4-e2b.yaml`](../../programs/llama-cpp/Pulumi.gemma-4-e2b.yaml) | Gemma GGUF, Athena placement, NVIDIA runtime and GPU request |
| [`llama-cpp/Pulumi.qwen3.8-27b.yaml`](../../programs/llama-cpp/Pulumi.qwen3.8-27b.yaml) | Active Qwen3.8 Q8_K_P GGUF with automatically discovered BF16 vision projector, `262144` context, `q8_0` K and V caches, one parallel slot, full GPU offload, embedded MTP depth `2`, Jinja, preserved `xhigh` reasoning, model-card sampling defaults, one NVIDIA GPU, Mars placement, Recreate strategy, and an approximately two-hour startup allowance |
| [`llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml`](../../programs/llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml) | Rollback-only Qwen3.6 GGUF resources at zero replicas, with Mars placement, NVIDIA runtime, GPU request, and the retained extended startup probe |
| [`llama-cpp/Pulumi.gpt-oss-120b.yaml`](../../programs/llama-cpp/Pulumi.gpt-oss-120b.yaml) | GPT-OSS GGUF, Vulkan placement, ROCm image, privileged access, and `/dev/kfd` plus `/dev/dri` mounts |

[`src/components/vllm.ts`](../../src/components/vllm.ts) accepts optional tokenizer, maximum-batched-token, KV-cache, KV-scale, speculative-decoding, Deployment-strategy, and startup-probe settings. It emits their CLI flags only when configured and otherwise preserves existing defaults, including the default Recreate strategy and startup probe. Speculative configuration is serialized once as JSON for `--speculative-config`. The standalone vLLM program passes these settings with model, runtime, placement, resources, devices, and cache configuration. A supplied `HF_TOKEN` seeds a newly created `hf-token` Pulumi Stash. Without the environment variable, the program fails before Stash construction unless the stack explicitly sets `reuseRetainedHfToken: true`; that opt-in passes a secret empty-string input so an already-seeded immutable Stash retains its original output. Operators must enable the opt-in only after verifying that the selected stack already has that seeded Stash. A fresh stack still requires `HF_TOKEN` for initial token seeding.

Both standalone programs create and retain their configured Namespace unless `createNamespace` is explicitly false, in which case they use `Namespace.get` to reference the existing physical Namespace. The embedding stack preserves the default and owns `vllm`. The active Qwen3.8 llama.cpp stack sets `createNamespace: false` and references the shared `llama-cpp` Namespace; its retained vLLM rollback stack likewise references `vllm`.

The active Mars Qwen stack uses pinned multi-architecture CUDA image `ghcr.io/ggml-org/llama.cpp:server-cuda-b10630`, upstream Hugging Face repository and file selection, automatic multimodal-projector discovery, embedded MTP, and stack-owned reasoning and sampling flags. The old FP8 vLLM stack retains its image, model, token-reuse configuration, and runtime settings at zero replicas for rollback. The token-reuse opt-in records the operator precondition but does not prove the Stash exists in live state. The embedding stack intentionally omits an NVIDIA GPU resource request to retain the existing Athena scheduler behavior; this source choice does not account for or formally partition GPU capacity shared with Gemma and planned speech services.

[`src/components/llama-cpp.ts`](../../src/components/llama-cpp.ts) accepts model source, server settings, placement, resources, probes, and optional host-device mappings. Its replica default preserves an explicit zero, allowing the Qwen3.6 rollback Deployment to remain scaled down. Deployments use two-hour Pulumi create and update timeouts so cold model downloads can remain inside their configured startup-probe window. Each device mapping becomes a hostPath volume and matching container mount. The program requires and stashes `HF_TOKEN` only for Hugging Face repository or file sources and supports owned or referenced Namespaces.

Both components place Hugging Face cache variables on the configured persistent model-cache volume unless a stack overrides them. The standalone programs do not render HTTPRoute or Agent Gateway resources; client routing is configured separately in Agent Gateway.

## Registry

The Pantheon container-registry stack has tracked Zot configuration enabled with an S3 backend, pull-through synchronization, a LoadBalancer Service, and `cr.holdenitdown.net` DNS annotation. Source currently disables Zot UI and search, supplies a long startup probe, and asks the registry module to create a cert-manager Certificate. Those source facts do not resolve the approval and deployment gap recorded in [verification](verification.md).

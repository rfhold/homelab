# Tracked Runtime Implementation

This document describes tracked repository source. It does not establish that any stack is deployed, healthy, or configured the same way in a live cluster.

## Workload Metadata

[`withWorkloadLabels`](../../src/types.ts) is a Pulumi resource transformation used by many components and modules. When labels are supplied, it merges them into Kubernetes resource metadata and into pod templates for Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, and CronJobs. Existing resource labels take precedence. When labels are omitted, the helper leaves resource options unchanged.

Stack configuration commonly supplies the five `app.kubernetes.io/*` identity labels and `rholden.dev/workload-layer`. Coverage is not universal; see [verification](verification.md).

The planned reboot implementation in [`scripts/planned-node-reboot.sh`](../../scripts/planned-node-reboot.sh) selects labeled, non-storage pods by default.

## Model Gateway

[`programs/agent-gateway`](../../programs/agent-gateway) is a Pantheon-configured Pulumi program separate from ingress. The reusable component renders Agent Gateway charts, a dedicated Gateway, provider Secrets, backends, and separate model and Admin UI HTTPRoutes. Both Agent Gateway charts are pinned to `v1.4.1` in [`src/helm-charts.ts`](../../src/helm-charts.ts).

The Admin UI route uses `agent-gateway.holdenitdown.net` with exact `/`, exact `/config_dump`, and prefixes `/ui` and `/api`. When Admin UI resources are enabled, tracked source creates a namespaced `AgentgatewayParameters` with `ADMIN_ADDR=0.0.0.0:15000` and attaches it through the Gateway infrastructure. This binds the admin listener to pod interfaces so the dedicated ClusterIP Service can reach port `15000`; it does not establish live listener or route health. The route preserves request paths, and exact `/config_dump` provides the read-only xDS route inventory required by the UI. The Kubernetes UI provides read-only administrative runtime, configuration, and log inspection, but remains administratively sensitive. The body-derived PreRouting model policy targets the Gateway, as required for content-based routing, and its condition excludes exact `/`, exact `/config_dump`, and the `/ui` and `/api` path segments so Admin UI traffic bypasses model extraction.

Tracked provider configuration includes external OpenAI-compatible providers, Codex Proxy, and two local vLLM providers. The stable local aliases are `local-embedding`, mapped to `Qwen/Qwen3-Embedding-0.6B` at `qwen3-embedding.vllm.svc.cluster.local:8000`, and `local-small`, mapped to `Qwen/Qwen3.8-27B-FP8` at `qwen3-8-27b.vllm.svc.cluster.local:8000`. No local llama.cpp provider remains in Agent Gateway, and its local policies do not duplicate model sampling defaults. Prefix policies remove `openai/`, `anthropic/`, or `codex/` before forwarding.

[`programs/codex-proxy`](../../programs/codex-proxy) configures a Pantheon workload with image `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76`, a persistent `/app/data` mount, disabled request-body logging, disabled automatic updates, no proxy API key or proxy IP health-check configuration, a ClusterIP Service, and an administrative HTTPRoute. Agent Gateway reaches that Service without an upstream authorization Secret.

## Standalone Inference

The standalone programs render one model stack per Pulumi stack and create ClusterIP Services:

| Program and stack | Tracked configuration |
| --- | --- |
| [`vllm/Pulumi.qwen3-embedding.yaml`](../../programs/vllm/Pulumi.qwen3-embedding.yaml) | `Qwen/Qwen3-Embedding-0.6B`, BF16, `32768` model length, pooling runner, eager execution, Athena placement, NVIDIA runtime, NFS model cache, and no NVIDIA GPU resource request |
| [`vllm/Pulumi.qwen3.8-27b.yaml`](../../programs/vllm/Pulumi.qwen3.8-27b.yaml) | `Qwen/Qwen3.8-27B-FP8`, full vision, `131072` model length, two sequences, FP8 KV cache with calculated scales, chunked prefill, eager execution, Qwen reasoning and tool parsers, one NVIDIA GPU, Mars placement, Recreate strategy, and an approximately two-hour startup allowance |
| [`llama-cpp/Pulumi.gemma-4-e2b.yaml`](../../programs/llama-cpp/Pulumi.gemma-4-e2b.yaml) | Gemma GGUF, Athena placement, NVIDIA runtime and GPU request |
| [`llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml`](../../programs/llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml) | Rollback-only Qwen3.6 GGUF resources at zero replicas, with Mars placement, NVIDIA runtime, GPU request, and the retained extended startup probe |
| [`llama-cpp/Pulumi.gpt-oss-120b.yaml`](../../programs/llama-cpp/Pulumi.gpt-oss-120b.yaml) | GPT-OSS GGUF, Vulkan placement, ROCm image, privileged access, and `/dev/kfd` plus `/dev/dri` mounts |

[`src/components/vllm.ts`](../../src/components/vllm.ts) accepts optional tokenizer, maximum-batched-token, KV-cache, KV-scale, Deployment-strategy, and startup-probe settings. It emits their CLI flags only when configured and otherwise preserves existing defaults, including the default Recreate strategy and startup probe. The standalone vLLM program passes these settings with model, runtime, placement, resources, devices, and cache configuration. It requires `HF_TOKEN`, captures it with Pulumi Stash, and injects it through a Kubernetes Secret.

The standalone program creates and retains its configured Namespace unless `createNamespace` is explicitly false, in which case it uses `Namespace.get` to reference the existing physical Namespace. The embedding stack preserves the default and owns `vllm`; the Qwen3.8 stack sets `createNamespace: false` and references that Namespace.

The Mars Qwen stack uses the cataloged `docker.io/vllm/vllm-openai:v0.21.0-cu129-ubuntu2404` image and leaves vLLM generation configuration implicit so the model's official defaults apply. It does not configure language-model-only mode, MTP, speculative decoding, or forced quantization. The embedding stack intentionally omits an NVIDIA GPU resource request to retain the existing Athena scheduler behavior; this source choice does not account for or formally partition GPU capacity shared with Gemma and planned speech services.

[`src/components/llama-cpp.ts`](../../src/components/llama-cpp.ts) accepts model source, server settings, placement, resources, probes, and optional host-device mappings. Its replica default preserves an explicit zero, allowing the Qwen3.6 rollback Deployment to remain scaled down. Each device mapping becomes a hostPath volume and matching container mount. The program requires and stashes `HF_TOKEN` only for Hugging Face repository or file sources.

Both components place Hugging Face cache variables on the configured persistent model-cache volume unless a stack overrides them. The standalone programs do not render HTTPRoute or Agent Gateway resources; client routing is configured separately in Agent Gateway.

## Registry

The Pantheon container-registry stack has tracked Zot configuration enabled with an S3 backend, pull-through synchronization, a LoadBalancer Service, and `cr.holdenitdown.net` DNS annotation. Source currently disables Zot UI and search, supplies a long startup probe, and asks the registry module to create a cert-manager Certificate. Those source facts do not resolve the approval and deployment gap recorded in [verification](verification.md).

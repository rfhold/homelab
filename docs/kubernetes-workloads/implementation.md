# Tracked Runtime Implementation

This document describes repository source inspected during the conversion based on `316959090d82d223693858ad8690f4d6f1561f4c`. It does not establish that any stack is deployed, healthy, or still configured the same way in a live cluster.

## Workload Metadata

[`withWorkloadLabels`](../../src/types.ts) is a Pulumi resource transformation used by many components and modules. When labels are supplied, it merges them into Kubernetes resource metadata and into pod templates for Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, and CronJobs. Existing resource labels take precedence. When labels are omitted, the helper leaves resource options unchanged.

Stack configuration commonly supplies the five `app.kubernetes.io/*` identity labels and `rholden.dev/workload-layer`. Coverage is not universal; see [verification](verification.md).

The planned reboot implementation in [`scripts/planned-node-reboot.sh`](../../scripts/planned-node-reboot.sh) selects labeled, non-storage pods by default. Its focused tests are in [`tests/test_workload_labels.py`](../../tests/test_workload_labels.py).

## Model Gateway

[`programs/agent-gateway`](../../programs/agent-gateway) is a Pantheon-configured Pulumi program separate from ingress. The reusable component creates Agent Gateway charts, a dedicated Gateway, provider Secrets, backends, a model-routing policy, and an HTTPRoute. Both Agent Gateway charts are pinned to `v1.2.1` in [`src/helm-charts.ts`](../../src/helm-charts.ts).

Tracked provider configuration includes external OpenAI-compatible providers, Codex Proxy, Qwen embeddings through vLLM, and three llama.cpp chat backends. Prefix policies remove `openai/`, `anthropic/`, or `codex/` before forwarding. Exact model aliases preserve the configured self-hosted model name.

[`programs/codex-proxy`](../../programs/codex-proxy) configures a Pantheon workload with image `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76`, a persistent `/app/data` mount, disabled request-body logging, disabled automatic updates, no proxy API key or proxy IP health-check configuration, a ClusterIP Service, and an administrative HTTPRoute. Agent Gateway reaches that Service without an upstream authorization Secret.

## Standalone Inference

The standalone programs render one model stack per Pulumi stack and create ClusterIP Services:

| Program and stack | Tracked configuration |
| --- | --- |
| [`vllm/Pulumi.qwen3-embedding.yaml`](../../programs/vllm/Pulumi.qwen3-embedding.yaml) | `Qwen/Qwen3-Embedding-4B`, pooling runner, Athena placement, NVIDIA runtime, NFS model cache |
| [`llama-cpp/Pulumi.gemma-4-e2b.yaml`](../../programs/llama-cpp/Pulumi.gemma-4-e2b.yaml) | Gemma GGUF, Athena placement, NVIDIA runtime and GPU request |
| [`llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml`](../../programs/llama-cpp/Pulumi.qwen3.6-35b-a3b.yaml) | Qwen3.6 GGUF, Mars placement, NVIDIA runtime and GPU request |
| [`llama-cpp/Pulumi.gpt-oss-120b.yaml`](../../programs/llama-cpp/Pulumi.gpt-oss-120b.yaml) | GPT-OSS GGUF, Vulkan placement, ROCm image, privileged access, and `/dev/kfd` plus `/dev/dri` mounts |

[`src/components/vllm.ts`](../../src/components/vllm.ts) accepts an optional tokenizer and emits `--tokenizer` only when configured. The standalone vLLM program passes model, tokenizer, runtime, placement, resources, devices, and cache settings from stack configuration. It requires `HF_TOKEN`, captures it with Pulumi Stash, and injects it through a Kubernetes Secret.

[`src/components/llama-cpp.ts`](../../src/components/llama-cpp.ts) accepts model source, server settings, placement, resources, probes, and optional host-device mappings. Each mapping becomes a hostPath volume and matching container mount. The program requires and stashes `HF_TOKEN` only for Hugging Face repository or file sources.

Both components place Hugging Face cache variables on the configured persistent model-cache volume unless a stack overrides them. The standalone programs do not render HTTPRoute or Agent Gateway resources; client routing is configured separately in Agent Gateway.

## Registry

The Pantheon container-registry stack has tracked Zot configuration enabled with an S3 backend, pull-through synchronization, a LoadBalancer Service, and `cr.holdenitdown.net` DNS annotation. Source currently disables Zot UI and search, supplies a long startup probe, and asks the registry module to create a cert-manager Certificate. Those source facts do not resolve the approval and deployment gap recorded in [verification](verification.md).

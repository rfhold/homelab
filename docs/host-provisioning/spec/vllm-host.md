# vLLM Host Contract

This specification defines Vulkan's standalone Qwen3 embedding service. It does not change Flint, Athena's Kubernetes deployment, DNS, or gateway routes.

## Inventory

Vulkan's direct `vllm` host data MUST select these values:

| Setting | Value |
| --- | --- |
| Host | `vulkan.holdenitdown.net` |
| Model and served model name | `Qwen/Qwen3-Embedding-0.6B` |
| Systemd unit | `vllm-qwen3-embedding.service` |
| Docker container | `qwen3-embedding` |
| Image | `rocm/vllm-dev:rocm7.2.1_navi_ubuntu24.04_py3.12_pytorch_2.9_vllm_0.16.0@sha256:b5de46c4bee72a3a22937f74e4f138bc1cdcdc7c23fc8533fe8d6c9c0a955e6a` |
| Persistent model cache | `/var/lib/vllm/models/qwen3-embedding` |
| Port | `8001` |
| Cosmos labels | `cosmos` |
| Runner | `pooling` |
| Data type | `bfloat16` |
| Maximum model length | `32768` |
| Maximum batch tokens | `32768` |
| Maximum sequences | `4` |
| GPU memory utilization | `0.1` |
| Tensor parallel size | `1` |
| Eager execution | Enabled |
| Chunked prefill | Disabled |

The service MUST use ROCm for the `gfx1151` AMD iGPU, vendor `1002`, device `1586`. The hostname does not select the Vulkan API backend. The utilization fraction expresses a vLLM budget, not a host RAM limit or reservation.

## Managed Service

The deploy MUST skip hosts without complete `vllm` data. Docker, systemd, system Python, `/dev/kfd`, and AMD render-node access remain prerequisites. The deploy MUST install the shared GPU selector. It MUST NOT install packages, upgrade the OS, change drivers, or invoke another deploy.

The deploy MUST create a root-owned persistent cache and its separate systemd unit. It MUST NOT alter Flint's unit, container, cache, or port `8000`. It MUST preserve Athena's embedding service and all gateway configuration.

The unit MUST:

- Expose `COSMOS_LABELS=cosmos` for local systemd clients.
- Order startup after Docker and the online network.
- Remove only its own stale container before startup.
- Publish port `8001` on host interfaces.
- Pass `/dev/kfd` and only the selected iGPU render node without privileged mode.
- Resolve vendor/device identity through sysfs at service startup; never use fixed render numbers or PCI addresses.
- Fail closed if the required iGPU is absent or ambiguous; never select the dGPU.
- Use host IPC for the ROCm workload.
- Mount its cache at `/models` with persistent Hugging Face cache variables.
- Invoke `python3 -m vllm.entrypoints.openai.api_server` through an explicit Docker entry point.
- Supply the model, served name, and inference parameters from this contract.
- Probe loopback `/health` through Python's standard library.
- Use a one-hour health start period, 30-second interval, 10-second timeout, and five retries.
- Allow the initial image pull without a systemd startup timeout.
- Stop its own container with a 120-second grace period and a 150-second systemd stop timeout.
- Restart its own container after exit.

The deploy MUST reload systemd only after a unit change. Unit or selector changes MUST take one start-or-restart path. Unchanged state MUST only ensure that the service remains enabled and active. Deferred operation results MUST control both paths. The selector MUST use the same [identity and condition rules](llama-cpp-host.md#managed-service) as llama.cpp.

Command arguments MUST retain literal quotes, spaces, percent signs, and dollar signs after systemd parsing. The service MUST NOT require credentials for the public model. This contract adds no API authentication or TLS; network exposure requires an authorized reachability check.

## Verification Boundary

Repository source does not prove host state. Authorized checks must establish image startup, AMD device access, model download, memory fit, and API behavior. `/health`, `/v1/models`, and `/v1/embeddings` must identify a healthy service with the official model ID. A repeat apply must show idempotence. Coexistence checks must confirm Flint's health and acceptable shared memory use. No deployment or live evidence follows from this specification.

## References

- [Tracked host implementation](../implementation.md#vllm-host-service)
- [Deploy entry point](../../../deploys/vllm-deploy.py)
- [Local tests](../../../deploys/vllm/test_inventory.py)
- [AMD Ryzen vLLM image guidance](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/advanced/advancedryz/linux/llm/build-docker-image.html)
- [vLLM v0.16.0 scheduler constraints](https://github.com/vllm-project/vllm/blob/v0.16.0/vllm/config/scheduler.py)

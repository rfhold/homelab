# llama.cpp Host Contract

This specification defines Vulkan's standalone llama.cpp services. It does not define Kubernetes workloads, client privileges, DNS records, or network routes.

## Inventory

The `cosmos` inventory group MUST contain `vulkan.holdenitdown.net` without `k3s_cluster` data. Direct `llama_cpp` data selects Flint. The additive `llama_cpp_services` list selects optional services. Both forms use non-secret systemd, model, container, cache, and server settings. Unit names, container names, and ports MUST be unique across both forms.

The service MUST use these values:

| Setting | Value |
| --- | --- |
| llama.cpp alias | `flint` |
| Systemd unit | `llama-cpp-flint.service` |
| Docker container name | `flint` |
| Systemd description | `llama.cpp Flint inference service` |
| Image | `ghcr.io/ggml-org/llama.cpp:server-vulkan@sha256:a644fb651975d9dea49140302577a3b945993fd5efd3400bf89c7d525d03c103` |
| Model cache | `/var/lib/llama-cpp/models/flint` |
| Hugging Face repository | `unsloth/flint-GGUF` |
| Hugging Face file | `flint-Q8_0.gguf` |
| Context size | `262144` (model maximum) |
| Devices | `Vulkan0` (Radeon 8060S Graphics, integrated GPU only) |
| GPU layers | `auto` |
| Split mode | `none` |
| Tensor split | `1` |
| Automatic fitting | `on` |
| Per-device fit target margin | `2048` MiB |
| Parallel requests | `1` |
| Port | `8000` |
| Cosmos labels | `cosmos` |
| Required GPU identity | AMD vendor `1002`, device `1586` |

## Optional Qwen Service

The additional service MUST preserve the cluster model contract from [`Pulumi.qwen3.8-27b.yaml`](../../../programs/llama-cpp/Pulumi.qwen3.8-27b.yaml).

| Setting | Value |
| --- | --- |
| Unit / container | `llama-cpp-qwen3-5-9b.service` / `qwen3-5-9b` |
| Host port | `8002` |
| Alias | `qwen3.5-9b-hauhaucs-aggressive` |
| Repository | `HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive` |
| File | `Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf` |
| Image | Same digest-pinned Vulkan image as Flint |
| Cache | `/var/lib/llama-cpp/models/qwen3-5-9b` |
| Optional GPU identity | AMD vendor `1002`, device `744c` (RX 7900 XTX) |
| Context / slots | `262144` / `1` |
| GPU placement | `Vulkan0`, `999` layers, split mode `none`, tensor split `1` |
| Automatic fit | `off`; no reduced context or layer count |
| KV cache | `q8_0` for K and V |
| Jinja / reasoning | Enabled / `on` |
| Template / reasoning format | `{"enable_thinking":false}` / `deepseek` |
| Sampling | Temperature `0.6`, top-p `0.95`, top-k `20`, min-p `0`, presence penalty `0`, repeat penalty `1` |
| MTP / projector | No MTP arguments; default automatic projector discovery |
| Cosmos labels | `cosmos` |

GPU absence MUST skip this service without CPU or iGPU fallback. An ambiguous GPU identity MUST fail the service.

### Capacity Boundary

The RX 7900 XTX provides 24 GiB VRAM. Q8 weights for approximately nine billion parameters consume roughly 9 GiB before runtime allocations. The exact GGUF, projector, KV layout, and Vulkan workspace determine the final footprint.

For illustration, four KV heads with 256 dimensions need approximately 0.53125 GiB per full-attention layer at this context and q8_0. Eight such layers need approximately 4.25 GiB; 32 need approximately 17 GiB. Hybrid-attention architecture changes the layer count and adds other state. These estimates do not establish the selected GGUF's actual allocation.

A hybrid layout can fit within the nominal budget, but source alone does not prove maximum-context startup or inference. The service MUST retain the requested context, cache types, and full offload. An allocation failure MUST remain a visible startup failure, not trigger a smaller context or CPU fallback.

## Managed Service

The deploy MUST configure only hosts with complete singleton or list data. It MUST preserve singleton compatibility. On Debian or Ubuntu, it MUST install `docker.io` through APT with package index updates enabled. On Arch Linux or CachyOS Linux, it MUST install `docker` through Pacman with package index updates enabled. It MUST create each cache directory and unit. It MUST preserve the retired catalog-directory cleanup scope. It MUST install the shared Python GPU selector. System Python, systemd, AMD drivers, and device access remain prerequisites.

Each unit MUST expose comma-separated `COSMOS_LABELS`. It MUST remove only its named stale container before startup. It MUST mount its cache at `/models` and publish its configured port. It MUST pass `/dev/kfd` and only the selected render node, never the whole `/dev/dri` directory. Server arguments MUST preserve the tables above. List arguments MUST use comma-separated values.

The shared selector MUST resolve AMD vendor/device identity through `/sys/class/drm/renderD*/device` at each service start. Units MUST order startup after the boot udev queue settles. They MUST NOT rely on render numbers, PCI addresses, or host Vulkan ordinals. Exactly one match MUST identify the GPU. The container sees only that render node, which establishes its `Vulkan0` selection. `ExecCondition` MUST return `1` for an absent optional GPU and `255` for absent required or ambiguous identities. The start wrapper MUST recheck identity and directly execute Docker without a shell. Hotplug support is outside this contract.

Each health command MUST probe `http://127.0.0.1:<inventory port>/health`. Health checks MUST use a one-hour start period, 30-second interval, 10-second timeout, and five retries. Each unit MUST order startup after Docker and the online network. Each unit MUST restart after exit and stop its own container with a 120-second grace period.

The deploy MUST reload systemd only after a unit change. Unit or selector changes MUST take one deferred start-or-restart path per service. Unchanged state MUST ensure enablement and issue a start only when inactive. Systemd's successful condition skip MUST NOT cause a deploy failure. The deploy MUST NOT invoke the AMD GPU-device deploy.

## Verification Boundary

Tracked source establishes intended state only. Authorized checks must confirm both boot configurations: iGPU alone, then iGPU plus RX 7900 XTX. Checks must establish device isolation, optional skip behavior, image/model compatibility, maximum-context memory fit, layer placement, projector behavior, and inference. Docker health, API behavior, network reachability, DNS, and repeat-apply idempotence also require authorized validation. This contract asserts no deployment result.

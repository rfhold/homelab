# llama.cpp Host Contract

This specification defines the first standalone llama.cpp host service. It is not a Kubernetes workload contract and does not define a toolbar client, API, privilege policy, DNS record, or network route.

## Inventory

The `cosmos` inventory group MUST contain `vulkan.holdenitdown.net` without `k3s_cluster` data. Its direct `llama_cpp` host data MUST select one llama.cpp service with non-secret systemd, model, container, cache, and server settings. The host MAY also carry the optional non-secret `alloy` configuration used by the separate Alloy deploy.

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

## Managed Service

The llama.cpp deploy MUST be host-data-gated and configure the service described by complete direct `llama_cpp` host data. On Debian or Ubuntu, it MUST install `docker.io` through APT with package index updates enabled. On Arch Linux or CachyOS Linux, it MUST install `docker` through Pacman with package index updates enabled. It MUST create the persistent model-cache directory, remove the retired local catalog directory, render the generic systemd unit template, and enable and start it.

The unit MUST expose the inventory-defined comma-separated `COSMOS_LABELS` environment variable so local systemd clients can select services by exact label membership. It MUST remove a stale container with its configured name before starting one container. It MUST use the configured image, bind the persistent model cache at `/models`, publish the inventory-defined port, pass `/dev/kfd` and `/dev/dri`, and supply the configured Hugging Face repository, file, alias, context, device, GPU-layer, split-mode, tensor-split, fit, fit-target, and parallel-request arguments to llama.cpp. Device, tensor-split, and fit-target lists MUST be rendered as comma-separated arguments. The service MUST select only `Vulkan0` for the integrated GPU with split mode `none` and tensor split `1`. It MUST enable automatic GPU-layer fitting and reserve a 2048 MiB fit-target margin. It MUST override the image health check with one Docker health command that probes `http://127.0.0.1:<inventory port>/health`. The health check MUST use a one-hour start period, a 30-second interval, a 10-second timeout, and five retries so an initial model download and load can complete before failures affect container health. It MUST order itself after Docker and the online network, restart after failure, and stop the named container cleanly.

The deploy MUST reload systemd only when the rendered unit changes, then restart the service when that change requires it. It MUST not invoke or modify the separate AMD GPU-device deploy.

## Verification Boundary

Tracked inventory and PyInfra source establish intended state only. The single-GPU configuration and maximum `262144`-token context require an authorized host apply and check. Those checks must establish runtime memory fit, GPU-layer placement, model reload duration, and inference behavior. Runtime enumeration must confirm that `Vulkan0` identifies the integrated GPU. Docker installation, AMD Vulkan access, image availability, model download, API behavior, the Docker-reported result of the loopback health probe, client network reachability, and DNS behavior require authorized host and network validation. No such validation is established by this contract.

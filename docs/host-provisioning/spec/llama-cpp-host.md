# llama.cpp Host Contract

This specification defines the first standalone llama.cpp host service. It is not a Kubernetes workload contract and does not define a toolbar client, API, privilege policy, DNS record, or network route.

## Inventory

The `cosmos` inventory group MUST contain `vulkan.holdenitdown.net` without `k3s_cluster` data. Its direct `llama_cpp` host data MUST select one llama.cpp service with non-secret systemd, model, container, cache, and server settings. The host MAY also carry the optional non-secret `alloy` configuration used by the separate Alloy deploy.

The initial service MUST use these values:

| Setting | Value |
| --- | --- |
| llama.cpp alias | `qwen3.6-35b-a3b` |
| Systemd unit | `llama-cpp-qwen3.6-35b-a3b.service` |
| Docker container name | `qwen3.6-35b-a3b` |
| Systemd description | `llama.cpp Qwen3.6-35B-A3B inference service` |
| Image | `ghcr.io/ggml-org/llama.cpp:server-rocm` |
| Hugging Face repository | `HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive` |
| Hugging Face file | `Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive-Q8_K_P.gguf` |
| Context size | `65536` |
| Devices | `ROCm0,ROCm1` |
| GPU layers | `auto` |
| Split mode | `layer` |
| Tensor split | `5,6` |
| Automatic fitting | `on` |
| Per-device fit target margins | `2048,4096` MiB |
| Parallel requests | `1` |
| Port | `8000` |
| Cosmos labels | `cosmos` |

## Managed Service

The llama.cpp deploy MUST be host-data-gated and configure the service described by complete direct `llama_cpp` host data. On Debian or Ubuntu, it MUST install `docker.io` through APT with package index updates enabled. On Arch Linux or CachyOS Linux, it MUST install `docker` through Pacman with package index updates enabled. It MUST create the persistent model-cache directory, remove the retired local catalog directory, render the generic systemd unit template, and enable and start it.

The unit MUST expose the inventory-defined comma-separated `COSMOS_LABELS` environment variable so local systemd clients can select services by exact label membership. It MUST remove a stale container with its configured name before starting one container. It MUST use the configured image, bind the persistent model cache at `/models`, publish the inventory-defined port, pass `/dev/kfd` and `/dev/dri`, and supply the configured Hugging Face repository, file, alias, context, device, GPU-layer, split-mode, tensor-split, fit, fit-target, and parallel-request arguments to llama.cpp. Device, tensor-split, and fit-target lists MUST be rendered as comma-separated arguments. The service MUST select `ROCm0` and `ROCm1`, split by layer with an explicit `5,6` tensor ratio, enable automatic GPU-layer fitting, and reserve fit-target margins of 2048 MiB and 4096 MiB respectively. It MUST override the image health check with one Docker health command that probes `http://127.0.0.1:<inventory port>/health`. The health check MUST use a one-hour start period, a 30-second interval, a 10-second timeout, and five retries so an initial model download and load can complete before failures affect container health. It MUST order itself after Docker and the online network, restart after failure, and stop the named container cleanly.

The deploy MUST reload systemd only when the rendered unit changes, then restart the service when that change requires it. It MUST not invoke or modify the separate AMD GPU-device deploy.

## Verification Boundary

Tracked inventory and PyInfra source establish intended state only. The configured dual-GPU automatic fit and `65536`-token context require an authorized host apply and check to establish memory fit, layer placement, successful model reload duration, and inference behavior. Docker installation, AMD ROCm access, image availability, model download, API behavior, the Docker-reported result of the loopback health probe, client network reachability, and DNS behavior require authorized host and network validation. No such validation is established by this contract.

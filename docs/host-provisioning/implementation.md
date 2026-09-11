# Tracked Host Implementation

This page summarizes repository source. It does not assert that inventory has been applied or that a host is reachable.

## Pantheon Servers

[`../../inventory.py`](../../inventory.py) tracks Athena and Artemis as Pantheon K3s server entries using the Pantheon API endpoint. Athena carries the VLAN access label and `rholden.dev/gpu=cuda`; it has no configured taint or KVM host data. Artemis carries only the VLAN access label, has no taint or KVM host data, and supplies its canary shutdown timing.

The CUDA label is therefore the source-backed Athena contract; the earlier scheduling-neutral description was incorrect.

## NVIDIA Host Setup

[`../../deploys/nvidia-container-host.py`](../../deploys/nvidia-container-host.py) installs the tracked NVIDIA 580 server driver, DKMS, utility, container runtime, and container toolkit packages through APT. The deploy does not modify Kubernetes labels or taints.

## Kernel Arguments

[`../../deploys/facts/kernel_args.py`](../../deploys/facts/kernel_args.py) reads `GRUB_CMDLINE_LINUX_DEFAULT` from `/etc/default/grub` and returns an explicit unavailable result when that backend is absent.

[`../../deploys/operations/kernel_args.py`](../../deploys/operations/kernel_args.py) preserves unmanaged arguments, replaces stale managed values once, writes only when needed, keeps a backup when replacing the line, and invokes `update-grub` after a change. [`../../deploys/disable-nvme-pcie-power-control.py`](../../deploys/disable-nvme-pcie-power-control.py) manages `nvme_core.default_ps_max_latency_us=0` and `pcie_aspm=off` without rebooting.

## K3s Shutdown Timing

[`../../deploys/k3s/setup.py`](../../deploys/k3s/setup.py) reads optional `k3s_cluster.shutdown_timing` host data and renders kubelet shutdown periods plus the systemd stop timeout. Hosts that omit it retain the tracked defaults of `45s`, `30s`, and `90` respectively. The source contains no reboot operation.

## llama.cpp Host Service

[`../../inventory.py`](../../inventory.py) tracks Vulkan in the non-Kubernetes `cosmos` group. Its direct `llama_cpp` host data selects the Qwen3.6-35B-A3B GGUF model, the fixed ROCm llama.cpp image reference, the `qwen3.6-35b-a3b` alias, one parallel request, a `65536`-token context, and port `8000`. It selects `ROCm0` and `ROCm1`, requests layer splitting and automatic GPU-layer fitting, applies an explicit `5,6` tensor split, and assigns fit-target margins of 2048 MiB and 4096 MiB respectively. The tensor ratio targets approximately 45% of offloaded model data to `ROCm0` and 55% to `ROCm1`. The same data provides the `cosmos` systemd label and a root-owned persistent model-cache path. Vulkan is also listed in the separate Alloy inventory group with non-secret telemetry host data. Source does not establish runtime memory fit, resulting layer placement, or successful model reload and inference behavior.

[`../../deploys/llama-cpp-deploy.py`](../../deploys/llama-cpp-deploy.py) only configures hosts with complete `llama_cpp` data. [`../../deploys/llama_cpp/configure.py`](../../deploys/llama_cpp/configure.py) installs `docker.io` through APT on Debian and Ubuntu, or `docker` through Pacman on Arch Linux and CachyOS Linux. Both package paths enable package index updates. The deploy creates the model-cache directory, removes the retired catalog directory, renders the unit from inventory-owned settings, reloads systemd when the unit changes, and enables, starts, or restarts the unit as needed.

[`../../deploys/llama_cpp/templates/llama-cpp.service.j2`](../../deploys/llama_cpp/templates/llama-cpp.service.j2) starts one inventory-named Docker container with the model cache and AMD device mounts. It renders the inventory device, tensor-split, and fit-target lists as comma-separated llama.cpp arguments and passes the configured GPU-layer, split-mode, fit, context, and parallel-request values. It exposes inventory-owned `COSMOS_LABELS` in the systemd service environment for local systemd clients; source contains no catalog client, API, or privilege policy.

## Grafana Alloy Host Deploy

[`../../deploys/alloy/setup.py`](../../deploys/alloy/setup.py) branches on the immutable `LinuxName` fact. On Debian and Ubuntu, it manages Grafana's APT repository and installs `alloy`; on Arch Linux and CachyOS Linux, it updates Pacman package metadata and installs `grafana-alloy` without APT repository operations. Other Linux names are rejected. [`../../deploys/alloy/configure.py`](../../deploys/alloy/configure.py) uses the same fact to select Debian/Ubuntu's `alloy` binary, `alloy.service`, `/etc/systemd/system/alloy.service.d`, and `/etc/default/alloy`, or Arch/CachyOS's `/usr/bin/grafana-alloy`, `grafana-alloy.service`, `/etc/systemd/system/grafana-alloy.service.d`, and `/etc/default/grafana-alloy`. It retains `/etc/alloy/environment` as a separate systemd drop-in environment file, so its `CONFIG_FILE` setting remains available after the package reporting-default file is replaced with `CUSTOM_ARGS="--disable-reporting"`. The deploy reloads systemd after managed-file changes, enables and starts the selected service, and separately restarts it when those files change. This source behavior does not establish package availability, unit compatibility, service health, or telemetry delivery on a host.

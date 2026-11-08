# Tracked Host Implementation

This page summarizes repository source. It does not assert that inventory has been applied or that a host is reachable.

## Pantheon Servers

[`../../inventory.py`](../../inventory.py) tracks Athena and Artemis as Pantheon K3s server entries using the Pantheon API endpoint. Athena carries the VLAN access label and `rholden.dev/gpu=cuda`; it has no configured taint or KVM host data. Artemis carries only the VLAN access label, has no taint or KVM host data, and supplies its canary shutdown timing.

The CUDA label is therefore the source-backed Athena contract; the earlier scheduling-neutral description was incorrect.

## NVIDIA Host Setup

[`../../deploys/nvidia-container-host.py`](../../deploys/nvidia-container-host.py) installs the tracked NVIDIA 580 server driver, DKMS, utility, container runtime, and container toolkit packages through APT. The deploy does not modify Kubernetes labels or taints.

The full deploy first includes [`../../deploys/nvidia-unattended-upgrades.py`](../../deploys/nvidia-unattended-upgrades.py), which also serves as a standalone policy-only entry point. Both use [`../../deploys/files/52unattended-upgrades-nvidia`](../../deploys/files/52unattended-upgrades-nvidia) as the sole configuration source. The policy deploy writes `/etc/apt/apt.conf.d/52unattended-upgrades-nvidia` with `root:root` ownership and mode `0644`.

The fragment appends anchored NVIDIA package patterns to `Unattended-Upgrade::Package-Blacklist`; it contains no list-clear directive. It leaves other APT fragments, security origins, generic kernel updates, and unattended-upgrade service settings alone. The policy-only entry point performs no package operation, service restart, or reboot. Its [contract](spec/nvidia-updates.md) reserves NVIDIA upgrades and reboots for authorized maintenance.

## Kernel Arguments

[`../../deploys/facts/kernel_args.py`](../../deploys/facts/kernel_args.py) reads `GRUB_CMDLINE_LINUX_DEFAULT` from `/etc/default/grub` and returns an explicit unavailable result when that backend is absent.

[`../../deploys/operations/kernel_args.py`](../../deploys/operations/kernel_args.py) preserves unmanaged arguments, replaces stale managed values once, writes only when needed, keeps a backup when replacing the line, and invokes `update-grub` after a change. [`../../deploys/disable-nvme-pcie-power-control.py`](../../deploys/disable-nvme-pcie-power-control.py) manages `nvme_core.default_ps_max_latency_us=0` and `pcie_aspm=off` without rebooting.

## K3s Shutdown Timing

[`../../deploys/k3s/setup.py`](../../deploys/k3s/setup.py) reads optional `k3s_cluster.shutdown_timing` host data and renders kubelet shutdown periods plus the systemd stop timeout. Hosts that omit it retain the tracked defaults of `45s`, `30s`, and `90` respectively. The source contains no reboot operation.

## llama.cpp Host Service

[`../../inventory.py`](../../inventory.py) tracks Vulkan in the non-Kubernetes `cosmos` group. Its direct `llama_cpp` host data selects `unsloth/flint-GGUF` and `flint-Q8_0.gguf`, the digest-pinned Vulkan image, and the `flint` alias. It sets one parallel request, the model's maximum `262144`-token context, and port `8000`. It selects only `Vulkan0` for the integrated GPU, split mode `none`, tensor split `1`, automatic GPU-layer fitting, and a 2048 MiB fit-target margin. The same data provides the `cosmos` systemd label and a root-owned persistent model-cache path. Vulkan is also listed in the separate Alloy inventory group with non-secret telemetry host data. Source does not establish runtime memory fit, resulting layer placement, or successful model reload and inference behavior.

[`../../deploys/llama-cpp-deploy.py`](../../deploys/llama-cpp-deploy.py) accepts complete `llama_cpp` singleton data plus additive `llama_cpp_services` list entries. [`../../deploys/llama_cpp/configure.py`](../../deploys/llama_cpp/configure.py) preserves Docker package policy: APT `docker.io` on Debian/Ubuntu, Pacman `docker` on Arch/CachyOS. Both paths update package indexes. The deploy creates each cache and unit, installs the shared selector, and preserves the retired catalog-directory cleanup scope. Unit changes trigger daemon reload. Unit or selector changes trigger one deferred start-or-restart path per service.

[`../../deploys/llama_cpp/templates/llama-cpp.service.j2`](../../deploys/llama_cpp/templates/llama-cpp.service.j2) starts one named container per service. [`../../deploys/llama_cpp/render.py`](../../deploys/llama_cpp/render.py) preserves inventory server arguments and quotes systemd commands. The unit exposes `COSMOS_LABELS` for local clients. Each container receives `/dev/kfd` and only its selected render node.

The additional list entry selects `llama-cpp-qwen3-5-9b.service`, container `qwen3-5-9b`, and port `8002`. It copies the cluster's Qwen3.5-9B aggressive Q8_0 model contract and uses Flint's digest-pinned Vulkan image. It requests `262144` context, q8_0 KV, one slot, and full GPU offload. Automatic fit stays off, so insufficient capacity fails startup rather than reduce the contract. Default projector discovery remains enabled; no MTP argument exists. The [contract](spec/llama-cpp-host.md#optional-qwen-service) records exact parameters and the unverified 24 GiB capacity boundary.

## GPU Identity Selection

[`../../deploys/gpu_selection.py`](../../deploys/gpu_selection.py) resolves vendor/device identity through sysfs for every service start. Flint and vLLM require AMD `1002:1586`; Qwen optionally selects AMD `1002:744c`. The selector ignores render numbering, PCI addresses, and host Vulkan ordinals. Multiple matches or unreadable identities fail closed.

Both deploys install the helper at `/usr/local/libexec/homelab-gpu-selection.py`, with root ownership and mode `0644`. System Python invokes it after the boot udev queue settles. `ExecCondition` returns `1` for absent optional hardware, which lets systemd skip startup successfully. Missing required hardware or ambiguous identity returns `255`, which fails the unit. The start wrapper resolves identity again and uses `os.execv`, with no shell. It replaces only the exact `@GPU_RENDER@` argument. Each isolated Vulkan container selects its own `Vulkan0`. The implementation covers boot-time presence, not hotplug.

## vLLM Host Service

[`../../inventory.py`](../../inventory.py) gives Vulkan separate `vllm` data for `Qwen/Qwen3-Embedding-0.6B`, port `8001`, and a digest-pinned ROCm image. The service retains the official model ID as its served name. It selects BF16, the pooling runner, eager execution, four sequences, a `32768`-token context, and `gpu_memory_utilization=0.1`.

[`../../deploys/vllm-deploy.py`](../../deploys/vllm-deploy.py) skips hosts without complete `vllm` data. [`../../deploys/vllm/configure.py`](../../deploys/vllm/configure.py) creates the separate cache and unit and installs the shared selector. It performs no package or GPU-policy operations. Deferred results gate daemon reload and service restart. Unchanged state requires no restart; unit or selector changes take one start-or-restart path.

[`../../deploys/vllm/render.py`](../../deploys/vllm/render.py) quotes command arguments and escapes systemd specifiers and command environment expansion. [`../../deploys/vllm/templates/vllm.service.j2`](../../deploys/vllm/templates/vllm.service.j2) invokes the explicit Python API-server entry point, passes AMD devices, and uses host IPC. It preserves the model cache and probes loopback `/health` through Python's standard library. The unit allows a cold image pull without a startup timeout. Its container health probe allows one hour for model startup. It exposes `COSMOS_LABELS=cosmos`.

The batch-token limit equals the context limit, with chunked prefill off. [vLLM v0.16.0 scheduler validation](https://github.com/vllm-project/vllm/blob/v0.16.0/vllm/config/scheduler.py) rejects a smaller batch-token limit under that configuration. Local tests cover inventory values, command arguments, quoting, the host-data gate, deferred restart predicates, and Flint's unchanged configuration. These sources do not establish live GPU compatibility, memory fit, API behavior, or coexistence with Flint.

## Grafana Alloy Host Deploy

[`../../deploys/alloy/setup.py`](../../deploys/alloy/setup.py) branches on the immutable `LinuxName` fact. On Debian and Ubuntu, it manages Grafana's APT repository and installs `alloy`; on Arch Linux and CachyOS Linux, it updates Pacman package metadata and installs `grafana-alloy` without APT repository operations. Other Linux names are rejected. [`../../deploys/alloy/configure.py`](../../deploys/alloy/configure.py) uses the same fact to select Debian/Ubuntu's `alloy` binary, `alloy.service`, `/etc/systemd/system/alloy.service.d`, and `/etc/default/alloy`, or Arch/CachyOS's `/usr/bin/grafana-alloy`, `grafana-alloy.service`, `/etc/systemd/system/grafana-alloy.service.d`, and `/etc/default/grafana-alloy`. It retains `/etc/alloy/environment` as a separate systemd drop-in environment file, so its `CONFIG_FILE` setting remains available after the package reporting-default file is replaced with `CUSTOM_ARGS="--disable-reporting"`. The deploy reloads systemd after managed-file changes, enables and starts the selected service, and separately restarts it when those files change. This source behavior does not establish package availability, unit compatibility, service health, or telemetry delivery on a host.

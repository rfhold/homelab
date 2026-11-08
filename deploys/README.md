# Host Deploys

PyInfra owns host provisioning in this repository. These guides describe tracked source; they do not show that a deploy has run or that a host matches inventory.

| Document | Covers |
| --- | --- |
| [`../docs/host-provisioning/README.md`](../docs/host-provisioning/README.md) | Intended host contracts, tracked implementation, and verification gaps |
| [`alloy/README.md`](alloy/README.md) | Grafana Alloy system service and optional smartctl and ROCm Metrics Exporter integrations |
| [`../docs/host-provisioning/spec/llama-cpp-host.md`](../docs/host-provisioning/spec/llama-cpp-host.md) | llama.cpp host-service contract |
| [`../docs/host-provisioning/spec/vllm-host.md`](../docs/host-provisioning/spec/vllm-host.md) | Standalone ROCm vLLM embedding service contract |
| [`wyoming_satellite/README.md`](wyoming_satellite/README.md) | Wyoming Satellite source configuration and execution boundary |

## Entry Points

| Deploy | Tracked behavior |
| --- | --- |
| [`alloy-node-deploy.py`](alloy-node-deploy.py) | Installs and configures Alloy; optionally manages smartctl and ROCm Metrics Exporter integrations |
| [`k3s-node.py`](k3s-node.py) | Configures K3s prerequisites, service, kubelet settings, and registry mirrors |
| [`wyoming-satellite-deploy.py`](wyoming-satellite-deploy.py) | Configures a host only when `wyoming_satellite` data is present |
| [`llama-cpp-deploy.py`](llama-cpp-deploy.py) | Configures complete `llama_cpp` singleton and additive `llama_cpp_services` list entries |
| [`vllm-deploy.py`](vllm-deploy.py) | Configures a standalone service only with complete `vllm` data; requires Docker and AMD devices |
| [`cosmosctl-deploy.py`](cosmosctl-deploy.py) | Installs `cosmosctl` from its configured Git branch and enables its desktop user service when complete `cosmosctl` data is present |
| [`nvidia-container-host.py`](nvidia-container-host.py) | Applies the NVIDIA unattended-upgrade policy, then installs NVIDIA server driver and container toolkit packages through APT |
| [`nvidia-unattended-upgrades.py`](nvidia-unattended-upgrades.py) | Applies only the shared NVIDIA APT blacklist fragment; no package operations, service restarts, or reboot |
| [`ryzen-apu-host.py`](ryzen-apu-host.py) | Configures AMD KFD and DRM udev access |
| [`disable-nvme-pcie-power-control.py`](disable-nvme-pcie-power-control.py) | Manages the approved NVMe and PCIe GRUB arguments |
| [`dev-mode.py`](dev-mode.py) | Grants the tracked user passwordless sudo |
| [`prod-mode.py`](prod-mode.py) | Requires a password for the tracked user's sudo access |
| [`raspberry.py`](raspberry.py) | Adds Raspberry Pi cgroup boot arguments and locale packages |
| [`raspberry-nvme-boot.py`](raspberry-nvme-boot.py) | Destructively repartitions an NVMe device and can clone the boot media |
| [`raspberry-sd-boot.py`](raspberry-sd-boot.py) | Selects SD boot and can remove PCIe boot settings |
| [`install-zfs.py`](install-zfs.py) | Installs ZFS and NFS packages |
| [`zfs.py`](zfs.py) | Creates configured ZFS pools, datasets, and nested mount ordering |
| [`mount-disks.py`](mount-disks.py) | Adds configured UUID mounts to `fstab` and mounts them |
| [`mergerfs-deploy.py`](mergerfs-deploy.py) | Configures and mounts mergerfs pools |
| [`nfs-deploy.py`](nfs-deploy.py) | Renders enabled NFS exports from mergerfs host data |
| [`snapraid-deploy.py`](snapraid-deploy.py) | Configures SnapRAID and optional systemd timers |
| [`wipe-disk.py`](wipe-disk.py) | Destructively wipes a confirmed, non-protected block device |
| [`drive-debug.py`](drive-debug.py) | Installs tools and collects host-specific NVMe diagnostics |

## Execution Boundary

Install local dependencies with `uv sync`. A deploy command has this shape:

```bash
uv run pyinfra inventory.py --limit <authorized-host-or-group> deploys/<deploy>.py
```

That command can change remote hosts. It requires explicit authorization for the target and deploy. Inspect the selected script and its required host-data keys before execution; some entry points use defaults, while others stop when configuration is absent. Disk and boot-media deploys require separate review of their destructive behavior.

For an authorized NVIDIA policy-only apply, use this isolated entry point:

```bash
uv run pyinfra inventory.py --limit <authorized-nvidia-host> deploys/nvidia-unattended-upgrades.py
```

This command changes only the managed APT fragment. It does not repair a driver/library mismatch. The full NVIDIA deploy also installs server-driver packages; it is not a policy-only substitute. See the [NVIDIA update contract](../docs/host-provisioning/spec/nvidia-updates.md) for package scope and maintenance boundaries.

Do not print or copy complete inventory data into logs or documentation. Inventory can contain secret-bearing values; use [`util/secret.py`](util/secret.py) only where existing source requires encrypted host data.

The account configured for `cosmosctl` must already have read access to its private Git remote. This deploy does not create or manage Git credentials or SSH keys.

## Standalone vLLM

`vllm-deploy.py` manages Vulkan's separate Qwen3 embedding unit, container, and persistent model cache on port `8001`. It uses ROCm, not the Vulkan API. It preserves Flint, Athena, and all gateway routes. It performs no package, kernel, driver, or GPU-policy operation.

Both inference deploys install [`gpu_selection.py`](gpu_selection.py) as `/usr/local/libexec/homelab-gpu-selection.py`. The units use system Python for startup-time sysfs identity selection. Flint and embeddings select AMD `1002:1586`, independent of render numbers or PCI addresses. Each container receives `/dev/kfd` and only its selected render node.

The llama.cpp deploy also configures optional `llama-cpp-qwen3-5-9b.service` on port `8002`. It selects only AMD `1002:744c` (RX 7900 XTX). An absent dGPU produces a successful systemd condition skip, not CPU or iGPU fallback. Ambiguous identity fails closed. See the [model and capacity contract](../docs/host-provisioning/spec/llama-cpp-host.md#optional-qwen-service). No hotplug behavior exists.

Local tests require no inventory import or host access:

```bash
uv run python -m unittest deploys.test_gpu_selection deploys.vllm.test_inventory deploys.llama_cpp.test_inventory
```

After explicit authorization for Vulkan, use the isolated entry point:

```bash
uv run pyinfra inventory.py --limit vulkan.holdenitdown.net deploys/vllm-deploy.py --dry
uv run pyinfra inventory.py --limit vulkan.holdenitdown.net deploys/vllm-deploy.py
```

The first command still connects to Vulkan. The second changes host state. Neither command invokes the llama.cpp deploy. A cold start requires a large image pull and a public Hugging Face model download. Host checks must verify GPU memory use, `/health`, `/v1/models`, and `/v1/embeddings`. They must also confirm that Flint stays healthy.

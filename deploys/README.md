# Host Deploys

PyInfra owns host provisioning in this repository. These guides describe tracked source; they do not show that a deploy has run or that a host matches inventory.

| Document | Covers |
| --- | --- |
| [`../docs/host-provisioning/README.md`](../docs/host-provisioning/README.md) | Intended host contracts, tracked implementation, and verification gaps |
| [`alloy/README.md`](alloy/README.md) | Grafana Alloy system service and optional smartctl exporter |
| [`wyoming_satellite/README.md`](wyoming_satellite/README.md) | Wyoming Satellite source configuration and execution boundary |

## Entry Points

| Deploy | Tracked behavior |
| --- | --- |
| [`alloy-node-deploy.py`](alloy-node-deploy.py) | Installs and configures Alloy; optionally installs smartctl exporter |
| [`k3s-node.py`](k3s-node.py) | Configures K3s prerequisites, service, kubelet settings, and registry mirrors |
| [`wyoming-satellite-deploy.py`](wyoming-satellite-deploy.py) | Configures a host only when `wyoming_satellite` data is present |
| [`nvidia-container-host.py`](nvidia-container-host.py) | Installs NVIDIA server driver and container toolkit packages through APT |
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

Do not print or copy complete inventory data into logs or documentation. Inventory can contain secret-bearing values; use [`util/secret.py`](util/secret.py) only where existing source requires encrypted host data.

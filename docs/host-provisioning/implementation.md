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

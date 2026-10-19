# NVIDIA Updates

## Purpose

NVIDIA hosts exclude NVIDIA driver, library, firmware, and kernel-module packages from unattended upgrades. All other security updates retain their current policy.

## Unattended-Upgrade Policy

The repository MUST manage `/etc/apt/apt.conf.d/52unattended-upgrades-nvidia` with `root:root` ownership and mode `0644`.

The fragment MUST append anchored regular expressions to `Unattended-Upgrade::Package-Blacklist`. It MUST preserve other blacklist entries and APT configuration.

The exclusions cover these package families:

- `libnvidia-*` and `nvidia-*`, across driver versions and server variants.
- `linux-modules-nvidia-*`, `linux-objects-nvidia-*`, and `linux-signatures-nvidia-*`.
- `firmware-nvidia-*` and `linux-firmware-nvidia-*`.
- `xserver-xorg-video-nvidia` and its suffixed variants.
- `libcuda1`, `libnvcuvid1`, `libnvoptix1`, and their suffixed variants.

The policy MUST NOT exclude unrelated packages such as `openssl` or generic kernel packages such as `linux-image-generic`.

The policy MUST NOT add APT holds, change security origins, enable automatic reboots, or restart services.

## Entry Points and Maintenance

[`../../../deploys/nvidia-unattended-upgrades.py`](../../../deploys/nvidia-unattended-upgrades.py) MUST converge only the policy fragment. It MUST NOT install, upgrade, or remove packages.

[`../../../deploys/nvidia-container-host.py`](../../../deploys/nvidia-container-host.py) MUST reuse the same policy before its package operations. Its server-driver installation remains separate from the policy-only entry point.

NVIDIA package upgrades require scheduled, explicitly authorized maintenance with a reboot. The maintenance window must account for GPU consumers and storage health before any reboot.

The policy prevents future unattended NVIDIA updates; it does not repair a driver/library mismatch. It does not block explicit APT upgrades.

## Verification Boundary

Repository source establishes the declared policy, not host application or effective package selection. [Verification gaps](../verification.md) require separate authorized host evidence.

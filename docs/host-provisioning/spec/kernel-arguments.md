# Kernel Arguments

## Fact

- The host provisioning fact MUST parse kernel arguments from `GRUB_CMDLINE_LINUX_DEFAULT` in `/etc/default/grub`.
- When that path is unavailable, the fact MUST report the supported GRUB backend as unavailable rather than infer another bootloader.

## Operation

- The operation MUST add missing managed arguments and preserve unmanaged arguments.
- The operation MUST replace stale managed values and keep each managed argument only once.
- When the desired arguments already match, the operation MUST NOT rewrite the file or regenerate GRUB configuration.
- When a change is required, the operation MUST update the GRUB configuration and MUST NOT reboot the host.

## NVMe And PCIe Policy

The NVMe/PCIe power-control deploy MUST manage these values through the shared operation:

| Argument | Value |
| --- | --- |
| `nvme_core.default_ps_max_latency_us` | `0` |
| `pcie_aspm` | `off` |

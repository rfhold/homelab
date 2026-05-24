# Host Provisioning Delta Spec

Delta spec at `docs/specs/changes/add-kernel-args-operation/specs/host-provisioning/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

The NVMe PCIe power-control deploy needs to manage boot kernel arguments on Ubuntu 26 hosts without brittle string appends or direct assumptions about the current `GRUB_CMDLINE_LINUX_DEFAULT` contents. PyInfra does not provide a built-in operation for kernel command-line arguments, but the project can provide repo-local custom facts and operations for this host provisioning concern.

The desired API should be generic around kernel arguments while the first supported backend targets GRUB-based Ubuntu installs, which Athena and Artemis currently use.

### Impact
- **Breaking changes**: none
- **Migration**: operators should continue running `deploys/disable-nvme-pcie-power-control.py`; the deploy will use the new custom kernel-argument operation internally
- **Cross-change dependencies**: none

### Non-goals
- Supporting systemd-boot or non-GRUB bootloaders in the first implementation
- Changing the approved NVMe/PCIe kernel argument values
- Rebooting hosts after changing kernel arguments
- Creating a general upstream PyInfra operation outside this repository

### Rollback

Rollback consists of reverting the custom fact/operation and returning `deploys/disable-nvme-pcie-power-control.py` to its previous GRUB editing behavior. Hosts that have already had `/etc/default/grub` updated can be manually restored from backup or edited to remove the managed kernel arguments before running `update-grub`.

---

## ADDED Requirements

### Requirement: Kernel Argument Fact
The system MUST provide a custom host provisioning fact that reports kernel command-line arguments from the supported bootloader configuration.

#### Scenario: GRUB kernel arguments are discovered
Given a host has `/etc/default/grub` with `GRUB_CMDLINE_LINUX_DEFAULT` configured
When the kernel argument fact is loaded
Then the system MUST report the parsed kernel arguments from `GRUB_CMDLINE_LINUX_DEFAULT`

#### Scenario: Unsupported bootloader is explicit
Given a host does not have the supported GRUB configuration path
When the kernel argument fact is loaded
Then the system MUST report that kernel arguments are unavailable for the supported backend

### Requirement: Kernel Argument Operation
The system MUST provide a custom host provisioning operation that idempotently manages selected boot kernel arguments while preserving unmanaged arguments.

#### Scenario: Missing kernel arguments are added
Given a supported GRUB configuration lacks one or more managed kernel arguments
When the kernel argument operation applies the desired arguments
Then the system MUST add the missing managed arguments
And the system MUST preserve unrelated existing arguments

#### Scenario: Existing kernel argument values are corrected
Given a supported GRUB configuration contains a managed kernel argument with a stale value
When the kernel argument operation applies the desired arguments
Then the system MUST replace the stale value with the desired value
And the system MUST keep the managed argument present only once

#### Scenario: Bootloader configuration updates only when changed
Given a supported GRUB configuration already contains the desired managed kernel arguments
When the kernel argument operation applies the desired arguments
Then the system MUST NOT rewrite the bootloader configuration
And the system MUST NOT regenerate bootloader configuration files

### Requirement: NVMe PCIe Power Control Deploy Uses Kernel Argument Operation
The system MUST configure NVMe and PCIe power-control kernel arguments through the custom kernel argument operation.

#### Scenario: NVMe PCIe power-control deploy declares managed arguments
Given the NVMe PCIe power-control deploy is inspected
When the deploy configures boot kernel arguments
Then the system MUST manage `nvme_core.default_ps_max_latency_us=0` through the custom kernel argument operation
And the system MUST manage `pcie_aspm=off` through the custom kernel argument operation

#### Scenario: NVMe PCIe power-control deploy remains GRUB-backed
Given the NVMe PCIe power-control deploy runs on a GRUB-based Ubuntu host
When the custom kernel argument operation changes `/etc/default/grub`
Then the system MUST regenerate GRUB configuration files
And the system MUST NOT reboot the host automatically

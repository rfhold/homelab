# Host Provisioning Capability Spec

Stable spec at `docs/specs/host-provisioning/spec.md`. Source of truth. Edited only by the `code-review` skill during delta merge.

## Purpose

## Requirements

### Requirement: Pantheon Server Node Inventory
The system MUST define Athena and Artemis as Pantheon K3s server nodes in host provisioning inventory without custom GPU or KVM scheduling metadata.

#### Scenario: Athena and Artemis join Pantheon as servers
Given the host provisioning inventory is inspected
When the Pantheon host group is evaluated
Then the system MUST include `athena.holdenitdown.net` as a Pantheon `server` node
And the system MUST include `artemis.holdenitdown.net` as a Pantheon `server` node
And both nodes MUST use `pantheon.holdenitdown.net:6443` as their K3s API endpoint

#### Scenario: New Pantheon servers stay scheduling-neutral
Given Athena and Artemis are defined in the Pantheon host inventory
When their Kubernetes node labels and taints are evaluated
Then the system MUST set only the Pantheon VLAN access label required for VLAN 3 connectivity
And the system MUST NOT set GPU labels, GPU taints, or KVM labels for either node

### Requirement: Athena NVIDIA x86 Host Provisioning
The system MUST support installing NVIDIA server drivers and container toolkit packages on Athena as a regular x86 NVIDIA host without requiring Kubernetes GPU scheduling metadata.

#### Scenario: Athena receives NVIDIA host dependencies
Given Athena is selected for NVIDIA host provisioning
When the NVIDIA host provisioning deploy runs
Then the system MUST install NVIDIA server driver packages suitable for a regular x86 host
And the system MUST install the NVIDIA container runtime and container toolkit

#### Scenario: NVIDIA provisioning does not imply Kubernetes GPU scheduling
Given Athena has NVIDIA host drivers and container tooling installed
When the Pantheon K3s inventory for Athena is evaluated
Then the system MUST keep Athena as a plain Pantheon `server` node
And the system MUST NOT add GPU labels or GPU taints to Athena

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

### Requirement: Inventory-Driven K3s Shutdown Timing
The system MUST allow host inventory to define K3s graceful shutdown timing for each K3s node without changing the global default for nodes that omit the setting.

#### Scenario: Host declares custom shutdown timing
Given a K3s host inventory entry includes custom shutdown timing
When host provisioning renders the K3s kubelet configuration and systemd service
Then the system MUST render the host-specific kubelet `shutdownGracePeriod` value
And the system MUST render the host-specific kubelet `shutdownGracePeriodCriticalPods` value
And the system MUST render a K3s systemd stop timeout that is longer than the kubelet shutdown grace period

#### Scenario: Host omits custom shutdown timing
Given a K3s host inventory entry does not include custom shutdown timing
When host provisioning renders the K3s kubelet configuration and systemd service
Then the system MUST preserve the existing default kubelet shutdown timing
And the system MUST preserve the existing default K3s systemd stop timeout

### Requirement: Artemis K3s Shutdown Canary
The system MUST configure Artemis as the Pantheon canary for inventory-driven K3s shutdown timing while preserving its scheduling-neutral node role.

#### Scenario: Artemis declares canary shutdown timing
Given the Pantheon host inventory is inspected
When the Artemis K3s configuration is evaluated
Then the system MUST configure Artemis with kubelet `shutdownGracePeriod` equal to `5m`
And the system MUST configure Artemis with kubelet `shutdownGracePeriodCriticalPods` equal to `1m`
And the system MUST configure Artemis with a K3s systemd stop timeout equal to `6min`

#### Scenario: Artemis remains scheduling-neutral
Given the Artemis K3s configuration includes canary shutdown timing
When the Artemis node labels and taints are evaluated
Then the system MUST keep Artemis as a Pantheon `server` node
And the system MUST NOT add GPU labels, GPU taints, KVM labels, or storage scheduling labels to Artemis

#### Scenario: Provisioning does not reboot Artemis automatically
Given Artemis has canary shutdown timing configured in inventory
When host provisioning applies the K3s configuration
Then the system MUST NOT reboot Artemis automatically

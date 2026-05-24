# Host Provisioning Delta Spec

Delta spec at `docs/specs/changes/add-pantheon-server-nodes/specs/host-provisioning/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

Pantheon needs two additional K3s server nodes so the cluster can grow beyond its current single control-plane host. The new nodes are `athena.holdenitdown.net` and `artemis.holdenitdown.net`, and both are intended to join Pantheon through the existing Pantheon API endpoint and K3s token.

Athena also has an NVIDIA GPU, but it is not approved for Kubernetes GPU workload scheduling labels or taints as part of this change. The host provisioning path needs to install NVIDIA server drivers and the container toolkit on a regular x86 host without assuming the existing ARM NVIDIA use case.

### Impact
- **Breaking changes**: none
- **Migration**: operators will need to run the host provisioning flow for the new Pantheon nodes and apply the NVIDIA host provisioning flow to Athena
- **Cross-change dependencies**: none

### Non-goals
- Adding Kubernetes GPU labels or taints to Athena
- Changing GPU workload scheduling behavior
- Configuring ZFS or other host storage on the new nodes
- Configuring KVM support on the new nodes
- Creating DNS records or live-provisioning the hosts during spec writing

### Rollback

Rollback consists of removing the new hosts from the Pantheon inventory and reverting any NVIDIA host provisioning changes before re-running host provisioning. If Athena driver installation causes host issues, operators can omit the NVIDIA host provisioning deploy for Athena while keeping the plain K3s server inventory entries under a follow-up change.

---

## ADDED Requirements

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

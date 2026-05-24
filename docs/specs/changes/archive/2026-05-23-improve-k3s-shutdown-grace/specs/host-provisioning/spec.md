## Change Overview

### Why

Pantheon node reboots currently rely on a short, global K3s shutdown window that gives ordinary pods little time to terminate before critical pods and host shutdown proceed. Artemis is the lowest-risk Pantheon server for validating inventory-driven shutdown behavior before applying longer shutdown windows to GPU or storage-heavy nodes.

### Impact

Host provisioning will support per-host K3s shutdown timing for kubelet graceful node shutdown and the corresponding systemd K3s stop timeout. Artemis will declare the canary shutdown timing in inventory while remaining a scheduling-neutral Pantheon server node.

### Non-goals

- Automatically rebooting hosts during provisioning is out of scope.
- Applying the longer shutdown timing to every Pantheon node in the initial canary is out of scope.
- Automating Ceph OSD maintenance is out of scope for host provisioning.

### Rollback

Remove the Artemis shutdown timing values from inventory and re-run host provisioning to return Artemis to the default K3s shutdown behavior.

## ADDED Requirements

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

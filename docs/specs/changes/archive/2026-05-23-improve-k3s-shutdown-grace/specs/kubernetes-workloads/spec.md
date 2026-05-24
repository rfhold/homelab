## Change Overview

This delta shares the change overview in `docs/specs/changes/improve-k3s-shutdown-grace/specs/host-provisioning/spec.md`.

## ADDED Requirements

### Requirement: Generic Workload Label Passthrough
The system MUST expose generic workload label passthrough for Pulumi components, modules, and chart wrappers so stack configuration can provide operational labels without component-specific drain logic.

#### Scenario: Stack config provides workload labels
Given a stack configuration declares generic workload labels for a workload
When the workload's Pulumi component, module, or chart wrapper creates Kubernetes resources
Then the system MUST apply the configured labels to Kubernetes resource metadata where that resource supports labels
And the system MUST apply the configured labels to pod template metadata for controllers that create pods
And the system MUST NOT require component-specific code for each operational label key

#### Scenario: Workload labels are omitted
Given a stack configuration omits generic workload labels for a workload
When the workload's Pulumi component, module, or chart wrapper creates Kubernetes resources
Then the system MUST preserve existing resource labels
And the system MUST NOT invent an operational workload layer label

### Requirement: Standard Workload Identity Labels
The system MUST support Kubernetes recommended app labels alongside homelab operational labels for workloads managed by stack configuration.

#### Scenario: Workload identity labels are declared
Given a stack configuration declares Kubernetes recommended app labels for a workload
When the workload's Kubernetes resources are rendered
Then the system MUST allow `app.kubernetes.io/name` to identify the application name
And the system MUST allow `app.kubernetes.io/instance` to identify the deployed instance
And the system MUST allow `app.kubernetes.io/component` to identify the workload component
And the system MUST allow `app.kubernetes.io/part-of` to identify the larger system
And the system MUST allow `app.kubernetes.io/managed-by` to identify Pulumi management

#### Scenario: Operational layer label is declared
Given a stack configuration declares `rholden.dev/workload-layer` for a workload
When the workload's Kubernetes resources are rendered
Then the system MUST propagate `rholden.dev/workload-layer` through the generic workload label passthrough
And the system MUST NOT translate the value through component-specific layer mappings

### Requirement: Label-Driven Planned Reboot Selection
The system MUST provide planned reboot workflow support that selects application drain candidates by workload labels rather than by namespace or component-specific rules.

#### Scenario: Default planned reboot selects safe workload layers
Given a planned reboot workflow targets a Kubernetes node
When the workflow selects pods for the initial drain phase
Then the system MUST select pods by configured workload label selectors
And the system MUST exclude pods whose `rholden.dev/workload-layer` is `storage` unless storage handling is explicitly requested
And the system MUST exclude unlabeled pods from default drain selection

#### Scenario: Storage handling requires explicit selection
Given a planned reboot workflow targets a Kubernetes node with storage-layer pods
When storage handling is not explicitly requested
Then the system MUST NOT evict or delete pods labeled `rholden.dev/workload-layer=storage`

#### Scenario: Ceph checks gate storage handling
Given a planned reboot workflow explicitly requests storage handling for a node with Ceph OSD workloads
When the workflow evaluates whether the node can stop storage workloads
Then the system MUST check Ceph cluster health before rebooting the node
And the system MUST check Ceph `osd ok-to-stop` for OSDs on the target node before rebooting the node
And the system MUST NOT reboot the node when the Ceph checks fail

### Requirement: Workload Layer Stack Coverage
The system MUST allow every stack configuration that deploys workloads to declare workload layer labels for all components, deployments, charts, pods, and related workload resources managed by that stack.

#### Scenario: Stack-managed workload resources expose labels
Given a stack manages Kubernetes workload resources
When the stack configuration provides generic workload labels
Then the system MUST provide a regular passthrough path for those labels to components
And the system MUST provide a regular passthrough path for those labels to deployments, stateful workloads, daemon workloads, jobs, cron jobs, chart-managed pods, and pod templates where applicable

#### Scenario: Label passthrough avoids custom drain logic
Given a component receives generic workload labels from stack configuration
When a planned reboot workflow evaluates drain candidates
Then the system MUST rely on the labels present on pod templates or pods
And the system MUST NOT rely on component names, namespaces, or hardcoded workload lists as the primary drain policy

# Planned Node Reboots

## Purpose

This specification governs application-drain selection and storage safety gates for the planned node reboot helper. Host shutdown timing belongs to host-provisioning documentation.

## Requirements

### Requirement: Label-Selected Default Drain

The planned reboot workflow MUST select default drain candidates by workload label. It MUST exclude unlabeled pods and pods labeled `rholden.dev/workload-layer=storage` from the default application drain.

#### Scenario: Default drain runs

- Given an operator targets a Kubernetes node without requesting storage handling
- When the helper selects application pods
- Then it selects labeled non-storage workloads and does not select unlabeled or storage-layer pods

### Requirement: Explicit Storage Handling

The workflow MUST refuse a requested reboot when storage-layer pods remain unless the operator explicitly selects a supported storage mode.

#### Scenario: Storage pods remain

- Given storage-layer pods are present on the target node
- When the operator requests a reboot without storage mode
- Then the helper stops before rebooting the host

### Requirement: Ceph Safety Gates

Ceph storage mode MUST check cluster health and `ceph osd ok-to-stop` for OSDs on the target node before draining storage workloads or rebooting. A failed check MUST stop the workflow.

#### Scenario: Ceph reports an unsafe stop

- Given the target node hosts Ceph OSDs
- When cluster health or `osd ok-to-stop` fails
- Then the helper does not proceed to the reboot action

## References

- [`scripts/planned-node-reboot.sh`](../../../scripts/planned-node-reboot.sh)
- [`tests/test_workload_labels.py`](../../../tests/test_workload_labels.py)

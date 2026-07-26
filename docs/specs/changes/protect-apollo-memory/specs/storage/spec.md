# Storage Memory Protection Delta

## Change Overview

**Why**: Pantheon Ceph OSD memory has grown far beyond its configured target, including approximately 18 GiB on Apollo and 80 GiB on another storage node. Apollo exhausted physical memory and swap, leaving K3s unable to terminate workloads and taking a Ceph monitor out of quorum.

**Impact**: Pantheon OSDs receive explicit Kubernetes memory requests and limits and a matching Ceph memory target. The change extends the storage configuration surfaces in `programs/storage/index.ts`, `src/modules/storage.ts`, and `src/components/rook-ceph-cluster.ts`, and renders the controls through `programs/storage/Pulumi.pantheon.yaml`.

**Non-goals**: This change does not taint Apollo, change kubelet reservation or eviction settings, add CPU controls, resize application containers, alter non-OSD Ceph daemon resources, or apply the OSD settings to Romulus.

**Rollback**: Remove the Pantheon OSD resource configuration and restore the Ceph OSD memory target to 4 GiB after confirming the cluster has clean placement groups and all OSDs are available.

## ADDED Requirements

### Requirement: Pantheon OSD Memory Containment
The Pantheon storage configuration MUST assign every Ceph OSD an 8 GiB Kubernetes memory request, a 16 GiB Kubernetes memory limit, and an 8 GiB Ceph OSD memory target.

#### Scenario: OSD resources are rendered
Given the Pantheon storage stack configuration is evaluated
When the CephCluster resource is rendered
Then every OSD MUST request 8 GiB of memory
And every OSD MUST have a 16 GiB memory limit

#### Scenario: Ceph memory target matches the reservation
Given a Pantheon Ceph OSD starts from the managed storage configuration
When the OSD resolves its Ceph memory settings
Then its OSD memory target MUST be 8 GiB

#### Scenario: Other Ceph daemons remain unchanged
Given the Pantheon storage stack renders explicit OSD memory controls
When resources for monitors, managers, CSI components, and the Rook operator are evaluated
Then the system MUST NOT apply the OSD memory request or limit to those components

### Requirement: OSD Memory Control Rollout Safety
The Pantheon OSD memory controls MUST be introduced without making more than one OSD unavailable at a time or proceeding while Ceph data health is degraded.

#### Scenario: Existing OSD exceeds the new limit
Given an existing Pantheon OSD consumes more than 16 GiB before the memory controls are deployed
When the OSD is prepared for the new limit
Then the system MUST confirm all placement groups are active and clean
And the system MUST confirm Ceph reports that OSD as safe to stop
And the system MUST restart only that OSD
And the system MUST wait for the OSD and all placement groups to recover before preparing another OSD

#### Scenario: Persistent controls are deployed
Given every oversized OSD has been restarted safely
And all Pantheon OSDs are available
And all placement groups are active and clean
When the persistent OSD memory controls are deployed
Then the system MUST preserve the Rook-managed OSD disruption budget allowing at most one unavailable OSD

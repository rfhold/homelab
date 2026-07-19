## Change Overview

Why: Pantheon allowed multiple Ceph monitors and managers to run on the same node, which let all monitors land on Apollo and made storage unavailable when Apollo failed.

Impact: The Pantheon storage stack configuration MUST require Rook to spread Ceph monitor and manager daemons across nodes when enough schedulable nodes exist. No API schemas, database schemas, generated code, or external contracts are changed.

Non-goals: This change does not alter OSD device discovery, storage pool replication, CephFS MDS placement, RGW placement, CSI placement, or any storage class behavior.

Rollback: Re-enable multiple monitors and managers per node in the Pantheon storage stack configuration if Rook cannot maintain quorum with separated daemon placement.

## ADDED Requirements

### Requirement: Pantheon Ceph Control Daemon Separation
The Pantheon storage configuration MUST prevent Rook from intentionally placing multiple Ceph monitor or manager daemons on the same node when enough schedulable nodes are available.

#### Scenario: Monitor placement after reconciliation
Given the Pantheon Ceph cluster has three monitor daemons configured
And at least three schedulable storage nodes are available
When Rook reconciles the Ceph cluster
Then the configuration MUST require monitors to be eligible for placement on separate nodes
And the configuration MUST NOT allow multiple monitors per node

#### Scenario: Manager placement after reconciliation
Given the Pantheon Ceph cluster has two manager daemons configured
And at least two schedulable storage nodes are available
When Rook reconciles the Ceph cluster
Then the configuration MUST require managers to be eligible for placement on separate nodes
And the configuration MUST NOT allow multiple managers per node

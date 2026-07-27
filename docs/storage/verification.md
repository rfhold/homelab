# Storage Verification

Tracked configuration and historical evidence do not establish current Ceph state.

| Unverified state | Repository or historical evidence | Evidence needed |
| --- | --- | --- |
| The target stack renders only the intended OSD controls | [`../../programs/storage/Pulumi.pantheon.yaml`](../../programs/storage/Pulumi.pantheon.yaml) contains the desired values | Authorized Pulumi preview for the explicit stack |
| Every live OSD has the request, limit, and Ceph target | The component rendering path supports all three fields | Authorized CephCluster, deployment, and Ceph configuration inspection |
| Monitor and manager daemons are separated | Stack configuration disables co-location | Authorized pod placement and Ceph quorum inspection |
| All OSDs are available and all placement groups are active and clean | [`history/2026-07-26-apollo-memory-incident.md`](history/2026-07-26-apollo-memory-incident.md) records only a point-in-time outcome | Authorized current Ceph health inspection |
| Rook currently enforces the one-unavailable disruption budget | [`../../src/components/rook-ceph-cluster.ts`](../../src/components/rook-ceph-cluster.ts) renders `managePodBudgets: true` | Authorized live disruption-budget inspection |

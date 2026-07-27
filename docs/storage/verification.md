# Storage Verification

Tracked configuration and dated live evidence establish only the states recorded below.

| Open verification | Repository or live evidence | Evidence needed |
| --- | --- | --- |
| The target stack renders only the intended OSD controls | [`../../programs/storage/Pulumi.pantheon.yaml`](../../programs/storage/Pulumi.pantheon.yaml) contains the desired values | Authorized Pulumi preview for the explicit stack |
| Every live OSD has the request, limit, and Ceph target | The component rendering path supports all three fields | Authorized CephCluster, deployment, and Ceph configuration inspection |
| Monitor and manager daemons are separated | Stack configuration disables co-location | Authorized pod placement and Ceph quorum inspection |
| All OSDs are available and all placement groups are active and clean | [`history/2026-07-26-apollo-memory-incident.md`](history/2026-07-26-apollo-memory-incident.md) records only a point-in-time outcome | Authorized current Ceph health inspection |
| Rook currently enforces the one-unavailable disruption budget | [`../../src/components/rook-ceph-cluster.ts`](../../src/components/rook-ceph-cluster.ts) renders `managePodBudgets: true` | Authorized live disruption-budget inspection |
| The `database` class supports expansion and cleanup | Live Kafka RBD claims prove binding and active workload use, but no expansion or bounded cleanup was performed | Expand and remove a bounded claim only under separate explicit mutation approval |

## 2026-07-27 Live Evidence

A bounded Pantheon inspection found all placement groups active and clean, while Ceph reported `HEALTH_WARN` for BlueStore slow-operation indications on OSD 0 and OSD 2. Instantaneous OSD commit and apply latency was 3-8 ms. Kafka controller stalls overlapped this warning, but the inspection did not prove a single underlying device or network cause.

An authorized storage apply created the `database` pool with three safe replicas across the host failure domain on NVMe and created the RBD CSI StorageClass with `ext4`, image format 2, layering, expansion, `Delete`, and `WaitForFirstConsumer`. Three `100Gi` Kafka claims bound to the class and supported the post-migration brokers. This proves current provisioning and workload use, not expansion behavior or sustained Ceph health.

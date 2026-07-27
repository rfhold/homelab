# Tracked Storage Implementation

This page describes tracked Pulumi configuration and rendering. It does not prove that a stack has been applied.

## Pantheon Configuration

[`../../programs/storage/Pulumi.pantheon.yaml`](../../programs/storage/Pulumi.pantheon.yaml) configures three monitors and two managers, disables intentional monitor and manager co-location, and uses hostname as the monitor failure domain.

The same stack configuration applies only these OSD controls:

| Control | Tracked value |
| --- | --- |
| Kubernetes memory request | `8Gi` |
| Kubernetes memory limit | `16Gi` |
| Ceph `osd_memory_target` | `8589934592` bytes (8 GiB) |

It also supplies an OSD and prepare-OSD toleration for the existing GPU inference taint so Rook can reconcile a configured OSD on a tainted storage node. The Romulus stack does not declare these OSD resource, target, or placement values.

## Rendering Path

[`../../programs/storage/index.ts`](../../programs/storage/index.ts) reads the stack values and passes them through [`../../src/modules/storage.ts`](../../src/modules/storage.ts). [`../../src/components/rook-ceph-cluster.ts`](../../src/components/rook-ceph-cluster.ts) renders them as `CephCluster.spec.resources`, `CephCluster.spec.cephConfig`, and OSD placement tolerations.

The component keeps Rook-managed disruption budgets enabled. No OSD memory request or limit is assigned to monitors, managers, CSI components, or the Rook operator by the Pantheon stack configuration.

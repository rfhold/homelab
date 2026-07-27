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

## Dashboard Monitoring

Both storage stacks configure the Ceph dashboard Prometheus API host as `https://prometheus.holdenitdown.net/prometheus` through `CephCluster.spec.dashboard.prometheusEndpoint`. The endpoint is the shared Pantheon Mimir gateway, so dashboard Prometheus rules can include data from both clusters. The `cluster` and `k8s_cluster_name` metric labels distinguish Romulus and Pantheon series. Alertmanager-backed views require a separate Alertmanager API host and are not configured by this endpoint.

Rook monitoring enables the Ceph manager Prometheus exporter and creates the manager `ServiceMonitor`. The Grafana monitoring stacks discover that monitor and remote-write its Prometheus exposition data through Alloy to Mimir.

## Block Storage

The Pantheon stack also declares a `database` Ceph block pool and StorageClass. The pool uses three replicas across the `host` failure domain and selects the `nvme` device class.

[`../../src/modules/storage.ts`](../../src/modules/storage.ts) creates the pool through [`../../src/components/ceph-block-pool.ts`](../../src/components/ceph-block-pool.ts), then creates the RBD StorageClass with image format 2, `layering`, `ext4`, expansion, the `Delete` reclaim policy, and `WaitForFirstConsumer` binding. [`../../programs/storage/index.ts`](../../programs/storage/index.ts) exports both block-pool and StorageClass names.

The Grafana program names `database` as an environment-specific Kafka input. There is no Pulumi stack reference from Grafana to storage, so source establishes the required name but does not enforce reconciliation order or prove the pool is live.

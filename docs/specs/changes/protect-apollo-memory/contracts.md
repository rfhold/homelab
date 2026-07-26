# Contract Changes

## Status

Proposed contract boundary for Pantheon Ceph daemon resources, Ceph configuration, and OSD placement.

## TypeScript Configuration Interfaces

### `src/components/rook-ceph-cluster.ts`

Extend `RookCephClusterArgs` with these optional properties:

```typescript
resources?: pulumi.Input<Record<string, k8s.types.input.core.v1.ResourceRequirements>>;
cephConfig?: pulumi.Input<Record<string, Record<string, string>>>;
osdTolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
```

These properties correspond exactly to `CephCluster.spec.resources`, `CephCluster.spec.cephConfig`, and `CephCluster.spec.placement.osd.tolerations` in the installed `ceph.rook.io/v1` CRD.

### `src/modules/storage.ts`

Extend `StorageModuleArgs.cephCluster` with these optional properties:

```typescript
resources?: pulumi.Input<Record<string, k8s.types.input.core.v1.ResourceRequirements>>;
cephConfig?: pulumi.Input<Record<string, Record<string, string>>>;
osdTolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
```

### `programs/storage/index.ts`

Extend `CephClusterConfig` with these optional properties:

```typescript
resources?: Record<string, k8s.types.input.core.v1.ResourceRequirements>;
cephConfig?: Record<string, Record<string, string>>;
osdTolerations?: k8s.types.input.core.v1.Toleration[];
```

## Pantheon Stack Configuration Shape

`programs/storage/Pulumi.pantheon.yaml` will use the approved interface with these exact values under `storage:ceph-cluster`:

```yaml
resources:
  osd:
    requests:
      memory: "8Gi"
    limits:
      memory: "16Gi"
cephConfig:
  global:
    osd_memory_target: "8589934592"
osdTolerations:
  - key: "workload-type"
    operator: "Equal"
    value: "gpu-inference"
    effect: "NoSchedule"
```

No CPU resources or resource entries for `mon`, `mgr`, CSI components, or the Rook operator are added. The toleration applies only to OSD placement and matches Mars's existing GPU taint exactly.

## Compatibility

All new interface properties are optional. Existing Romulus configuration remains valid and unchanged when the properties are absent.

## Generated Artifacts

None.

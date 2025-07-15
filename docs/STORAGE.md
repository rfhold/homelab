# Storage Module

The storage module provides a comprehensive storage and backup solution for Kubernetes clusters, combining CephFS shared filesystem storage, backup management, and disaster recovery capabilities in a unified package.

## Purpose

The storage module orchestrates the complete storage lifecycle from provisioning shared filesystems to automated backups and disaster recovery, ensuring data persistence and protection across the cluster infrastructure with a focus on CephFS distributed storage.

## Core Components

### Storage Provider
- **Rook Ceph**: Cloud-native storage operator providing distributed CephFS storage
- **CephFS Filesystems**: Shared filesystem storage with configurable metadata and data pools
- **Storage Classes**: Kubernetes storage classes automatically created for each configured filesystem
- **Volume Snapshots**: CSI snapshot support for point-in-time volume backups

### Backup Management
- **Velero**: Kubernetes-native backup and disaster recovery solution
- **Dual Backup Strategies**: Support for both snapshot-based and filesystem-based backups
- **Storage Locations**: Multiple backup storage backends (S3, Azure, GCP, etc.)
- **Backup Scheduling**: Automated backup schedules with configurable retention

### Snapshot Infrastructure
- **External Snapshotter**: Volume snapshot controller for K3s clusters
- **CSI Drivers**: Container Storage Interface drivers for snapshot operations
- **Volume Snapshot Locations**: Configurable snapshot storage backends

## Architecture Overview

### Storage Layer
```
┌─────────────────────────────────────────────────────────────────┐
│                        Storage Module                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Rook Ceph     │  │     Velero      │  │   External      │  │
│  │   Operator      │  │    Backup       │  │  Snapshotter    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   CephFS        │  │   Backup        │  │   Volume        │  │
│  │  Filesystems    │  │   Locations     │  │   Snapshots     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Deployment Flow
The module follows a specific deployment sequence:
1. **External Snapshotter**: Install CSI snapshot infrastructure in kube-system
2. **Rook Ceph Operator**: Deploy the Ceph operator in the storage namespace
3. **Ceph Cluster**: Create the Ceph storage cluster with configured nodes and devices
4. **CephFS Filesystems**: Create filesystems with custom metadata and data pool configurations
5. **Storage Classes**: Generate Kubernetes StorageClass resources for each filesystem
6. **Backup Infrastructure**: Deploy Velero with configured backup and snapshot locations

### Backup Strategies

#### Snapshot-Based Backups
- **CSI Snapshots**: Leverages Kubernetes CSI snapshot functionality
- **Storage-Level**: Efficient, storage-native snapshots via Ceph
- **Fast Recovery**: Quick restore from storage-level snapshots
- **Space Efficient**: Copy-on-write snapshots minimize storage overhead

#### Filesystem-Based Backups
- **Node Agent**: Velero node-agent (using Kopia) for file-level backups
- **Application Consistent**: Handles databases and stateful applications
- **Cross-Platform**: Works with any storage backend
- **Granular Recovery**: File-level restore capabilities

## Configuration Options

### Storage Implementation
```typescript
enum StorageImplementation {
  ROOK_CEPH = "rook-ceph",
}

enum BackupImplementation {
  VELERO = "velero",
}
```

### Storage Class Configuration
```typescript
interface StorageClassConfig {
  /** Name of the storage class */
  name: pulumi.Input<string>;
  /** Whether this is the default storage class */
  isDefault?: pulumi.Input<boolean>;
  /** Reclaim policy (Delete, Retain) */
  reclaimPolicy?: pulumi.Input<string>;
  /** Volume binding mode (Immediate, WaitForFirstConsumer) */
  volumeBindingMode?: pulumi.Input<string>;
  /** Allow volume expansion */
  allowVolumeExpansion?: pulumi.Input<boolean>;
  /** Filesystem configuration */
  filesystem: {
    /** Metadata pool configuration */
    metadataPool: MetadataPoolConfig;
    /** Data pools configuration */
    dataPools: DataPoolConfig[];
    /** Metadata server configuration */
    metadataServer: MetadataServerConfig;
  };
}
```

### Backup Strategy Configuration
```typescript
interface BackupStrategy {
  /** Enable CSI snapshot-based backups */
  enableSnapshotBackups: pulumi.Input<boolean>;
  /** Enable filesystem-based backups using node-agent */
  enableFilesystemBackups: pulumi.Input<boolean>;
  /** Default backup TTL */
  defaultBackupTTL?: pulumi.Input<string>;
  /** Backup storage locations */
  backupStorageLocations: BackupStorageLocation[];
  /** Volume snapshot locations */
  volumeSnapshotLocations?: VolumeSnapshotLocation[];
}
```

### Ceph Cluster Configuration
```typescript
interface CephClusterConfig {
  /** Name of the Ceph cluster */
  clusterName?: pulumi.Input<string>;
  /** Ceph container image */
  cephImage?: pulumi.Input<string>;
  /** Host path for cluster data */
  dataDirHostPath?: pulumi.Input<string>;
  /** Storage configuration */
  storage: StorageConfig;
  /** Monitor count */
  monitorCount?: pulumi.Input<number>;
}
```

## Usage

The storage module is deployed as a single stack with detailed CephFS configuration:

```typescript
import { StorageModule, StorageImplementation, BackupImplementation } from "../modules/storage";

const storage = new StorageModule("cluster-storage", {
  namespace: "storage-system",
  storageImplementation: StorageImplementation.ROOK_CEPH,
  backupImplementation: BackupImplementation.VELERO,
  cephCluster: {
    clusterName: "my-cluster",
    storage: {
      useAllNodes: false,
      nodes: [
        {
          name: "worker-1",
          devices: [{ name: "/dev/nvme0n1" }, { name: "/dev/nvme1n1" }]
        },
        {
          name: "worker-2",
          devices: [{ name: "/dev/sdb" }, { name: "/dev/sdc" }]
        }
      ]
    },
  },
  storageClasses: [
    {
      name: "shared-fs",
      isDefault: true,
      filesystem: {
        metadataPool: {
          name: "shared-fs-metadata",
          replication: { size: 3 },
          deviceClass: "nvme",
        },
        dataPools: [{
          name: "shared-fs-data",
          failureDomain: "host",
          replication: { size: 3 },
          deviceClass: "hdd",
        }],
        metadataServer: {
          activeCount: 1,
          activeStandby: true,
        },
      },
    },
  ],
  backupStrategy: {
    enableSnapshotBackups: true,
    enableFilesystemBackups: true,
    backupStorageLocations: [{
      name: "default",
      provider: "aws",
      bucket: "my-backup-bucket",
      default: true,
    }],
  },
});
```

## What Belongs Here

### Core Storage Functionality
- CephFS shared filesystem provisioning and management
- Storage class configuration for different use cases
- Volume snapshot creation and management
- Storage pool configuration and monitoring

### Backup and Recovery
- Automated backup scheduling and execution
- Multiple backup strategy support (snapshot + filesystem)
- Backup storage location management
- Disaster recovery procedures and testing

### Data Protection
- Encryption at rest and in transit
- Access control and security policies
- Backup verification and integrity checking
- Cross-region backup replication

### Storage Operations
- Volume expansion and migration
- Performance monitoring and optimization
- Capacity planning and alerting
- Storage health monitoring

## Implementation Details

### CephFS Filesystems
The module creates CephFS filesystems with configurable:
- **Metadata Pools**: High-performance pools for filesystem metadata (typically on NVMe)
- **Data Pools**: Configurable pools for actual data with different performance characteristics
- **Metadata Servers**: Active/standby MDS configuration for high availability
- **Replication**: Configurable replica counts and failure domains

### Storage Classes
Each configured filesystem automatically generates a Kubernetes StorageClass with:
- **ReadWriteMany (RWX)**: Shared access across multiple pods
- **CSI Provisioner**: Rook CephFS CSI driver integration
- **Volume Expansion**: Support for expanding volumes
- **Custom Parameters**: Pool and cluster-specific configurations

### Backup Workflows

#### Snapshot Backup Flow
1. CSI driver creates storage-level snapshot
2. Velero captures snapshot metadata
3. Snapshot data uploaded to backup storage
4. Cleanup of local snapshots based on retention policy

#### Filesystem Backup Flow
1. Node-agent discovers volumes to backup
2. Kopia creates incremental filesystem backup
3. Backup data uploaded to backup storage
4. Metadata stored in Velero for restore operations

### Recovery Procedures
- **Volume Restore**: Restore individual volumes from snapshots
- **Namespace Restore**: Restore entire namespaces with applications
- **Selective Restore**: Restore specific resources or data
- **Cross-Cluster Migration**: Migrate workloads between clusters

## Security Considerations

### Access Control
- RBAC policies for storage operations
- Backup access restrictions
- Encryption key management
- Audit logging for storage operations

### Data Protection
- Encryption at rest using Ceph native encryption
- Backup encryption using Velero encryption
- Network encryption for data in transit
- Secure credential management

## Monitoring and Alerting

### Storage Metrics
- Ceph cluster health and performance
- Volume usage and capacity planning
- Backup success rates and duration
- Snapshot creation and retention

### Alerting Rules
- Storage capacity warnings
- Backup failure notifications
- Ceph cluster health alerts
- Volume performance degradation

## Troubleshooting

### Common Issues
- **Backup Failures**: Check storage location connectivity and credentials
- **Snapshot Issues**: Verify CSI driver installation and configuration
- **Ceph Health**: Monitor OSD status and cluster connectivity
- **Performance**: Analyze storage I/O patterns and resource allocation

### Diagnostic Tools
- Velero backup logs and status
- Ceph cluster status and health checks
- Volume snapshot status and logs
- Storage class configuration validation 
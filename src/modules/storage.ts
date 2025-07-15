import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ExternalSnapshotter } from "../components/external-snapshotter";
import { RookCeph } from "../components/rook-ceph";
import { RookCephCluster, StorageConfig } from "../components/rook-ceph-cluster";
import { CephFilesystem, MetadataServerConfig, MetadataPoolConfig, DataPoolConfig } from "../components/ceph-filesystem";
import { Velero, BackupStorageLocation, VolumeSnapshotLocation } from "../components/velero";

/**
 * Available storage implementations
 */
export enum StorageImplementation {
  ROOK_CEPH = "rook-ceph",
}

/**
 * Available backup implementations
 */
export enum BackupImplementation {
  VELERO = "velero",
}

/**
 * Storage class types supported by the module
 */
export enum StorageClassType {
  /** Block storage (RWO) using Ceph RBD */
  BLOCK = "block",
  /** Shared filesystem (RWX) using CephFS */
  FILESYSTEM = "filesystem",
}

/**
 * Storage class configuration with filesystem-specific options
 */
export interface StorageClassConfig {
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

/**
 * Backup strategy configuration
 */
export interface BackupStrategy {
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

/**
 * Configuration for the Storage module
 */
export interface StorageModuleArgs {
  /** Kubernetes namespace to deploy storage components */
  namespace: pulumi.Input<string>;
  
  /** Storage implementation to use */
  storageImplementation: StorageImplementation;
  
  /** Backup implementation to use */
  backupImplementation: BackupImplementation;
  
  /** Ceph cluster configuration */
  cephCluster: {
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
  };
  
  /** Storage class configurations */
  storageClasses: StorageClassConfig[];
  
  /** Backup strategy configuration */
  backupStrategy?: BackupStrategy;
  
  /** External snapshotter configuration */
  externalSnapshotter?: {
    /** Version of external-snapshotter */
    version?: pulumi.Input<string>;
  };
}

/**
 * Storage module - provides comprehensive storage and backup solution
 * 
 * This module orchestrates the complete storage lifecycle from provisioning persistent volumes
 * to automated backups and disaster recovery. It follows the deployment flow:
 * 1. Install external snapshotter
 * 2. Create the Ceph cluster 
 * 3. Create filesystems directly from storage class configuration
 * 4. Create Kubernetes StorageClass resources
 * 5. Set up backup and snapshot infrastructure
 * 
 * The module provides a high-level abstraction where you define storage classes with their
 * filesystem characteristics, and the underlying Ceph filesystems and Kubernetes StorageClass
 * resources are created automatically.
 * 
 * @example
 * ```typescript
 * import { StorageModule, StorageImplementation, BackupImplementation } from "../modules/storage";
 * 
 * const storage = new StorageModule("cluster-storage", {
 *   namespace: "storage-system",
 *   storageImplementation: StorageImplementation.ROOK_CEPH,
 *   backupImplementation: BackupImplementation.VELERO,
 *   cephCluster: {
 *     clusterName: "my-cluster",
 *     storage: {
 *       useAllNodes: false,
 *       nodes: [
 *         {
 *           name: "worker-1",
 *           devices: [{ name: "/dev/nvme0n1" }, { name: "/dev/nvme1n1" }]
 *         },
 *         {
 *           name: "worker-2",
 *           devices: [{ name: "/dev/sdb" }, { name: "/dev/sdc" }]
 *         }
 *       ]
 *     },
 *   },
 *   storageClasses: [
 *     {
 *       name: "shared-fs",
 *       filesystem: {
 *         metadataPool: {
 *           name: "shared-fs-metadata",
 *           replication: { size: 3 },
 *           deviceClass: "nvme",
 *         },
 *         dataPools: [{
 *           name: "shared-fs-data",
 *           failureDomain: "host",
 *           replication: { size: 3 },
 *           deviceClass: "hdd",
 *         }],
 *         metadataServer: {
 *           activeCount: 1,
 *           activeStandby: true,
 *         },
 *       },
 *     },
 *   ],
 *   backupStrategy: {
 *     enableSnapshotBackups: true,
 *     enableFilesystemBackups: true,
 *     backupStorageLocations: [{
 *       name: "default",
 *       provider: "aws",
 *       bucket: "my-backup-bucket",
 *       default: true,
 *     }],
 *   },
 * });
 * ```
 */
export class StorageModule extends pulumi.ComponentResource {
  /** External snapshotter instance */
  public readonly externalSnapshotter: ExternalSnapshotter;
  /** Rook Ceph operator instance */
  public readonly rookCeph: RookCeph;
  /** Rook Ceph cluster instance */
  public readonly cephCluster: RookCephCluster;
  /** Filesystem instances */
  public readonly filesystems: CephFilesystem[];
  /** Storage class instances */
  public readonly storageClasses: k8s.storage.v1.StorageClass[];
  /** Backup system instance */
  public readonly backup?: Velero;

  constructor(name: string, args: StorageModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Storage", name, args, opts);

    // Step 1: Install external snapshotter
    this.externalSnapshotter = new ExternalSnapshotter(`${name}-snapshotter`, {
      namespace: "kube-system", // External snapshotter should be in kube-system
      version: args.externalSnapshotter?.version,
    }, { parent: this });

    // Step 2: Deploy Rook Ceph operator
    let rookCephInstance: RookCeph;
    switch (args.storageImplementation) {
      case StorageImplementation.ROOK_CEPH:
        rookCephInstance = new RookCeph(`${name}-operator`, {
          namespace: args.namespace,
          enableCsiDriver: true,
          enableMonitoring: false,
        }, { parent: this });
        break;
      default:
        throw new Error(`Unknown storage implementation: ${args.storageImplementation}`);
    }
    this.rookCeph = rookCephInstance;

    // Step 3: Create the Ceph cluster
    const clusterName = args.cephCluster.clusterName || "rook-ceph";
    this.cephCluster = new RookCephCluster(`${name}-cluster`, {
      namespace: args.namespace,
      cephImage: args.cephCluster.cephImage,
      dataDirHostPath: args.cephCluster.dataDirHostPath,
      storage: args.cephCluster.storage,
      monCount: args.cephCluster.monitorCount,
    }, { 
      parent: this,
      dependsOn: [this.rookCeph]
    });

    this.filesystems = [];
    this.storageClasses = [];

    // Step 4: Create filesystems and storage classes
    for (let i = 0; i < args.storageClasses.length; i++) {
      const scConfig = args.storageClasses[i];
      
      // Create filesystem directly from configuration
      const filesystem = new CephFilesystem(`${name}-fs-${i}`, {
        namespace: args.namespace,
        clusterName: clusterName,
        metadataPool: scConfig.filesystem.metadataPool,
        dataPools: scConfig.filesystem.dataPools,
        metadataServer: scConfig.filesystem.metadataServer,
      }, { 
        parent: this,
        dependsOn: [this.cephCluster]
      });
      this.filesystems.push(filesystem);

      // Create Kubernetes StorageClass for the filesystem
      const storageClass = new k8s.storage.v1.StorageClass(`${name}-sc-${i}`, {
        metadata: {
          name: scConfig.name,
          namespace: args.namespace,
          annotations: {
            ...(scConfig.isDefault && { "storageclass.kubernetes.io/is-default-class": "true" }),
          },
        },
        provisioner: "rook-ceph.cephfs.csi.ceph.com",
        parameters: {
          clusterID: args.namespace,
          fsName: filesystem.filesystem.metadata.name,
          pool: scConfig.filesystem.dataPools[0].name || `${name}-fs-${i}-data`,
          "csi.storage.k8s.io/provisioner-secret-name": "rook-csi-cephfs-provisioner",
          "csi.storage.k8s.io/provisioner-secret-namespace": args.namespace,
          "csi.storage.k8s.io/controller-expand-secret-name": "rook-csi-cephfs-provisioner",
          "csi.storage.k8s.io/controller-expand-secret-namespace": args.namespace,
          "csi.storage.k8s.io/node-stage-secret-name": "rook-csi-cephfs-node",
          "csi.storage.k8s.io/node-stage-secret-namespace": args.namespace,
        },
        reclaimPolicy: scConfig.reclaimPolicy || "Delete",
        allowVolumeExpansion: scConfig.allowVolumeExpansion || true,
        volumeBindingMode: scConfig.volumeBindingMode || "Immediate",
      }, { 
        parent: this,
        dependsOn: [filesystem]
      });
      this.storageClasses.push(storageClass);
    }

    // Step 5: Set up backup infrastructure
    if (args.backupStrategy) {
      switch (args.backupImplementation) {
        case BackupImplementation.VELERO:
          this.backup = new Velero(`${name}-backup`, {
            namespace: args.namespace,
            backupStorageLocations: args.backupStrategy.backupStorageLocations,
            volumeSnapshotLocations: args.backupStrategy.volumeSnapshotLocations,
            defaultBackupTTL: args.backupStrategy.defaultBackupTTL,
            enableFilesystemBackups: args.backupStrategy.enableFilesystemBackups,
            enableCsiSnapshots: args.backupStrategy.enableSnapshotBackups,
          }, { 
            parent: this,
            dependsOn: [this.externalSnapshotter, this.cephCluster]
          });
          break;
        default:
          throw new Error(`Unknown backup implementation: ${args.backupImplementation}`);
      }
    }

    this.registerOutputs({
      externalSnapshotter: this.externalSnapshotter,
      rookCeph: this.rookCeph,
      cephCluster: this.cephCluster,
      filesystems: this.filesystems,
      storageClasses: this.storageClasses,
      backup: this.backup,
    });
  }

  /**
   * Returns the Ceph cluster custom resource
   */
  public getClusterResource(): k8s.apiextensions.CustomResource {
    return this.cephCluster.cluster;
  }

  /**
   * Returns the list of available filesystem names
   */
  public getFilesystemNames(): pulumi.Output<string[]> {
    return pulumi.output(this.filesystems.map(fs => fs.filesystem.metadata.name));
  }

  /**
   * Returns the list of available storage class names
   */
  public getStorageClassNames(): pulumi.Output<string[]> {
    return pulumi.output(this.storageClasses.map(sc => sc.metadata.name));
  }
}

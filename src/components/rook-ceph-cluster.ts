import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Storage device configuration for Ceph OSDs
 */
export interface StorageDevice {
  /** Device name (e.g., "/dev/sdb", "/dev/disk/by-id/...") */
  name: pulumi.Input<string>;
  /** Configuration options for this device */
  config?: pulumi.Input<Record<string, any>>;
}

/**
 * Node-specific storage configuration
 */
export interface StorageNode {
  /** Node name or selector */
  name?: pulumi.Input<string>;
  /** Specific devices to use on this node */
  devices?: pulumi.Input<StorageDevice[]>;
  /** Configuration options for this node */
  config?: pulumi.Input<Record<string, any>>;
}

/**
 * Storage configuration for the Ceph cluster
 */
export interface StorageConfig {
  /** Use all available nodes in the cluster */
  useAllNodes?: pulumi.Input<boolean>;
  /** Use all available devices on nodes */
  useAllDevices?: pulumi.Input<boolean>;
  /** Specific node configurations */
  nodes?: pulumi.Input<StorageNode[]>;
  /** Device filter (regex pattern) */
  deviceFilter?: pulumi.Input<string>;
  /** Global storage configuration */
  config?: pulumi.Input<Record<string, any>>;
}

/**
 * Configuration for the RookCephCluster component
 */
export interface RookCephClusterArgs {
  /** Namespace where the cluster will be created */
  namespace: pulumi.Input<string>;
  /** Ceph container image to use */
  cephImage?: pulumi.Input<string>;
  /** Host path for storing cluster data */
  dataDirHostPath?: pulumi.Input<string>;
  /** Storage configuration for the cluster */
  storage: StorageConfig;
  /** Number of monitor daemons */
  monCount?: pulumi.Input<number>;
}

/**
 * RookCephCluster component - creates a Ceph storage cluster using Rook
 * 
 * This component creates a CephCluster custom resource that defines a Ceph storage
 * cluster with configurable storage layout, allowing you to specify which nodes
 * and devices to use for storage.
 * 
 * @example
 * ```typescript
 * import { RookCephCluster } from "../components/rook-ceph-cluster";
 * 
 * const cluster = new RookCephCluster("ceph-cluster", {
 *   namespace: "rook-ceph",
 *   storage: {
 *     useAllNodes: false,
 *     nodes: [
 *       {
 *         name: "worker-1",
 *         devices: [{ name: "/dev/sdb" }, { name: "/dev/sdc" }]
 *       },
 *       {
 *         name: "worker-2", 
 *         devices: [{ name: "/dev/sdb" }]
 *       }
 *     ]
 *   }
 * });
 * ```
 */
export class RookCephCluster extends pulumi.ComponentResource {
  /** The CephCluster custom resource */
  public readonly cluster: k8s.apiextensions.CustomResource;

  constructor(name: string, args: RookCephClusterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:RookCephCluster", name, args, opts);

    // Create the CephCluster custom resource
    this.cluster = new k8s.apiextensions.CustomResource(
      `${name}-cluster`,
      {
        apiVersion: "ceph.rook.io/v1",
        kind: "CephCluster",
        metadata: {
          name: name,
          namespace: args.namespace,
        },
        spec: {
          cephVersion: {
            image: args.cephImage,
          },
          dataDirHostPath: args.dataDirHostPath || "/var/lib/rook",
          mon: {
            count: args.monCount || 3,
            allowMultiplePerNode: false,
          },
          mgr: {
            count: 2,
          },
          storage: this.buildStorageSpec(args.storage),
          crashCollector: {
            disable: false,
          },
          continueUpgradeAfterChecksEvenIfNotHealthy: false,
          waitTimeoutForHealthyOSDInMinutes: 10,
          skipUpgradeChecks: false,
          disruptionManagement: {
            managePodBudgets: true,
            osdMaintenanceTimeout: 30,
            pgHealthCheckTimeout: 0,
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      cluster: this.cluster,
    });
  }

  /**
   * Builds the storage specification for the CephCluster
   */
  private buildStorageSpec(storage: StorageConfig) {
    const spec: Record<string, any> = {};

    if (storage.useAllNodes !== undefined) {
      spec.useAllNodes = storage.useAllNodes;
    }

    if (storage.useAllDevices !== undefined) {
      spec.useAllDevices = storage.useAllDevices;
    }

    if (storage.deviceFilter) {
      spec.deviceFilter = storage.deviceFilter;
    }

    if (storage.config) {
      spec.config = storage.config;
    }

    if (storage.nodes) {
      spec.nodes = storage.nodes;
    }

    return spec;
  }
} 
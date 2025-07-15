import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Placement group configuration for the block pool
 */
export interface PlacementGroupConfig {
  /** Number of placement groups */
  size: pulumi.Input<number>;
  /** Minimum number of placement groups */
  min?: pulumi.Input<number>;
  /** Maximum number of placement groups */
  max?: pulumi.Input<number>;
}

/**
 * Replication configuration for the block pool
 */
export interface ReplicationConfig {
  /** Number of replicas for the data */
  size: pulumi.Input<number>;
  /** Minimum number of replicas required for writes */
  requireSafeReplicaSize?: pulumi.Input<boolean>;
  /** Target size ratio for the pool */
  targetSizeRatio?: pulumi.Input<number>;
}

/**
 * Erasure coding configuration for the block pool
 */
export interface ErasureCodingConfig {
  /** Number of data chunks */
  dataChunks: pulumi.Input<number>;
  /** Number of coding chunks */
  codingChunks: pulumi.Input<number>;
  /** Erasure coding algorithm */
  algorithm?: pulumi.Input<string>;
}

/**
 * Configuration for the CephBlockPool component
 */
export interface CephBlockPoolArgs {
  /** Namespace where the block pool will be created */
  namespace: pulumi.Input<string>;
  /** Name of the Ceph cluster this pool belongs to */
  clusterName: pulumi.Input<string>;
  /** Failure domain for the pool (e.g., 'host', 'osd', 'rack') */
  failureDomain?: pulumi.Input<string>;
  /** Replication configuration (use either this or erasureCoding) */
  replication?: ReplicationConfig;
  /** Erasure coding configuration (use either this or replication) */
  erasureCoding?: ErasureCodingConfig;
  /** Device class for the pool (e.g., 'hdd', 'ssd', 'nvme') */
  deviceClass?: pulumi.Input<string>;
  /** Enable compression for the pool */
  compression?: {
    /** Compression algorithm (e.g., 'lz4', 'snappy', 'zlib') */
    algorithm?: pulumi.Input<string>;
    /** Compression mode ('aggressive', 'passive', 'force') */
    mode?: pulumi.Input<string>;
  };
  /** Pool quotas */
  quotas?: {
    /** Maximum number of bytes */
    maxBytes?: pulumi.Input<number>;
    /** Maximum number of objects */
    maxObjects?: pulumi.Input<number>;
  };
  /** Pool parameters */
  parameters?: pulumi.Input<Record<string, any>>;
}

/**
 * CephBlockPool component - creates a Ceph block pool for use with RBD storage
 * 
 * This component creates a CephBlockPool custom resource that defines a Ceph block pool
 * which can be used by storage classes to provision persistent volumes.
 * 
 * @example
 * ```typescript
 * import { CephBlockPool } from "../components/ceph-block-pool";
 * 
 * const blockPool = new CephBlockPool("fast-pool", {
 *   namespace: "rook-ceph",
 *   clusterName: "rook-ceph",
 *   failureDomain: "host",
 *   replication: {
 *     size: 3,
 *     requireSafeReplicaSize: true,
 *   },
 *   deviceClass: "ssd",
 *   compression: {
 *     algorithm: "lz4",
 *     mode: "aggressive",
 *   },
 * });
 * ```
 */
export class CephBlockPool extends pulumi.ComponentResource {
  /** The CephBlockPool custom resource */
  public readonly blockPool: k8s.apiextensions.CustomResource;

  constructor(name: string, args: CephBlockPoolArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CephBlockPool", name, args, opts);

    // Create the CephBlockPool custom resource
    this.blockPool = new k8s.apiextensions.CustomResource(
      `${name}-pool`,
      {
        apiVersion: "ceph.rook.io/v1",
        kind: "CephBlockPool",
        metadata: {
          name: name,
          namespace: args.namespace,
        },
        spec: {
          ...(args.failureDomain && { failureDomain: args.failureDomain }),
          ...(args.replication && { replicated: this.buildReplicationSpec(args.replication) }),
          ...(args.erasureCoding && { erasureCoded: this.buildErasureCodedSpec(args.erasureCoding) }),
          ...(args.deviceClass && { deviceClass: args.deviceClass }),
          ...(args.compression && { compressionMode: args.compression.mode, compressionAlgorithm: args.compression.algorithm }),
          ...(args.quotas && { quotas: args.quotas }),
          ...(args.parameters && { parameters: args.parameters }),
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      blockPool: this.blockPool,
    });
  }

  /**
   * Builds the replication specification for the block pool
   */
  private buildReplicationSpec(replication: ReplicationConfig) {
    return {
      size: replication.size,
      ...(replication.requireSafeReplicaSize !== undefined && { requireSafeReplicaSize: replication.requireSafeReplicaSize }),
      ...(replication.targetSizeRatio !== undefined && { targetSizeRatio: replication.targetSizeRatio }),
    };
  }

  /**
   * Builds the erasure coding specification for the block pool
   */
  private buildErasureCodedSpec(erasureCoding: ErasureCodingConfig) {
    return {
      dataChunks: erasureCoding.dataChunks,
      codingChunks: erasureCoding.codingChunks,
      ...(erasureCoding.algorithm && { algorithm: erasureCoding.algorithm }),
    };
  }
} 
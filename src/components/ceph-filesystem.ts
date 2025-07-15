import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Metadata pool configuration for the filesystem
 */
export interface MetadataPoolConfig {
  /** Name of the metadata pool */
  name?: pulumi.Input<string>;
  /** Replication configuration for metadata */
  replication?: {
    /** Number of replicas for metadata */
    size: pulumi.Input<number>;
    /** Minimum number of replicas required */
    requireSafeReplicaSize?: pulumi.Input<boolean>;
  };
  /** Device class for metadata pool */
  deviceClass?: pulumi.Input<string>;
}

/**
 * Data pool configuration for the filesystem
 */
export interface DataPoolConfig {
  /** Name of the data pool */
  name?: pulumi.Input<string>;
  /** Failure domain for the data pool */
  failureDomain?: pulumi.Input<string>;
  /** Replication configuration for data */
  replication?: {
    /** Number of replicas for data */
    size: pulumi.Input<number>;
    /** Minimum number of replicas required */
    requireSafeReplicaSize?: pulumi.Input<boolean>;
  };
  /** Erasure coding configuration for data */
  erasureCoding?: {
    /** Number of data chunks */
    dataChunks: pulumi.Input<number>;
    /** Number of coding chunks */
    codingChunks: pulumi.Input<number>;
    /** Erasure coding algorithm */
    algorithm?: pulumi.Input<string>;
  };
  /** Device class for data pool */
  deviceClass?: pulumi.Input<string>;
  /** Enable compression for data pool */
  compression?: {
    /** Compression algorithm */
    algorithm?: pulumi.Input<string>;
    /** Compression mode */
    mode?: pulumi.Input<string>;
  };
}

/**
 * Metadata server configuration
 */
export interface MetadataServerConfig {
  /** Number of active metadata servers */
  activeCount: pulumi.Input<number>;
  /** Number of standby metadata servers */
  activeStandby?: pulumi.Input<boolean>;
  /** Resource requirements for metadata servers */
  resources?: {
    requests?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
    limits?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
  };
  /** Placement configuration for metadata servers */
  placement?: {
    /** Node affinity */
    nodeAffinity?: any;
    /** Pod anti-affinity */
    podAntiAffinity?: any;
    /** Tolerations */
    tolerations?: any[];
  };
}

/**
 * Configuration for the CephFilesystem component
 */
export interface CephFilesystemArgs {
  /** Namespace where the filesystem will be created */
  namespace: pulumi.Input<string>;
  /** Name of the Ceph cluster this filesystem belongs to */
  clusterName: pulumi.Input<string>;
  /** Metadata pool configuration */
  metadataPool: MetadataPoolConfig;
  /** Data pools configuration */
  dataPools: DataPoolConfig[];
  /** Metadata server configuration */
  metadataServer: MetadataServerConfig;
  /** Preserve the filesystem on deletion */
  preserveFilesystemOnDelete?: pulumi.Input<boolean>;
  /** Preserve pools on deletion */
  preservePoolsOnDelete?: pulumi.Input<boolean>;
}

/**
 * CephFilesystem component - creates a Ceph filesystem for shared storage
 * 
 * This component creates a CephFilesystem custom resource that defines a Ceph filesystem
 * which can be used by storage classes to provision shared persistent volumes.
 * 
 * @example
 * ```typescript
 * import { CephFilesystem } from "../components/ceph-filesystem";
 * 
 * const filesystem = new CephFilesystem("shared-fs", {
 *   namespace: "rook-ceph",
 *   clusterName: "rook-ceph",
 *   metadataPool: {
 *     name: "shared-fs-metadata",
 *     replication: {
 *       size: 3,
 *       requireSafeReplicaSize: true,
 *     },
 *     deviceClass: "ssd",
 *   },
 *   dataPools: [{
 *     name: "shared-fs-data",
 *     failureDomain: "host",
 *     replication: {
 *       size: 3,
 *       requireSafeReplicaSize: true,
 *     },
 *     deviceClass: "hdd",
 *   }],
 *   metadataServer: {
 *     activeCount: 1,
 *     activeStandby: true,
 *     resources: {
 *       requests: {
 *         cpu: "500m",
 *         memory: "1Gi",
 *       },
 *       limits: {
 *         cpu: "1000m",
 *         memory: "2Gi",
 *       },
 *     },
 *   },
 * });
 * ```
 */
export class CephFilesystem extends pulumi.ComponentResource {
  /** The CephFilesystem custom resource */
  public readonly filesystem: k8s.apiextensions.CustomResource;

  constructor(name: string, args: CephFilesystemArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CephFilesystem", name, args, opts);

    // Create the CephFilesystem custom resource
    this.filesystem = new k8s.apiextensions.CustomResource(
      `${name}-filesystem`,
      {
        apiVersion: "ceph.rook.io/v1",
        kind: "CephFilesystem",
        metadata: {
          name: name,
          namespace: args.namespace,
          annotations: {
            "pulumi.com/patchForce": "true",
          },
        },
        spec: {
          metadataPool: this.buildMetadataPoolSpec(args.metadataPool),
          dataPools: args.dataPools.map(pool => this.buildDataPoolSpec(pool)),
          metadataServer: this.buildMetadataServerSpec(args.metadataServer),
          ...(args.preserveFilesystemOnDelete !== undefined && { preserveFilesystemOnDelete: args.preserveFilesystemOnDelete }),
          ...(args.preservePoolsOnDelete !== undefined && { preservePoolsOnDelete: args.preservePoolsOnDelete }),
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      filesystem: this.filesystem,
    });
  }

  /**
   * Builds the metadata pool specification
   */
  private buildMetadataPoolSpec(metadataPool: MetadataPoolConfig) {
    return {
      ...(metadataPool.name && { name: metadataPool.name }),
      ...(metadataPool.replication && { replicated: metadataPool.replication }),
      ...(metadataPool.deviceClass && { deviceClass: metadataPool.deviceClass }),
    };
  }

  /**
   * Builds the data pool specification
   */
  private buildDataPoolSpec(dataPool: DataPoolConfig) {
    return {
      ...(dataPool.name && { name: dataPool.name }),
      ...(dataPool.failureDomain && { failureDomain: dataPool.failureDomain }),
      ...(dataPool.replication && { replicated: dataPool.replication }),
      ...(dataPool.erasureCoding && { erasureCoded: dataPool.erasureCoding }),
      ...(dataPool.deviceClass && { deviceClass: dataPool.deviceClass }),
      ...(dataPool.compression && {
        compressionMode: dataPool.compression.mode,
        compressionAlgorithm: dataPool.compression.algorithm,
      }),
    };
  }

  /**
   * Builds the metadata server specification
   */
  private buildMetadataServerSpec(metadataServer: MetadataServerConfig) {
    return {
      activeCount: metadataServer.activeCount,
      ...(metadataServer.activeStandby !== undefined && { activeStandby: metadataServer.activeStandby }),
      ...(metadataServer.resources && { resources: metadataServer.resources }),
      ...(metadataServer.placement && { placement: metadataServer.placement }),
    };
  }
} 

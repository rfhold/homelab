import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

/**
 * Backup storage location configuration
 */
export interface BackupStorageLocation {
  /** Name of the backup storage location */
  name: pulumi.Input<string>;
  /** Storage provider (e.g., aws, azure, gcp) */
  provider: pulumi.Input<string>;
  /** Storage bucket name */
  bucket: pulumi.Input<string>;
  /** Storage region */
  region?: pulumi.Input<string>;
  /** Storage prefix/path */
  prefix?: pulumi.Input<string>;
  /** Whether this is the default backup storage location */
  default?: pulumi.Input<boolean>;
  /** Provider-specific configuration */
  config?: pulumi.Input<Record<string, any>>;
  /** Credentials for accessing the storage */
  credential?: {
    /** Name of the secret containing credentials */
    name: pulumi.Input<string>;
    /** Key within the secret */
    key: pulumi.Input<string>;
  };
}

/**
 * Volume snapshot location configuration
 */
export interface VolumeSnapshotLocation {
  /** Name of the volume snapshot location */
  name: pulumi.Input<string>;
  /** Snapshot provider (e.g., aws, azure, gcp) */
  provider: pulumi.Input<string>;
  /** Storage region */
  region?: pulumi.Input<string>;
  /** Provider-specific configuration */
  config?: pulumi.Input<Record<string, any>>;
  /** Credentials for accessing the snapshot storage */
  credential?: {
    /** Name of the secret containing credentials */
    name: pulumi.Input<string>;
    /** Key within the secret */
    key: pulumi.Input<string>;
  };
}

/**
 * Configuration for the Velero component
 */
export interface VeleroArgs {
  /** Kubernetes namespace to deploy Velero into */
  namespace: pulumi.Input<string>;
  
  /** Backup storage locations configuration */
  backupStorageLocations: BackupStorageLocation[];
  
  /** Volume snapshot locations configuration (optional for filesystem backups only) */
  volumeSnapshotLocations?: VolumeSnapshotLocation[];
  
  /** Default backup TTL (time to live) */
  defaultBackupTTL?: pulumi.Input<string>;
  
  /** Enable filesystem backups using node-agent */
  enableFilesystemBackups?: pulumi.Input<boolean>;
  
  /** Enable CSI snapshot support */
  enableCsiSnapshots?: pulumi.Input<boolean>;
  
  /** Resource limits for Velero server */
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
  
  /** Node agent resource limits (when filesystem backups are enabled) */
  nodeAgentResources?: {
    requests?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
    limits?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
  };
}

/**
 * Velero component - provides backup and disaster recovery for Kubernetes
 * 
 * Supports both snapshot-based backups (using CSI snapshots) and filesystem-based backups
 * (using node-agent to backup pod volumes directly).
 * 
 * @example
 * ```typescript
 * import { Velero } from "../components/velero";
 * 
 * const velero = new Velero("backup-system", {
 *   namespace: "velero",
 *   backupStorageLocations: [{
 *     name: "default",
 *     provider: "aws",
 *     bucket: "my-backup-bucket",
 *     region: "us-west-2",
 *     default: true,
 *   }],
 *   volumeSnapshotLocations: [{
 *     name: "default",
 *     provider: "aws",
 *     region: "us-west-2",
 *   }],
 *   enableFilesystemBackups: true,
 *   enableCsiSnapshots: true,
 *   defaultBackupTTL: "720h", // 30 days
 * });
 * ```
 * 
 * @see https://velero.io/
 */
export class Velero extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: VeleroArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Velero", name, args, opts);

    const chartConfig = HELM_CHARTS.VELERO;

    // Transform backup storage locations for Helm values
    const backupStorageLocations = args.backupStorageLocations.map(bsl => ({
      name: bsl.name,
      provider: bsl.provider,
      bucket: bsl.bucket,
      prefix: bsl.prefix,
      default: bsl.default,
      config: {
        region: bsl.region,
        ...bsl.config,
      },
      credential: bsl.credential ? {
        name: bsl.credential.name,
        key: bsl.credential.key,
      } : undefined,
    }));

    // Transform volume snapshot locations for Helm values
    const volumeSnapshotLocations = args.volumeSnapshotLocations?.map(vsl => ({
      name: vsl.name,
      provider: vsl.provider,
      config: {
        region: vsl.region,
        ...vsl.config,
      },
      credential: vsl.credential ? {
        name: vsl.credential.name,
        key: vsl.credential.key,
      } : undefined,
    })) || [];

    // Deploy Velero using Helm v4 Chart
    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          configuration: {
            // Backup storage locations
            backupStorageLocation: backupStorageLocations,
            
            // Volume snapshot locations (only if provided)
            ...(volumeSnapshotLocations.length > 0 && {
              volumeSnapshotLocation: volumeSnapshotLocations,
            }),
            
            // Default backup TTL
            ...(args.defaultBackupTTL && {
              defaultBackupTTL: args.defaultBackupTTL,
            }),
            
            // Uploader type based on filesystem backup preference
            uploaderType: args.enableFilesystemBackups ? "kopia" : undefined,
          },
          
          // Enable node-agent for filesystem backups
          deployNodeAgent: args.enableFilesystemBackups ?? false,
          
          // Enable snapshots
          snapshotsEnabled: args.enableCsiSnapshots ?? true,
          
          // Server resources
          ...(args.resources && {
            resources: args.resources,
          }),
          
          // Node agent resources (when filesystem backups are enabled)
          ...(args.enableFilesystemBackups && args.nodeAgentResources && {
            nodeAgent: {
              resources: args.nodeAgentResources,
            },
          }),
          
          // Enable CSI plugin if CSI snapshots are enabled
          ...(args.enableCsiSnapshots && {
            plugins: {
              csi: {
                enabled: true,
              },
            },
          }),
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
    });
  }
} 
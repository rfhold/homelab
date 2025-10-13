import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

export interface VeleroArgs {
  namespace: pulumi.Input<string>;
  
  s3Endpoint: pulumi.Input<string>;
  s3Region: pulumi.Input<string>;
  s3Bucket: pulumi.Input<string>;
  s3AccessKey: pulumi.Input<string>;
  s3SecretKey: pulumi.Input<string>;
  
  repositoryPassword: pulumi.Input<string>;
  
  defaultBackupTtl?: pulumi.Input<string>;
  garbageCollectionFrequency?: pulumi.Input<string>;
  backupSyncPeriod?: pulumi.Input<string>;
  fsBackupTimeout?: pulumi.Input<string>;
  defaultVolumesToFsBackup?: pulumi.Input<boolean>;
  
  backupStorageLocationName?: pulumi.Input<string>;
  s3ForcePathStyle?: pulumi.Input<boolean>;
  s3Prefix?: pulumi.Input<string>;
  
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
  
  serverResources?: {
    requests?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
    limits?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
  };
  
  initContainers?: pulumi.Input<any>[];
  
  schedules?: Record<string, {
    schedule: pulumi.Input<string>;
    template?: {
      ttl?: pulumi.Input<string>;
      includedNamespaces?: pulumi.Input<string>[];
      excludedNamespaces?: pulumi.Input<string>[];
      storageLocation?: pulumi.Input<string>;
      defaultVolumesToFsBackup?: pulumi.Input<boolean>;
    };
    disabled?: pulumi.Input<boolean>;
  }>;
  
  repositoryMaintenanceJobGlobal?: {
    keepLatestMaintenanceJobs?: number;
    podResources?: {
      cpuRequest?: pulumi.Input<string>;
      cpuLimit?: pulumi.Input<string>;
      memoryRequest?: pulumi.Input<string>;
      memoryLimit?: pulumi.Input<string>;
    };
  };
}

export class Velero extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;
  public readonly backupStorageLocation: pulumi.Output<string>;

  constructor(name: string, args: VeleroArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Velero", name, args, opts);

    const chartConfig = HELM_CHARTS.VELERO;

    const s3CredentialsSecret = new k8s.core.v1.Secret(
      `${name}-s3-credentials`,
      {
        metadata: {
          namespace: args.namespace,
          name: "velero-s3-credentials",
        },
        type: "Opaque",
        stringData: {
          cloud: pulumi.all([args.s3AccessKey, args.s3SecretKey]).apply(
            ([accessKey, secretKey]) =>
              `[default]\naws_access_key_id=${accessKey}\naws_secret_access_key=${secretKey}`
          ),
        },
      },
      { parent: this }
    );

    const repoPasswordSecret = new k8s.core.v1.Secret(
      `${name}-repo-credentials`,
      {
        metadata: {
          namespace: args.namespace,
          name: "velero-repo-credentials",
        },
        type: "Opaque",
        stringData: {
          "repository-password": args.repositoryPassword,
        },
      },
      { parent: this }
    );

    const backupStorageLocationName = args.backupStorageLocationName || "default";
    const s3ForcePathStyle = args.s3ForcePathStyle ?? true;

    const repositoryConfigData: any = {
      name: "velero-repo-maintenance",
      global: {
        keepLatestMaintenanceJobs: args.repositoryMaintenanceJobGlobal?.keepLatestMaintenanceJobs ?? 3,
      },
      repositories: {},
    };

    if (args.repositoryMaintenanceJobGlobal?.podResources) {
      repositoryConfigData.global.podResources = {
        cpuRequest: args.repositoryMaintenanceJobGlobal.podResources.cpuRequest,
        cpuLimit: args.repositoryMaintenanceJobGlobal.podResources.cpuLimit,
        memoryRequest: args.repositoryMaintenanceJobGlobal.podResources.memoryRequest,
        memoryLimit: args.repositoryMaintenanceJobGlobal.podResources.memoryLimit,
      };
    }

    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        chart: chartConfig.chart,
        version: chartConfig.version,
        namespace: args.namespace,
        repositoryOpts: {
          repo: chartConfig.repository,
        },
        values: {
          initContainers: args.initContainers || [
            {
              name: "velero-plugin-for-aws",
              image: "velero/velero-plugin-for-aws:v1.13.0",
              imagePullPolicy: "IfNotPresent",
              volumeMounts: [
                {
                  mountPath: "/target",
                  name: "plugins",
                },
              ],
            },
          ],
          
          resources: args.serverResources,
          
          configuration: {
            backupStorageLocation: [
              {
                name: backupStorageLocationName,
                provider: "aws",
                bucket: args.s3Bucket,
                prefix: args.s3Prefix,
                default: true,
                credential: {
                  name: s3CredentialsSecret.metadata.name,
                  key: "cloud",
                },
                config: {
                  region: args.s3Region,
                  s3ForcePathStyle: s3ForcePathStyle.toString(),
                  s3Url: args.s3Endpoint,
                },
              },
            ],
            
            volumeSnapshotLocation: [
              {
                name: "default",
                provider: "aws",
                config: {
                  region: args.s3Region,
                },
              },
            ],
            
            uploaderType: "kopia",
            defaultBackupTTL: args.defaultBackupTtl || "168h",
            garbageCollectionFrequency: args.garbageCollectionFrequency || "1h",
            backupSyncPeriod: args.backupSyncPeriod,
            fsBackupTimeout: args.fsBackupTimeout,
            defaultVolumesToFsBackup: args.defaultVolumesToFsBackup ?? false,
            
            repositoryMaintenanceJob: {
              repositoryConfigData: repositoryConfigData,
            },
          },
          
          credentials: {
            useSecret: true,
            existingSecret: s3CredentialsSecret.metadata.name,
            extraSecretRef: repoPasswordSecret.metadata.name,
          },
          
          deployNodeAgent: true,
          
          nodeAgent: {
            podVolumePath: "/var/lib/kubelet/pods",
            priorityClassName: "",
            resources: args.nodeAgentResources,
            tolerations: [],
            useScratchEmptyDir: true,
            podSecurityContext: {
              runAsUser: 0,
            },
          },
          
          schedules: args.schedules || {},
          
          backupsEnabled: true,
          snapshotsEnabled: true,
          
          upgradeCRDs: true,
          cleanUpCRDs: false,
        },
      },
      { parent: this, dependsOn: [s3CredentialsSecret, repoPasswordSecret] }
    );

    this.namespace = pulumi.output(args.namespace);
    this.backupStorageLocation = pulumi.output(backupStorageLocationName);

    this.registerOutputs({
      chart: this.chart,
      namespace: this.namespace,
      backupStorageLocation: this.backupStorageLocation,
    });
  }
}

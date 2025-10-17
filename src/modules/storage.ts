import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ExternalSnapshotter } from "../components/external-snapshotter";
import { RookCeph } from "../components/rook-ceph";
import { RookCephCluster, StorageConfig } from "../components/rook-ceph-cluster";
import { CephFilesystem, MetadataServerConfig, MetadataPoolConfig, DataPoolConfig } from "../components/ceph-filesystem";
import { DOCKER_IMAGES } from "../docker-images";

/**
 * Available storage implementations
 */
export enum StorageImplementation {
  ROOK_CEPH = "rook-ceph",
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
 * Ingress configuration for Ceph dashboard
 */
export interface IngressConfig {
  /** Whether to enable ingress */
  enabled: pulumi.Input<boolean>;
  /** Domain name for the Ceph dashboard */
  domain: pulumi.Input<string>;
  /** Ingress class name */
  className?: pulumi.Input<string>;
  /** Additional annotations for the ingress */
  annotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  /** TLS configuration */
  tls?: {
    /** Whether to enable TLS */
    enabled: pulumi.Input<boolean>;
    /** Secret name for TLS certificate */
    secretName?: pulumi.Input<string>;
  };
}

/**
 * Configuration for the Storage module
 */
export interface StorageModuleArgs {
  /** Kubernetes namespace to deploy storage components */
  namespace: pulumi.Input<string>;

  /** Storage implementation to use */
  storageImplementation: StorageImplementation;

  cephCluster: {
    clusterName?: pulumi.Input<string>;
    cephImage?: pulumi.Input<string>;
    dataDirHostPath?: pulumi.Input<string>;
    storage: StorageConfig;
    monitorCount?: pulumi.Input<number>;
    mgrCount?: pulumi.Input<number>;
    allowMultipleMonPerNode?: pulumi.Input<boolean>;
    allowMultipleMgrPerNode?: pulumi.Input<boolean>;
    obcAllowedAdditionalConfigFields?: pulumi.Input<string>;
  };

  /** Storage class configurations */
  storageClasses: StorageClassConfig[];

  /** External snapshotter configuration */
  externalSnapshotter?: {
    /** Version of external-snapshotter */
    version?: pulumi.Input<string>;
  };

  /** Ingress configuration for Ceph dashboard */
  ingress?: IngressConfig;

  /** Ceph toolbox configuration */
  toolbox?: {
    /** Whether to deploy the Ceph toolbox */
    enabled: pulumi.Input<boolean>;
    /** Ceph container image for toolbox */
    image?: pulumi.Input<string>;
  };

  /** CSI plugin tolerations for scheduling on tainted nodes */
  csiPluginTolerations?: pulumi.Input<any[]>;

  /** CSI provisioner tolerations for scheduling on tainted nodes */
  csiProvisionerTolerations?: pulumi.Input<any[]>;
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
 *   toolbox: {
 *     enabled: true,
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
  /** Ingress instance for Ceph dashboard */
  public readonly ingress?: k8s.networking.v1.Ingress;
  /** Ceph toolbox deployment */
  public readonly toolbox?: k8s.apps.v1.Deployment;

  constructor(name: string, args: StorageModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Storage", name, args, opts);

    // Step 1: Install external snapshotter
    this.externalSnapshotter = new ExternalSnapshotter(`${name}-snapshotter`, {
      namespace: "kube-system", // External snapshotter should be in kube-system
      version: args.externalSnapshotter?.version,
    }, { parent: this });

    let rookCephInstance: RookCeph;
    switch (args.storageImplementation) {
      case StorageImplementation.ROOK_CEPH:
        rookCephInstance = new RookCeph(`${name}-operator`, {
          namespace: args.namespace,
          enableCsiDriver: true,
          enableMonitoring: false,
          obcAllowedAdditionalConfigFields: args.cephCluster.obcAllowedAdditionalConfigFields,
          csiPluginTolerations: args.csiPluginTolerations,
          csiProvisionerTolerations: args.csiProvisionerTolerations,
        }, { parent: this });
        break;
      default:
        throw new Error(`Unknown storage implementation: ${args.storageImplementation}`);
    }
    this.rookCeph = rookCephInstance;

    // Step 3: Create the Ceph cluster
    const clusterName = args.cephCluster.clusterName || "storage-cluster";
    this.cephCluster = new RookCephCluster(`${name}-cluster`, {
      name: clusterName,
      namespace: args.namespace,
      cephImage: args.cephCluster.cephImage,
      dataDirHostPath: args.cephCluster.dataDirHostPath,
      storage: args.cephCluster.storage,
      monCount: args.cephCluster.monitorCount,
      mgrCount: args.cephCluster.mgrCount,
      allowMultipleMonPerNode: args.cephCluster.allowMultipleMonPerNode,
      allowMultipleMgrPerNode: args.cephCluster.allowMultipleMgrPerNode,
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
        provisioner: pulumi.interpolate`${args.namespace}.cephfs.csi.ceph.com`,
        parameters: {
          clusterID: args.namespace,
          "csi.storage.k8s.io/provisioner-secret-name": "rook-csi-cephfs-provisioner",
          "csi.storage.k8s.io/provisioner-secret-namespace": args.namespace,
          "csi.storage.k8s.io/controller-expand-secret-name": "rook-csi-cephfs-provisioner",
          "csi.storage.k8s.io/controller-expand-secret-namespace": args.namespace,
          "csi.storage.k8s.io/node-stage-secret-name": "rook-csi-cephfs-node",
          "csi.storage.k8s.io/node-stage-secret-namespace": args.namespace,
          fsName: filesystem.filesystem.metadata.name,
          pool: pulumi.interpolate`${filesystem.filesystem.metadata.name}-${scConfig.filesystem.dataPools[0].name}`,
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

    // Step 6: Set up ingress for Ceph dashboard (if configured)
    if (args.ingress?.enabled) {
      const ingressAnnotations: { [key: string]: pulumi.Input<string> } = {};

      // Add custom annotations if provided
      if (args.ingress.annotations) {
        Object.assign(ingressAnnotations, args.ingress.annotations);
      }

      // Add TLS annotations if TLS is enabled
      if (args.ingress.tls?.enabled) {
        ingressAnnotations["cert-manager.io/cluster-issuer"] = "letsencrypt-prod";
        ingressAnnotations["traefik.ingress.kubernetes.io/router.tls"] = "true";
      }

      this.ingress = new k8s.networking.v1.Ingress(`${name}-dashboard-ingress`, {
        metadata: {
          name: `${clusterName}-dashboard`,
          namespace: args.namespace,
          annotations: ingressAnnotations,
        },
        spec: {
          ingressClassName: args.ingress.className || "traefik",
          tls: args.ingress.tls?.enabled ? [{
            hosts: [args.ingress.domain],
            secretName: args.ingress.tls.secretName || `${clusterName}-dashboard-tls`,
          }] : undefined,
          rules: [{
            host: args.ingress.domain,
            http: {
              paths: [{
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: `rook-ceph-mgr-dashboard`,
                    port: {
                      name: "http-dashboard",
                    },
                  },
                },
              }],
            },
          }],
        },
      }, {
        parent: this,
        dependsOn: [this.cephCluster]
      });
    }

    // Step 7: Deploy Ceph toolbox (if enabled)
    if (args.toolbox?.enabled) {
      this.toolbox = new k8s.apps.v1.Deployment(`${name}-toolbox`, {
        metadata: {
          name: "rook-ceph-tools",
          namespace: args.namespace,
          labels: {
            app: "rook-ceph-tools",
          },
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: "rook-ceph-tools",
            },
          },
          template: {
            metadata: {
              labels: {
                app: "rook-ceph-tools",
              },
            },
            spec: {
              dnsPolicy: "ClusterFirstWithHostNet",
              serviceAccountName: "rook-ceph-default",
              containers: [{
                name: "rook-ceph-tools",
                image: args.toolbox.image || DOCKER_IMAGES.CEPH.image,
                command: [
                  "/bin/bash",
                  "-c",
                  `# Replicate the script from toolbox.sh inline so the ceph image
# can be run directly, instead of requiring the rook toolbox
CEPH_CONFIG="/etc/ceph/ceph.conf"
MON_CONFIG="/etc/rook/mon-endpoints"
KEYRING_FILE="/etc/ceph/keyring"

# create a ceph config file in its default location so ceph/rados tools can be used
# without specifying any arguments
write_endpoints() {
  endpoints=$(cat \${MON_CONFIG})

  # filter out the mon names
  # external cluster can have numbers or hyphens in mon names, handling them in regex
  # shellcheck disable=SC2001
  mon_endpoints=$(echo "\${endpoints}"| sed 's/[a-z0-9_-]\\+=//g')

  DATE=$(date)
  echo "$DATE writing mon endpoints to \${CEPH_CONFIG}: \${endpoints}"
    cat <<EOF > \${CEPH_CONFIG}
[global]
mon_host = \${mon_endpoints}

[client.admin]
keyring = \${KEYRING_FILE}
EOF
}

# watch the endpoints config file and update if the mon endpoints ever change
watch_endpoints() {
  # get the timestamp for the target of the soft link
  real_path=$(realpath \${MON_CONFIG})
  initial_time=$(stat -c %Z "\${real_path}")
  while true; do
    real_path=$(realpath \${MON_CONFIG})
    latest_time=$(stat -c %Z "\${real_path}")

    if [[ "\${latest_time}" != "\${initial_time}" ]]; then
      write_endpoints
      initial_time=\${latest_time}
    fi

    sleep 10
  done
}

# read the secret from an env var (for backward compatibility), or from the secret file
ceph_secret=\${ROOK_CEPH_SECRET}
if [[ "$ceph_secret" == "" ]]; then
  ceph_secret=$(cat /var/lib/rook-ceph-mon/secret.keyring)
fi

# create the keyring file
cat <<EOF > \${KEYRING_FILE}
[\${ROOK_CEPH_USERNAME}]
key = \${ceph_secret}
EOF

# write the initial config file
write_endpoints

# continuously update the mon endpoints if they fail over
watch_endpoints`,
                ],
                imagePullPolicy: "IfNotPresent",
                tty: true,
                securityContext: {
                  runAsNonRoot: true,
                  runAsUser: 2016,
                  runAsGroup: 2016,
                  capabilities: {
                    drop: ["ALL"],
                  },
                },
                env: [{
                  name: "ROOK_CEPH_USERNAME",
                  valueFrom: {
                    secretKeyRef: {
                      name: "rook-ceph-mon",
                      key: "ceph-username",
                    },
                  },
                }],
                volumeMounts: [
                  {
                    mountPath: "/etc/ceph",
                    name: "ceph-config",
                  },
                  {
                    name: "mon-endpoint-volume",
                    mountPath: "/etc/rook",
                  },
                  {
                    name: "ceph-admin-secret",
                    mountPath: "/var/lib/rook-ceph-mon",
                    readOnly: true,
                  },
                ],
              }],
              volumes: [
                {
                  name: "ceph-admin-secret",
                  secret: {
                    secretName: "rook-ceph-mon",
                    optional: false,
                    items: [{
                      key: "ceph-secret",
                      path: "secret.keyring",
                    }],
                  },
                },
                {
                  name: "mon-endpoint-volume",
                  configMap: {
                    name: "rook-ceph-mon-endpoints",
                    items: [{
                      key: "data",
                      path: "mon-endpoints",
                    }],
                  },
                },
                {
                  name: "ceph-config",
                  emptyDir: {},
                },
              ],
              tolerations: [{
                key: "node.kubernetes.io/unreachable",
                operator: "Exists",
                effect: "NoExecute",
                tolerationSeconds: 5,
              }],
            },
          },
        },
      }, {
        parent: this,
        dependsOn: [this.cephCluster]
      });
    }

    this.registerOutputs({
      externalSnapshotter: this.externalSnapshotter,
      rookCeph: this.rookCeph,
      cephCluster: this.cephCluster,
      filesystems: this.filesystems,
      storageClasses: this.storageClasses,
      ingress: this.ingress,
      toolbox: this.toolbox,
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

  /**
   * Returns the Ceph dashboard URL (if ingress is enabled)
   */
  public getDashboardUrl(): pulumi.Output<string | undefined> {
    if (this.ingress) {
      return pulumi.all([this.ingress.spec.rules, this.ingress.spec.tls]).apply(([rules, tls]) => {
        if (rules && rules.length > 0 && rules[0].host) {
          const protocol = tls && tls.length > 0 ? "https" : "http";
          return `${protocol}://${rules[0].host}` as string;
        }
        return undefined as string | undefined;
      });
    }
    return pulumi.output(undefined as string | undefined);
  }
}

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { StorageModule, StorageImplementation, BackupImplementation } from "../../src/modules/storage";

// Get configuration
const config = new pulumi.Config();

const namespace = new k8s.core.v1.Namespace("storage", {
  metadata: {
    name: "storage",
  },
});

// Create the storage module
const storage = new StorageModule("storage", {
  namespace: namespace.metadata.name,
  storageImplementation: StorageImplementation.ROOK_CEPH,
  backupImplementation: BackupImplementation.VELERO,

  // Ceph cluster configuration with node-specific storage topology
  cephCluster: {
    storage: {
      useAllNodes: false,
      useAllDevices: false,
      // Node-specific storage topology - define which nodes use which storage devices
      nodes: [
        {
          name: "sol",
          devices: [
            { name: "/dev/nvme0n1p3" },
          ],
        },
        {
          name: "luna",
          devices: [
            { name: "/dev/nvme0n1p3" },
          ],
        },
        {
          name: "aurora",
          devices: [
            { name: "/dev/nvme0n1p3" },
          ],
        },
      ],
    },
    monitorCount: 3,
  },

  // Storage class configurations with filesystem definitions
  storageClasses: [
    // Shared filesystem for RWX storage
    {
      name: "shared-fs",
      isDefault: true,
      reclaimPolicy: "Delete",
      allowVolumeExpansion: true,
      volumeBindingMode: "Immediate",
      filesystem: {
        metadataPool: {
          name: "shared-fs-metadata",
          replication: {
            size: 3,
            requireSafeReplicaSize: true,
          },
          deviceClass: "nvme",
        },
        dataPools: [{
          name: "shared-fs-data",
          failureDomain: "host",
          replication: {
            size: 3,
            requireSafeReplicaSize: true,
          },
          deviceClass: "nvme",
        }],
        metadataServer: {
          activeCount: 1,
          activeStandby: true,
          resources: {
            requests: {
              cpu: "500m",
              memory: "1Gi",
            },
            limits: {
              cpu: "1000m",
              memory: "2Gi",
            },
          },
        },
      },
    },
  ],

  // Ingress configuration for Ceph dashboard
  ingress: {
    enabled: true,
    domain: "ceph.romulus.holdenitdown.net",
    className: "internal",
    annotations: {
      "cert-manager.io/cluster-issuer": "letsencrypt-prod",
    },
    tls: {
      enabled: true,
    },
  },

  toolbox: {
    enabled: true,
  },

  // Backup strategy
  // backupStrategy: {
  //   enableSnapshotBackups: true,
  //   enableFilesystemBackups: true,
  //   defaultBackupTTL: "720h", // 30 days
  //   backupStorageLocations: [
  //     {
  //       name: "default",
  //       provider: "aws",
  //       bucket: config.require("backup-bucket"),
  //       region: config.get("backup-region") || "us-west-2",
  //       default: true,
  //       credential: {
  //         name: "cloud-credentials",
  //         key: "cloud",
  //       },
  //     },
  //   ],
  //   volumeSnapshotLocations: [
  //     {
  //       name: "default",
  //       provider: "csi",
  //       config: {
  //         region: config.get("backup-region") || "us-west-2",
  //       },
  //     },
  //   ],
  // },
}, {
  dependsOn: [namespace],
});

// Export key information
export const storageNamespace = namespace.metadata.name;
export const filesystemNames = storage.getFilesystemNames();
export const storageClassNames = storage.getStorageClassNames();
export const clusterResource = storage.getClusterResource().metadata.name;
export const dashboardUrl = storage.getDashboardUrl(); 

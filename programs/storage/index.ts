import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { StorageModule, StorageImplementation, StorageClassConfig, IngressConfig } from "../../src/modules/storage";
import { StorageConfig } from "../../src/components/rook-ceph-cluster";

// Get configuration
const config = new pulumi.Config();

interface CephClusterConfig {
  clusterName: string;
  monitorCount: number;
  mgrCount?: number;
  allowMultipleMonPerNode?: boolean;
  allowMultipleMgrPerNode?: boolean;
  obcAllowedAdditionalConfigFields?: string;
  storage: StorageConfig;
}

interface ToolboxConfig {
  enabled: boolean;
}

// Parse cluster-specific configuration from stack config
// This configuration is environment-specific and defined in Pulumi.<stack>.yaml files
const cephClusterConfig = config.requireObject<CephClusterConfig>("ceph-cluster");
const storageClassConfigs = config.requireObject<StorageClassConfig[]>("storage-classes");
const ingressConfig = config.requireObject<IngressConfig>("ingress");
const toolboxConfig = config.requireObject<ToolboxConfig>("toolbox");

const namespace = new k8s.core.v1.Namespace("storage", {
  metadata: {
    name: "storage",
  },
});

// Create the storage module
const storage = new StorageModule("storage", {
  namespace: namespace.metadata.name,
  storageImplementation: StorageImplementation.ROOK_CEPH,

  // Ceph cluster configuration from stack config
  cephCluster: {
    clusterName: cephClusterConfig.clusterName,
    storage: cephClusterConfig.storage,
    monitorCount: cephClusterConfig.monitorCount,
    mgrCount: cephClusterConfig.mgrCount,
    allowMultipleMonPerNode: cephClusterConfig.allowMultipleMonPerNode,
    allowMultipleMgrPerNode: cephClusterConfig.allowMultipleMgrPerNode,
    obcAllowedAdditionalConfigFields: cephClusterConfig.obcAllowedAdditionalConfigFields,
  },

  // Storage class configurations from stack config
  storageClasses: storageClassConfigs,

  // Ingress configuration from stack config
  ingress: ingressConfig,

  // Toolbox configuration from stack config
  toolbox: toolboxConfig,

}, {
  dependsOn: [namespace],
});

// Export key information
export const storageNamespace = namespace.metadata.name;
export const filesystemNames = storage.getFilesystemNames();
export const storageClassNames = storage.getStorageClassNames();
export const clusterResource = storage.getClusterResource().metadata.name;
export const dashboardUrl = storage.getDashboardUrl(); 

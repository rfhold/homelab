import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { K3sEtcdS3Config } from "../../src/components/k3s-etcd-s3-config";
import { Velero } from "../../src/components/velero";
import { getStackOutput } from "../../src/adapters/stack-reference";

interface BackupConfig {
  objectStoreStack: string;
  objectStoreName: string;
  bucketName: string;
  userName: string;
  secretName: string;
  s3Folder?: string;
  skipSslVerify?: boolean;
  insecure?: boolean;
  timeout?: string;
}

const config = new pulumi.Config("backup");

const backupConfig: BackupConfig = {
  objectStoreStack: config.require("object-store-stack"),
  objectStoreName: config.get("object-store-name") || "default",
  bucketName: config.get("bucket-name") || "etcd-snapshots",
  userName: config.get("user-name") || "backup",
  secretName: config.get("secret-name") || "etcd-s3-config",
  s3Folder: config.get("s3-folder"),
  skipSslVerify: config.getBoolean("skip-ssl-verify") || false,
  insecure: config.getBoolean("insecure") || false,
  timeout: config.get("timeout"),
};

const veleroNamespaceConfig = config.get("velero-namespace") || "velero";
const veleroClusterBackupBucket = config.get("velero-cluster-backup-bucket") || "cluster-backup";
const veleroClusterBackupUser = config.get("velero-cluster-backup-user") || "backup";
const veleroRepositoryPassword = config.requireSecret("velero-repository-password");
const veleroDefaultBackupTtl = config.get("velero-default-backup-ttl") || "720h";
const veleroBackupSchedule = config.get("velero-backup-schedule") || "0 2 * * *";
const veleroBackupScheduleEnabled = config.getBoolean("velero-backup-schedule-enabled") ?? true;

const organization = pulumi.getOrganization();

const objectStoreData = getStackOutput(
  {
    organization: organization,
    project: "object-storage",
    stack: backupConfig.objectStoreStack,
  },
  "objectStores"
).apply((stores: any) => {
  const store = stores[backupConfig.objectStoreName];
  const user = store.users[backupConfig.userName];
  const bucket = store.buckets[backupConfig.bucketName];

  const strippedEndpoint = store.endpoint.replace(/^https?:\/\//, "");

  return {
    endpoint: strippedEndpoint,
    bucketName: bucket.bucketName,
    accessKey: user.accessKey,
    secretKey: user.secretKey,
  };
});

const etcdS3Config = new K3sEtcdS3Config("k3s-etcd-s3", {
  namespace: "kube-system",
  secretName: backupConfig.secretName,
  s3Config: {
    endpoint: objectStoreData.endpoint,
    bucket: objectStoreData.bucketName,
    region: "auto",
    accessKey: objectStoreData.accessKey,
    secretKey: objectStoreData.secretKey,
    folder: backupConfig.s3Folder,
    skipSslVerify: backupConfig.skipSslVerify,
    insecure: backupConfig.insecure,
    timeout: backupConfig.timeout,
  },
});

const veleroObjectStoreData = getStackOutput(
  {
    organization: organization,
    project: "object-storage",
    stack: "pantheon",
  },
  "objectStores"
).apply((stores: any) => {
  const store = stores["default"];
  const user = store.users[veleroClusterBackupUser];
  const bucket = store.buckets[veleroClusterBackupBucket];

  return {
    endpoint: store.endpoint,
    bucketName: bucket.bucketName,
    accessKey: user.accessKey,
    secretKey: user.secretKey,
  };
});

const veleroNamespace = new k8s.core.v1.Namespace("velero-namespace", {
  metadata: {
    name: veleroNamespaceConfig,
  },
});

const velero = new Velero("velero", {
  namespace: veleroNamespace.metadata.name,
  s3Endpoint: veleroObjectStoreData.endpoint,
  s3Region: "auto",
  s3Bucket: veleroObjectStoreData.bucketName,
  s3AccessKey: veleroObjectStoreData.accessKey,
  s3SecretKey: veleroObjectStoreData.secretKey,
  repositoryPassword: veleroRepositoryPassword,
  defaultBackupTtl: veleroDefaultBackupTtl,
  garbageCollectionFrequency: "1h",
  defaultVolumesToFsBackup: false,
  schedules: {
    "nightly-backup": {
      schedule: veleroBackupSchedule,
      disabled: !veleroBackupScheduleEnabled,
      template: {
        ttl: veleroDefaultBackupTtl,
        defaultVolumesToFsBackup: false,
      },
    },
  },
});

export const secretName = etcdS3Config.secret.metadata.name;
export const secretNamespace = etcdS3Config.secret.metadata.namespace;
export const veleroNamespaceName = velero.namespace;
export const veleroBackupStorageLocation = velero.backupStorageLocation;
export const veleroS3Endpoint = veleroObjectStoreData.endpoint;
export const veleroS3Bucket = veleroObjectStoreData.bucketName;
export const veleroS3AccessKey = veleroObjectStoreData.accessKey;
export const veleroS3SecretKey = veleroObjectStoreData.secretKey;

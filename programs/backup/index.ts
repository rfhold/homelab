import * as pulumi from "@pulumi/pulumi";
import { K3sEtcdS3Config } from "../../src/components/k3s-etcd-s3-config";
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

  // remove https://
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

export const secretName = etcdS3Config.secret.metadata.name;
export const secretNamespace = etcdS3Config.secret.metadata.namespace;

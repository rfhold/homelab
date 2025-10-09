import * as pulumi from "@pulumi/pulumi";
import { RookCephObjectStore } from "../../src/components/rook-ceph-object-store";
import { RookCephObjectStoreUser } from "../../src/components/rook-ceph-object-store-user";
import { RookCephBucket } from "../../src/components/rook-ceph-bucket";
import { S3SyncCronJob } from "../../src/components/s3-sync-cronjob";
import { getStackOutput } from "../../src/adapters/stack-reference";

interface IssuerRef {
  name: string;
  kind?: "ClusterIssuer" | "Issuer";
}

interface PoolConfig {
  failureDomain?: string;
  replicaSize?: number;
  requireSafeReplicaSize?: boolean;
}

interface UserQuotas {
  maxBuckets?: number;
  maxSize?: string;
  maxObjects?: number;
}

interface UserCapabilities {
  user?: string;
  bucket?: string;
  usage?: string;
  metadata?: string;
  zone?: string;
}

interface UserConfig {
  name: string;
  displayName: string;
  quotas?: UserQuotas;
  capabilities?: UserCapabilities;
}

interface BucketAdditionalConfig {
  maxObjects?: string;
  maxSize?: string;
  bucketOwner?: string;
  bucketPolicy?: string;
}

interface BucketConfig {
  name: string;
  generateBucketName?: string;
  bucketName?: string;
  readUsers?: string[];
  writeUsers?: string[];
  additionalConfig?: BucketAdditionalConfig;
}

interface SyncJobSourceTarget {
  stack: string;
  objectStore: string;
  bucket: string;
  user: string;
  folder?: string;
}

interface SyncJobConfig {
  name: string;
  schedule: string;
  syncMode: "sync" | "bisync";
  source: SyncJobSourceTarget;
  target: SyncJobSourceTarget;
  resources?: {
    requests?: {
      memory?: string;
      cpu?: string;
    };
    limits?: {
      memory?: string;
      cpu?: string;
    };
  };
}

interface ObjectStoreConfig {
  name: string;
  hostname: string;
  gatewayInstances?: number;
  issuerRef: IssuerRef;
  serviceAnnotations?: { [key: string]: string };
  metadataPool?: PoolConfig;
  dataPool?: PoolConfig;
  reclaimPolicy?: "Delete" | "Retain";
  users?: UserConfig[];
  buckets?: BucketConfig[];
}

const config = new pulumi.Config("object-storage");

const namespace = config.require("namespace");
const objectStoresConfig = config.requireObject<ObjectStoreConfig[]>("object-stores");
const syncJobsConfig = config.getObject<SyncJobConfig[]>("sync-jobs") || [];
const organization = pulumi.getOrganization();

const outputs: {
  [key: string]: {
    endpoint: pulumi.Output<string>;
    storageClassName: pulumi.Output<string>;
    users: { [key: string]: { accessKey: pulumi.Output<string>; secretKey: pulumi.Output<string> } };
    buckets: { [key: string]: { bucketName: pulumi.Output<string>; endpoint: pulumi.Output<string> } };
  };
} = {};

for (const storeConfig of objectStoresConfig) {
  const storeName = `${storeConfig.name}-objectstore`;

  const objectStore = new RookCephObjectStore(storeName, {
    name: storeConfig.name,
    namespace: namespace,
    hostname: storeConfig.hostname,
    gatewayInstances: storeConfig.gatewayInstances || 3,
    issuerRef: {
      name: storeConfig.issuerRef.name,
      kind: storeConfig.issuerRef.kind || "ClusterIssuer",
    },
    serviceAnnotations: storeConfig.serviceAnnotations,
    metadataPool: storeConfig.metadataPool,
    dataPool: storeConfig.dataPool,
    reclaimPolicy: storeConfig.reclaimPolicy || "Delete",
  });

  const users: { [key: string]: RookCephObjectStoreUser } = {};
  const userOutputs: { [key: string]: { accessKey: pulumi.Output<string>; secretKey: pulumi.Output<string> } } = {};

  if (storeConfig.users) {
    for (const userConfig of storeConfig.users) {
      const userName = `${storeName}-user-${userConfig.name}`;

      users[userConfig.name] = new RookCephObjectStoreUser(userName, {
        name: userConfig.name,
        namespace: namespace,
        store: storeConfig.name,
        displayName: userConfig.displayName,
        quotas: userConfig.quotas,
        capabilities: userConfig.capabilities,
      }, {
        dependsOn: [objectStore],
      });

      userOutputs[userConfig.name] = {
        accessKey: users[userConfig.name].accessKey,
        secretKey: users[userConfig.name].secretKey,
      };
    }
  }

  const buckets: { [key: string]: RookCephBucket } = {};
  const bucketOutputs: { [key: string]: { bucketName: pulumi.Output<string>; endpoint: pulumi.Output<string> } } = {};

  if (storeConfig.buckets) {
    for (const bucketConfig of storeConfig.buckets) {
      const bucketName = `${storeName}-bucket-${bucketConfig.name}`;

      buckets[bucketConfig.name] = new RookCephBucket(bucketName, {
        name: bucketConfig.name,
        namespace: namespace,
        storageClassName: objectStore.storageClassName,
        generateBucketName: bucketConfig.generateBucketName,
        bucketName: bucketConfig.bucketName,
        readUsers: bucketConfig.readUsers,
        writeUsers: bucketConfig.writeUsers,
        additionalConfig: bucketConfig.additionalConfig,
      }, {
        dependsOn: [objectStore],
      });

      bucketOutputs[bucketConfig.name] = {
        bucketName: buckets[bucketConfig.name].bucketName,
        endpoint: buckets[bucketConfig.name].endpoint,
      };
    }
  }

  outputs[storeConfig.name] = {
    endpoint: objectStore.endpoint,
    storageClassName: objectStore.storageClassName,
    users: userOutputs,
    buckets: bucketOutputs,
  };
}

export const objectStores = outputs;

for (const syncJobConfig of syncJobsConfig) {
  const getStoreData = (jobStack: SyncJobSourceTarget) => {
    if (jobStack.stack === pulumi.getStack()) {
      const store = outputs[jobStack.objectStore];
      const user = store.users[jobStack.user];
      const bucket = store.buckets[jobStack.bucket];
      return pulumi.output({
        endpoint: store.endpoint,
        bucket: bucket.bucketName,
        folder: jobStack.folder,
        accessKey: user.accessKey,
        secretKey: user.secretKey,
      });
    } else {
      return getStackOutput(
        {
          organization: organization,
          project: "object-storage",
          stack: jobStack.stack,
        },
        "objectStores"
      ).apply((stores: any) => {
        const store = stores[jobStack.objectStore];
        const user = store.users[jobStack.user];
        const bucket = store.buckets[jobStack.bucket];
        return {
          endpoint: store.endpoint,
          bucket: bucket.bucketName,
          folder: jobStack.folder,
          accessKey: user.accessKey,
          secretKey: user.secretKey,
        };
      });
    }
  };

  const sourceData = getStoreData(syncJobConfig.source);
  const targetData = getStoreData(syncJobConfig.target);

  const sourceConfig: any = {
    endpoint: sourceData.endpoint,
    bucket: sourceData.bucket,
    accessKey: sourceData.accessKey,
    secretKey: sourceData.secretKey,
  };
  if (sourceData.folder) {
    sourceConfig.folder = sourceData.folder;
  }

  const targetConfig: any = {
    endpoint: targetData.endpoint,
    bucket: targetData.bucket,
    accessKey: targetData.accessKey,
    secretKey: targetData.secretKey,
  };
  if (targetData.folder) {
    targetConfig.folder = targetData.folder;
  }

  new S3SyncCronJob(syncJobConfig.name, {
    namespace: namespace,
    schedule: syncJobConfig.schedule,
    syncMode: syncJobConfig.syncMode,
    source: sourceConfig,
    target: targetConfig,
    resources: syncJobConfig.resources,
  });
}

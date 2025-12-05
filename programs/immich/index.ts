import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ImmichModule } from "../../src/modules/immich";

interface ResourceConfig {
  requests?: {
    memory?: string;
    cpu?: string;
  };
  limits?: {
    memory?: string;
    cpu?: string;
  };
}

interface StorageConfig {
  size?: string;
  storageClass?: string;
}

interface DatabaseConfig {
  storage?: StorageConfig;
  resources?: ResourceConfig;
  tolerations?: TolerationConfig[];
  nodeSelector?: { [key: string]: string };
}

interface RedisConfig {
  storage?: StorageConfig;
  resources?: ResourceConfig;
  tolerations?: TolerationConfig[];
  nodeSelector?: { [key: string]: string };
}

interface TolerationConfig {
  key: string;
  operator: string;
  value?: string;
  effect: string;
}

interface MachineLearningConfig {
  enabled?: boolean;
  replicas?: number;
  requestThreads?: number;
  modelInterOpThreads?: number;
  modelIntraOpThreads?: number;
  workers?: number;
  modelTtl?: number;
  preloadClipTextual?: string;
  preloadClipVisual?: string;
  preloadFacialRecognitionDetection?: string;
  preloadFacialRecognitionRecognition?: string;
  resources?: ResourceConfig;
  nodeSelector?: { [key: string]: string };
  tolerations?: TolerationConfig[];
}

interface ServerConfig {
  replicas?: number;
  resources?: ResourceConfig;
  nodeSelector?: { [key: string]: string };
  tolerations?: TolerationConfig[];
}

interface IngressConfig {
  enabled?: boolean;
  className?: string;
  host: string;
  annotations?: { [key: string]: string };
  tls?: {
    enabled?: boolean;
    secretName?: string;
  };
}

interface AppConfig {
  libraryStorage?: StorageConfig;
  modelCacheStorage?: StorageConfig;
  machineLearning?: MachineLearningConfig;
  server?: ServerConfig;
  ingress?: IngressConfig;
  imageTag?: string;
}

const config = new pulumi.Config();

export const namespaceName = config.get("namespace") ?? "immich";
const domain = config.get("domain");

const databaseConfig = config.getObject<DatabaseConfig>("database");
const redisConfig = config.getObject<RedisConfig>("redis");
const appConfig = config.getObject<AppConfig>("app");

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const immich = new ImmichModule("immich", {
  namespace: namespace.metadata.name,
  database: {
    storage: databaseConfig?.storage,
    resources: databaseConfig?.resources,
    tolerations: databaseConfig?.tolerations,
    nodeSelector: databaseConfig?.nodeSelector,
  },
  redis: {
    storage: redisConfig?.storage,
    resources: redisConfig?.resources,
    tolerations: redisConfig?.tolerations,
    nodeSelector: redisConfig?.nodeSelector,
  },
  app: {
    libraryStorage: appConfig?.libraryStorage,
    modelCacheStorage: appConfig?.modelCacheStorage,
    machineLearning: appConfig?.machineLearning,
    server: appConfig?.server,
    ingress: appConfig?.ingress && domain ? {
      enabled: appConfig.ingress.enabled,
      className: appConfig.ingress.className,
      host: domain,
      annotations: appConfig.ingress.annotations,
      tls: appConfig.ingress.tls,
    } : undefined,
    imageTag: appConfig?.imageTag,
  },
}, { dependsOn: [namespace] });

export const ingressUrl = immich.getIngressUrl();

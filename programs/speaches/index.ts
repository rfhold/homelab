import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Speaches } from "../../src/components/speaches";

const config = new pulumi.Config("speaches");

interface ModelCacheConfig {
  size: string;
  storageClass?: string;
  nfs?: {
    server: string;
    path: string;
    readOnly?: boolean;
  };
}

interface WhisperConfig {
  inferenceDevice: "auto" | "cpu" | "cuda";
  computeType: "default" | "int8" | "float16" | "float32";
  useBatchedMode: boolean;
  cpuThreads?: number;
  numWorkers?: number;
}

interface ResourcesConfig {
  requests: {
    memory: string;
    cpu: string;
  };
  limits: {
    memory: string;
    cpu: string;
  };
}

interface GpuResourcesConfig {
  limits: {
    "nvidia.com/gpu": number;
  };
}

interface TolerationConfig {
  key?: string;
  operator?: string;
  value?: string;
  effect?: string;
}

interface IngressConfig {
  enabled: boolean;
  className: string;
  host: string;
  annotations?: { [key: string]: string };
  tls?: {
    enabled: boolean;
    secretName?: string;
  };
}

interface SpeachesStackConfig {
  modelCache: ModelCacheConfig;
  runtimeClassName?: string;
  whisper?: WhisperConfig;
  sttModelTtl?: number;
  ttsModelTtl?: number;
  enableUi?: boolean;
  logLevel?: "debug" | "info" | "warning" | "error" | "critical";
  resources?: ResourcesConfig;
  gpuResources?: GpuResourcesConfig;
  tolerations?: TolerationConfig[];
  nodeSelector?: { [key: string]: string };
  ingress?: IngressConfig;
}

const speachesConfig = config.requireObject<SpeachesStackConfig>("config");

const apiKey = config.getSecret("apiKey");

const namespace = new k8s.core.v1.Namespace("speaches", {
  metadata: {
    name: "speaches",
  },
});

const speaches = new Speaches("speaches", {
  namespace: namespace.metadata.name,
  
  modelCache: speachesConfig.modelCache,
  
  runtimeClassName: speachesConfig.runtimeClassName,
  
  whisper: speachesConfig.whisper,
  
  sttModelTtl: speachesConfig.sttModelTtl,
  ttsModelTtl: speachesConfig.ttsModelTtl,
  
  apiKey: apiKey,
  
  enableUi: speachesConfig.enableUi,
  logLevel: speachesConfig.logLevel,
  
  resources: speachesConfig.resources,
  gpuResources: speachesConfig.gpuResources,
  
  tolerations: speachesConfig.tolerations,
  nodeSelector: speachesConfig.nodeSelector,
  
  ingress: speachesConfig.ingress,
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const serviceName = speaches.service.metadata.name;
export const deploymentName = speaches.deployment.metadata.name;
export const modelCachePvcName = speaches.modelCachePvc.metadata.name;
export const apiUrl = speaches.getApiUrl();
export const ingressUrl = speaches.getIngressUrl();
export const ingressHost = speachesConfig.ingress?.enabled ? speachesConfig.ingress.host : undefined;

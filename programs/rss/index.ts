import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { FreshRSS } from "../../src/components/freshrss";
import { StorageConfig } from "../../src/adapters/storage";

const config = new pulumi.Config("rss");

interface IngressConfig {
  enabled: boolean;
  className: string;
  host: string;
  annotations?: { [key: string]: string };
  tls?: {
    enabled: boolean;
    secretName: string;
  };
}

interface ResourceConfig {
  requests: {
    memory: string;
    cpu: string;
  };
  limits: {
    memory: string;
    cpu: string;
  };
}

interface FreshRSSConfig {
  timezone: string;
  cronMin: string;
  environment: "production" | "development";
}

interface RSSStorageConfig {
  data: StorageConfig;
  extensions?: StorageConfig;
}

const ingressConfig = config.requireObject<IngressConfig>("ingress");
const storageConfig = config.requireObject<RSSStorageConfig>("storage");
const resourceConfig = config.requireObject<ResourceConfig>("resources");
const freshRSSConfig = config.requireObject<FreshRSSConfig>("freshrss");
const replicas = config.getNumber("replicas") || 1;

const namespace = new k8s.core.v1.Namespace("rss", {
  metadata: {
    name: "rss",
  },
});

const freshRSS = new FreshRSS("freshrss", {
  namespace: namespace.metadata.name,
  
  timezone: freshRSSConfig.timezone,
  cronMin: freshRSSConfig.cronMin,
  environment: freshRSSConfig.environment,
  
  storage: storageConfig,
  resources: resourceConfig,
  replicas: replicas,
  ingress: ingressConfig,
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const freshRSSDeploymentName = freshRSS.deployment.metadata.name;
export const freshRSSServiceName = freshRSS.service.metadata.name;
export const freshRSSServiceEndpoint = freshRSS.getServiceEndpoint();
export const freshRSSIngressName = freshRSS.ingress?.metadata.name;
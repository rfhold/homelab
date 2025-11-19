import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { TrmnlLaravel } from "../../src/components/trmnl-laravel";

const config = new pulumi.Config("trmnl");

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

interface StorageConfig {
  database?: {
    size: string;
    storageClass?: string;
  };
  generated?: {
    size: string;
    storageClass?: string;
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

const ingressConfig = config.requireObject<IngressConfig>("ingress");
const storageConfig = config.requireObject<StorageConfig>("storage");
const resourceConfig = config.requireObject<ResourceConfig>("resources");
const timezone = config.get("timezone") || "UTC";
const registrationEnabled = config.getBoolean("registrationEnabled") ?? true;
const proxyRefreshMinutes = config.getNumber("proxyRefreshMinutes");
const proxyBaseUrl = config.get("proxyBaseUrl");

const namespace = new k8s.core.v1.Namespace("trmnl", {
  metadata: {
    name: "trmnl",
  },
});

const trmnl = new TrmnlLaravel("trmnl", {
  namespace: namespace.metadata.name,
  
  timezone: timezone,
  registrationEnabled: registrationEnabled,
  proxyRefreshMinutes: proxyRefreshMinutes,
  proxyBaseUrl: proxyBaseUrl,

  storage: storageConfig,
  resources: resourceConfig,
  ingress: ingressConfig,
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const trmnlDeploymentName = trmnl.deployment.metadata.name;
export const trmnlServiceName = trmnl.service.metadata.name;
export const trmnlServiceUrl = trmnl.getServiceUrl();
export const trmnlIngressName = trmnl.ingress?.metadata.name;
export const trmnlIngressUrl = trmnl.getIngressUrl();

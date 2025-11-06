import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { OpenCode } from "../../src/components/opencode";

const config = new pulumi.Config("opencode");

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

interface StorageConfig {
  size: string;
  storageClass: string;
}

const ingressConfig = config.requireObject<IngressConfig>("ingress");
const apiIngressConfig = config.requireObject<IngressConfig>("apiIngress");
const webResourceConfig = config.requireObject<ResourceConfig>("webResources");
const functionsResourceConfig = config.requireObject<ResourceConfig>("functionsResources");
const storageConfig = config.requireObject<StorageConfig>("storage");
const replicas = config.getNumber("replicas") || 1;

const namespace = new k8s.core.v1.Namespace("opencode", {
  metadata: {
    name: "opencode",
  },
});

const opencode = new OpenCode("opencode", {
  namespace: namespace.metadata.name,

  storage: {
    size: storageConfig.size,
    storageClass: storageConfig.storageClass,
  },

  ingress: {
    enabled: ingressConfig.enabled,
    className: ingressConfig.className,
    host: ingressConfig.host,
    annotations: ingressConfig.annotations,
    tls: ingressConfig.tls ? {
      enabled: ingressConfig.tls.enabled,
      secretName: ingressConfig.tls.secretName,
    } : undefined,
  },

  apiIngress: {
    enabled: apiIngressConfig.enabled,
    className: apiIngressConfig.className,
    host: apiIngressConfig.host,
    annotations: apiIngressConfig.annotations,
    tls: apiIngressConfig.tls ? {
      enabled: apiIngressConfig.tls.enabled,
      secretName: apiIngressConfig.tls.secretName,
    } : undefined,
  },

  resources: {
    web: {
      requests: {
        memory: webResourceConfig.requests.memory,
        cpu: webResourceConfig.requests.cpu,
      },
      limits: {
        memory: webResourceConfig.limits.memory,
        cpu: webResourceConfig.limits.cpu,
      },
    },
    functions: {
      requests: {
        memory: functionsResourceConfig.requests.memory,
        cpu: functionsResourceConfig.requests.cpu,
      },
      limits: {
        memory: functionsResourceConfig.limits.memory,
        cpu: functionsResourceConfig.limits.cpu,
      },
    },
  },

  replicas,
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const opencodeUrl = opencode.getUrl();
export const webServiceUrl = opencode.getWebServiceUrl();
export const functionsServiceUrl = opencode.getFunctionsServiceUrl();

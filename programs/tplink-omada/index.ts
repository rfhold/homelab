import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { OmadaController } from "../../src/components/omada-controller";

const config = new pulumi.Config("omada");

interface ServiceConfig {
  type?: string;
  loadBalancerIP?: string;
  annotations?: { [key: string]: string };
  externalTrafficPolicy?: string;
}

interface StorageConfig {
  data?: {
    size: string;
    storageClass?: string;
  };
  logs?: {
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

interface TlsConfig {
  enabled: boolean;
  issuerRef: string;
  dnsNames: string[];
  duration?: string;
  renewBefore?: string;
}

const serviceConfig = config.getObject<ServiceConfig>("service");
const storageConfig = config.requireObject<StorageConfig>("storage");
const resourceConfig = config.requireObject<ResourceConfig>("resources");
const nodeSelector = config.getObject<{ [key: string]: string }>("nodeSelector");
const timezone = config.get("timezone") || "UTC";
const blockDhcp = config.getBoolean("blockDhcp") ?? true;
const tlsConfig = config.getObject<TlsConfig>("tls");

const namespace = new k8s.core.v1.Namespace("omada", {
  metadata: {
    name: "omada",
  },
});

const omada = new OmadaController("omada-controller", {
  namespace: namespace.metadata.name,

  timezone: timezone,
  blockDhcp: blockDhcp,
  nodeSelector: nodeSelector,

  storage: storageConfig,
  resources: resourceConfig,
  service: serviceConfig,
  tls: tlsConfig,
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const omadaDeploymentName = omada.deployment.metadata.name;
export const omadaServiceName = omada.service.metadata.name;
export const omadaServiceEndpoint = omada.getServiceEndpoint();
export const omadaLoadBalancerIP = omada.getLoadBalancerIP();

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Grocy } from "../../src/components/grocy";

const config = new pulumi.Config("home-management");

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
  size: string;
  storageClass?: string;
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

const namespace = new k8s.core.v1.Namespace("home-management", {
  metadata: {
    name: "home-management",
  },
});

const grocy = new Grocy("grocy", {
  namespace: namespace.metadata.name,

  storage: storageConfig,
  resources: resourceConfig,
  ingress: ingressConfig,
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const grocyDeploymentName = grocy.deployment.metadata.name;
export const grocyServiceName = grocy.service.metadata.name;
export const grocyServiceEndpoint = grocy.getServiceEndpoint();
export const grocyIngressName = grocy.ingress?.metadata.name;

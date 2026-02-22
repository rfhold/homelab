import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Radicale } from "../../src/components/radicale";

const config = new pulumi.Config("dav");

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

interface GatewayRefConfig {
  name: string;
  namespace: string;
}

const hostname = config.require("hostname");
const username = config.require("username");
const storageConfig = config.requireObject<StorageConfig>("storage");
const resourceConfig = config.requireObject<ResourceConfig>("resources");
const gatewayRef = config.requireObject<GatewayRefConfig>("gatewayRef");

const namespace = new k8s.core.v1.Namespace("dav", {
  metadata: {
    name: "dav",
  },
});

const radicale = new Radicale("radicale", {
  namespace: namespace.metadata.name,
  auth: {
    username,
  },
  storage: storageConfig,
  resources: resourceConfig,
  httpRoute: {
    enabled: true,
    hostname,
    gatewayRef,
    requestTimeout: "30s",
  },
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const deploymentName = radicale.deployment.metadata.name;
export const serviceName = radicale.service.metadata.name;
export const serviceEndpoint = radicale.getServiceEndpoint();
export const password = pulumi.secret(radicale.password);

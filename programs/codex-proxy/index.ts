import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { CodexProxy } from "../../src/components/codex-proxy";
import { DOCKER_IMAGES } from "../../src/docker-images";

interface CodexProxyConfig {
  name?: string;
  image?: string;
  imagePullPolicy?: "Always" | "IfNotPresent" | "Never";
  replicas?: number;
  port?: number;
  storage?: {
    size?: string;
    storageClass?: string;
  };
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  nodeSelector?: Record<string, string>;
  tolerations?: k8s.types.input.core.v1.Toleration[];
  httpRoute?: {
    enabled?: boolean;
    hostname: string;
    gatewayRef: {
      name: string;
      namespace: string;
    };
    requestTimeout?: string;
  };
}

const config = new pulumi.Config("codex-proxy");
const namespaceName = config.require("namespace");
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};
const codexProxyConfig = config.requireObject<CodexProxyConfig>("config");

const namespaceResource = new k8s.core.v1.Namespace("codex-proxy-namespace", {
  metadata: { name: namespaceName },
});

const codexProxy = new CodexProxy(codexProxyConfig.name ?? "codex-proxy", {
  namespace: namespaceResource.metadata.name,
  workloadLabels: workloadLabels["codex-proxy"],
  name: codexProxyConfig.name,
  image: codexProxyConfig.image ?? DOCKER_IMAGES.CODEX_PROXY.image,
  imagePullPolicy: codexProxyConfig.imagePullPolicy,
  replicas: codexProxyConfig.replicas,
  port: codexProxyConfig.port,
  storage: codexProxyConfig.storage,
  resources: codexProxyConfig.resources,
  nodeSelector: codexProxyConfig.nodeSelector,
  tolerations: codexProxyConfig.tolerations,
  httpRoute: codexProxyConfig.httpRoute,
}, { dependsOn: [namespaceResource] });

export const serviceName = codexProxy.service.metadata.name;
export const serviceUrl = codexProxy.getServiceUrl();
export const namespace = namespaceName;
export const routeUrl = codexProxyConfig.httpRoute?.enabled
  ? pulumi.interpolate`https://${codexProxyConfig.httpRoute.hostname}`
  : undefined;

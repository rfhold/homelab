import * as pulumi from "@pulumi/pulumi";
import { KokoroApi } from "../../src/components/kokoro-api";

interface KokoroConfig {
  name?: string;
  image?: string;
  runtimeClassName: string;
  useGpu: boolean;
  defaultVoice?: string;
  enableWebPlayer?: boolean;
  downloadModel?: boolean;
  replicas?: number;
  resources: {
    requests: {
      memory: string;
      cpu: string;
    };
    limits: {
      memory: string;
      cpu: string;
    };
  };
  tolerations: Array<{
    key: string;
    operator: string;
    value: string;
    effect: string;
  }>;
  nodeSelector: Record<string, string>;
  ingress: {
    enabled: boolean;
    hostname: string;
    ingressClassName: string;
    annotations: Record<string, string>;
    tls: {
      enabled: boolean;
      secretName: string;
    };
  };
}

const config = new pulumi.Config("kokoro");
export const namespaceName = config.require("namespace");

const kokoroConfig = config.requireObject<KokoroConfig>("config");

const kokoro = new KokoroApi("kokoro-api", {
  namespace: namespaceName,
  name: kokoroConfig.name,
  image: kokoroConfig.image,
  replicas: kokoroConfig.replicas,
  useGpu: kokoroConfig.useGpu,
  defaultVoice: kokoroConfig.defaultVoice,
  enableWebPlayer: kokoroConfig.enableWebPlayer,
  downloadModel: kokoroConfig.downloadModel,
  resources: kokoroConfig.resources,
  runtimeClassName: kokoroConfig.runtimeClassName,
  tolerations: kokoroConfig.tolerations,
  nodeSelector: kokoroConfig.nodeSelector,
  ingress: kokoroConfig.ingress,
});

export const serviceName = kokoro.service.metadata.name;
export const serviceUrl = kokoro.getApiUrl();
export const ingressHostname = kokoroConfig.ingress.enabled ? kokoroConfig.ingress.hostname : undefined;
export const ingressUrl = kokoroConfig.ingress.enabled
  ? pulumi.interpolate`https://${kokoroConfig.ingress.hostname}`
  : undefined;

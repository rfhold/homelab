import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { AiInferenceModule, ModelInstanceConfig } from "../../src/modules/ai-inference";

const config = new pulumi.Config("ai-inference");
export const namespaceName = config.require("namespace");

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: { name: namespaceName },
});

const huggingfaceTokenValue = process.env.HF_TOKEN;
if (huggingfaceTokenValue === undefined) {
  throw new Error("Environment variable HF_TOKEN is not set");
}

const huggingfaceTokenStash = new pulumi.Stash("hf-token", {
  input: pulumi.secret(huggingfaceTokenValue),
});

const modelsConfig = config.requireObject<ModelInstanceConfig[]>("models");
const defaultsConfig = config.getObject<{
  runtimeClassName?: string;
  replicas?: number;
  image?: string;
  resources?: {
    requests?: { memory?: string; cpu?: string };
    limits?: { memory?: string; cpu?: string };
  };
  tolerations?: Array<{
    key?: string;
    operator?: string;
    value?: string;
    effect?: string;
  }>;
  nodeSelector?: { [key: string]: string };
  modelCache?: {
    size: string;
    storageClass?: string;
    nfs?: {
      server: string;
      path: string;
      readOnly?: boolean;
    };
  };
}>("defaults");

const sharedPoolConfig = config.getObject<{
  hostname: string;
  createHttpRoute?: boolean;
  tlsSecretName?: string;
  clusterIssuer?: string;
}>("sharedPool");

const aiInference = new AiInferenceModule("ai-inference", {
  namespace: namespace.metadata.name,
  huggingfaceToken: huggingfaceTokenStash.output.apply(v => String(v)),
  models: modelsConfig,
  defaults: defaultsConfig,
  sharedPool: sharedPoolConfig,
});

export const serviceNames = aiInference.serviceNames;
export const serviceUrls = aiInference.serviceUrls;
export const poolName = aiInference.poolNames;
export const poolHostname = aiInference.poolHostname;
export const gatewayRouteUrl = aiInference.gatewayRouteUrl;
export const modelNames = aiInference.getAllModelNames();

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { LlamaCpp } from "../../src/components/llama-cpp";
import { DOCKER_IMAGES } from "../../src/docker-images";

interface LlamaCppStackConfig {
  name?: string;
  namespace: string;
  image?: string;
  imagePullPolicy?: "Always" | "IfNotPresent" | "Never";
  model: {
    name: string;
    path?: string;
    huggingFaceRepo?: string;
    huggingFaceFile?: string;
    url?: string;
  };
  inference?: {
    host?: string;
    port?: number;
    contextSize?: number;
    gpuLayers?: number;
    threads?: number;
    parallel?: number;
    extraArgs?: string[];
  };
  runtimeClassName?: string;
  replicas?: number;
  resources?: {
    requests?: { [key: string]: string };
    limits?: { [key: string]: string };
  };
  tolerations?: Array<{
    key?: string;
    operator?: string;
    value?: string;
    effect?: string;
  }>;
  nodeSelector?: { [key: string]: string };
  hostDevices?: Array<{
    hostPath: string;
    mountPath: string;
    readOnly?: boolean;
  }>;
  modelCache?: {
    size: string;
    storageClass?: string;
    mountPath?: string;
    nfs?: {
      server: string;
      path: string;
      readOnly?: boolean;
    };
  };
  env?: { [key: string]: string };
  securityContext?: k8s.types.input.core.v1.SecurityContext;
  podSecurityContext?: k8s.types.input.core.v1.PodSecurityContext;
  livenessProbe?: k8s.types.input.core.v1.Probe;
  readinessProbe?: k8s.types.input.core.v1.Probe;
  startupProbe?: k8s.types.input.core.v1.Probe;
  service?: {
    port?: number;
    annotations?: { [key: string]: string };
  };
}

const config = new pulumi.Config("llama-cpp");
const llamaCppConfig = config.requireObject<LlamaCppStackConfig>("config");

const usesHuggingFace = llamaCppConfig.model.huggingFaceRepo !== undefined || llamaCppConfig.model.huggingFaceFile !== undefined;
const huggingfaceTokenValue = process.env.HF_TOKEN;

let huggingfaceToken: pulumi.Output<string> | undefined;
if (usesHuggingFace) {
  if (huggingfaceTokenValue === undefined) {
    throw new Error("Environment variable HF_TOKEN is not set");
  }

  const huggingfaceTokenStash = new pulumi.Stash("hf-token", {
    input: pulumi.secret(huggingfaceTokenValue),
  });
  huggingfaceToken = huggingfaceTokenStash.output.apply(v => String(v));
}

const namespace = new k8s.core.v1.Namespace(llamaCppConfig.namespace, {
  metadata: { name: llamaCppConfig.namespace },
}, {
  retainOnDelete: true,
});

const llamaCpp = new LlamaCpp(llamaCppConfig.name ?? "llama-cpp", {
  namespace: namespace.metadata.name,
  modelPath: llamaCppConfig.model.path,
  huggingFaceRepo: llamaCppConfig.model.huggingFaceRepo,
  huggingFaceFile: llamaCppConfig.model.huggingFaceFile,
  huggingfaceToken,
  modelUrl: llamaCppConfig.model.url,
  alias: llamaCppConfig.model.name,
  host: llamaCppConfig.inference?.host,
  port: llamaCppConfig.inference?.port,
  contextSize: llamaCppConfig.inference?.contextSize,
  gpuLayers: llamaCppConfig.inference?.gpuLayers,
  threads: llamaCppConfig.inference?.threads,
  parallel: llamaCppConfig.inference?.parallel,
  extraArgs: llamaCppConfig.inference?.extraArgs,
  runtimeClassName: llamaCppConfig.runtimeClassName,
  replicas: llamaCppConfig.replicas,
  image: llamaCppConfig.image ?? DOCKER_IMAGES.LLAMA_CPP_SERVER_CUDA.image,
  imagePullPolicy: llamaCppConfig.imagePullPolicy,
  modelCache: llamaCppConfig.modelCache,
  resources: llamaCppConfig.resources,
  tolerations: llamaCppConfig.tolerations,
  nodeSelector: llamaCppConfig.nodeSelector,
  hostDevices: llamaCppConfig.hostDevices,
  env: llamaCppConfig.env,
  securityContext: llamaCppConfig.securityContext,
  podSecurityContext: llamaCppConfig.podSecurityContext,
  livenessProbe: llamaCppConfig.livenessProbe,
  readinessProbe: llamaCppConfig.readinessProbe,
  startupProbe: llamaCppConfig.startupProbe,
  service: llamaCppConfig.service,
});

export const serviceName = llamaCpp.service.metadata.name;
export const serviceUrl = llamaCpp.getApiUrl();
export const modelName = llamaCppConfig.model.name;

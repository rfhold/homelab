import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Vllm, VllmKvCacheDtype, VllmSpeculativeConfig } from "../../src/components/vllm";
import { DOCKER_IMAGES } from "../../src/docker-images";

interface VllmStackConfig {
  name?: string;
  namespace: string;
  createNamespace?: boolean;
  reuseRetainedHfToken?: boolean;
  image?: string;
  imagePullPolicy?: "Always" | "IfNotPresent" | "Never";
  model: {
    name: string;
    tokenizer?: string;
    trustRemoteCode?: boolean;
    dtype?: "auto" | "float16" | "bfloat16" | "float32";
    maxModelLen?: number;
    quantization?: string;
  };
  inference?: {
    tensorParallelSize?: number;
    gpuMemoryUtilization?: number;
    maxNumSeqs?: number;
    maxNumBatchedTokens?: number;
    kvCacheDtype?: VllmKvCacheDtype;
    calculateKvScales?: boolean;
    enableChunkedPrefill?: boolean;
    enableExpertParallel?: boolean;
    enableAutoToolChoice?: boolean;
    toolCallParser?: string;
    reasoningParser?: string;
    enforceEager?: boolean;
    defaultChatTemplateKwargs?: { [key: string]: boolean | string | number };
    runner?: "generate" | "pooling";
    compilationConfig?: { [key: string]: string | number | boolean };
    speculativeConfig?: VllmSpeculativeConfig;
  };
  runtimeClassName?: string;
  replicas?: number;
  deploymentStrategy?: k8s.types.input.apps.v1.DeploymentStrategy;
  startupProbe?: k8s.types.input.core.v1.Probe;
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
  modelCache?: {
    size: string;
    storageClass?: string;
    nfs?: {
      server: string;
      path: string;
      readOnly?: boolean;
    };
  };
  env?: { [key: string]: string };
  securityContext?: {
    capabilities?: {
      add?: string[];
      drop?: string[];
    };
    seccompProfile?: {
      type: string;
      localhostProfile?: string;
    };
    privileged?: boolean;
  };
  podSecurityContext?: {
    supplementalGroups?: number[];
  };
  hostIPC?: boolean;
  hostDevices?: string[];
}

const config = new pulumi.Config("vllm");
const vllmConfig = config.requireObject<VllmStackConfig>("config");

const huggingfaceTokenValue = process.env.HF_TOKEN;
if (huggingfaceTokenValue === undefined && !vllmConfig.reuseRetainedHfToken) {
  throw new Error("Environment variable HF_TOKEN is not set and retained token reuse is not enabled");
}

const huggingfaceTokenStash = new pulumi.Stash("hf-token", {
  input: pulumi.secret(huggingfaceTokenValue ?? ""),
});

const namespace = vllmConfig.createNamespace ?? true
  ? new k8s.core.v1.Namespace(vllmConfig.namespace, {
      metadata: { name: vllmConfig.namespace },
    }, {
      retainOnDelete: true,
    })
  : k8s.core.v1.Namespace.get(vllmConfig.namespace, vllmConfig.namespace);

const vllm = new Vllm(vllmConfig.name ?? "vllm", {
  namespace: namespace.metadata.name,
  model: vllmConfig.model.name,
  tokenizer: vllmConfig.model.tokenizer,
  trustRemoteCode: vllmConfig.model.trustRemoteCode,
  dtype: vllmConfig.model.dtype,
  maxModelLen: vllmConfig.model.maxModelLen,
  quantization: vllmConfig.model.quantization,
  huggingfaceToken: huggingfaceTokenStash.output.apply(v => String(v)),
  tensorParallelSize: vllmConfig.inference?.tensorParallelSize,
  gpuMemoryUtilization: vllmConfig.inference?.gpuMemoryUtilization,
  maxNumSeqs: vllmConfig.inference?.maxNumSeqs,
  maxNumBatchedTokens: vllmConfig.inference?.maxNumBatchedTokens,
  kvCacheDtype: vllmConfig.inference?.kvCacheDtype,
  calculateKvScales: vllmConfig.inference?.calculateKvScales,
  enableChunkedPrefill: vllmConfig.inference?.enableChunkedPrefill,
  enableExpertParallel: vllmConfig.inference?.enableExpertParallel,
  enableAutoToolChoice: vllmConfig.inference?.enableAutoToolChoice,
  toolCallParser: vllmConfig.inference?.toolCallParser,
  reasoningParser: vllmConfig.inference?.reasoningParser,
  enforceEager: vllmConfig.inference?.enforceEager,
  defaultChatTemplateKwargs: vllmConfig.inference?.defaultChatTemplateKwargs,
  runner: vllmConfig.inference?.runner,
  compilationConfig: vllmConfig.inference?.compilationConfig,
  speculativeConfig: vllmConfig.inference?.speculativeConfig,
  runtimeClassName: vllmConfig.runtimeClassName,
  replicas: vllmConfig.replicas,
  deploymentStrategy: vllmConfig.deploymentStrategy,
  startupProbe: vllmConfig.startupProbe,
  image: vllmConfig.image ?? DOCKER_IMAGES.VLLM.image,
  imagePullPolicy: vllmConfig.imagePullPolicy,
  modelCache: vllmConfig.modelCache,
  resources: vllmConfig.resources,
  tolerations: vllmConfig.tolerations,
  nodeSelector: vllmConfig.nodeSelector,
  env: vllmConfig.env,
  securityContext: vllmConfig.securityContext,
  podSecurityContext: vllmConfig.podSecurityContext,
  hostIPC: vllmConfig.hostIPC,
  hostDevices: vllmConfig.hostDevices,
});

export const serviceName = vllm.service.metadata.name;
export const serviceUrl = vllm.getApiUrl();
export const modelName = vllmConfig.model.name;

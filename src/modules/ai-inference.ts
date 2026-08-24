import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Vllm, VllmKvCacheDtype, VllmSpeculativeConfig } from "../components/vllm";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

/**
 * Configuration for a model to deploy
 */
export interface ModelConfig {
  name: string;
  trustRemoteCode?: boolean;
  dtype?: "auto" | "float16" | "bfloat16" | "float32";
  maxModelLen?: number;
  quantization?: string;
}

/**
 * Inference-specific configuration options
 */
export interface InferenceConfig {
  tensorParallelSize?: number;
  gpuMemoryUtilization?: number;
  maxNumSeqs?: number;
  maxNumBatchedTokens?: number;
  kvCacheDtype?: VllmKvCacheDtype;
  calculateKvScales?: boolean;
  enableChunkedPrefill?: boolean;
  enableAutoToolChoice?: boolean;
  enableExpertParallel?: boolean;
  toolCallParser?: string;
  reasoningParser?: string;
  enforceEager?: boolean;
  defaultChatTemplateKwargs?: { [key: string]: boolean | string | number };
  runner?: "generate" | "pooling";
  compilationConfig?: { [key: string]: string | number | boolean };
  speculativeConfig?: VllmSpeculativeConfig;
}

/**
 * Model cache storage configuration
 */
export interface ModelCacheConfig {
  size: string;
  storageClass?: string;
  nfs?: {
    server: string;
    path: string;
    readOnly?: boolean;
  };
}

/**
 * CPU and memory resource configuration
 */
export interface ResourcesConfig {
  requests?: { [key: string]: string };
  limits?: { [key: string]: string };
}



/**
 * Kubernetes toleration configuration
 */
export interface TolerationConfig {
  key?: string;
  operator?: string;
  value?: string;
  effect?: string;
}

/**
 * Ingress configuration for individual model access
 */
export interface IngressConfig {
  enabled?: boolean;
  className?: string;
  host: string;
  annotations?: { [key: string]: string };
  tls?: {
    enabled?: boolean;
    secretName?: string;
  };
}

/**
 * Complete configuration for a single model instance
 */
export interface ModelInstanceConfig {
  model: ModelConfig;
  inference?: InferenceConfig;
  modelCache?: ModelCacheConfig;
  replicas?: number;
  image?: string;
  imagePullPolicy?: "Always" | "IfNotPresent" | "Never";
  resources?: ResourcesConfig;
  tolerations?: TolerationConfig[];
  nodeSelector?: { [key: string]: string };
  runtimeClassName?: string;
  deploymentStrategy?: k8s.types.input.apps.v1.DeploymentStrategy;
  startupProbe?: k8s.types.input.core.v1.Probe;
  ingress?: IngressConfig;
  weight?: number;
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

/**
 * AI Inference Module configuration
 * 
 * Configuration can be provided via Pulumi config YAML:
 * 
 * ```yaml
 * config:
 *   ai-inference:huggingfaceToken:
 *     secure: "encrypted-hf-token"
 *   ai-inference:namespace: "ai-inference"
 *   ai-inference:defaults:
 *     runtimeClassName: "nvidia"
 *     modelCache:
 *       size: "100Gi"
 *       storageClass: "ceph-block"
 *     resources:
 *       requests:
 *         memory: "8Gi"
 *         cpu: "4000m"
 *       limits:
 *         memory: "32Gi"
 *         cpu: "16000m"
 *     tolerations:
 *       - key: "cuda"
 *         operator: "Equal"
 *         value: "true"
 *         effect: "NoSchedule"
 *     nodeSelector:
 *       rholden.dev/gpu: "cuda"
 *   ai-inference:models:
 *     - model:
 *         name: "Qwen/Qwen2.5-Coder-7B-Instruct"
 *         trustRemoteCode: true
 *         dtype: "bfloat16"
 *         maxModelLen: 32768
 *       inference:
 *         tensorParallelSize: 1
 *         gpuMemoryUtilization: 0.95
 *         enableChunkedPrefill: true
 *       replicas: 2
 *       weight: 60
 *     - model:
 *         name: "meta-llama/Llama-3.1-8B-Instruct"
 *         dtype: "float16"
 *         maxModelLen: 8192
 *       inference:
 *         tensorParallelSize: 1
 *       replicas: 1
 *       weight: 40
 * ```
 */
export interface AiInferenceModuleArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;

  models: ModelInstanceConfig[];

  huggingfaceToken?: pulumi.Input<string>;

  defaults?: {
    runtimeClassName?: pulumi.Input<string>;
    replicas?: pulumi.Input<number>;
    image?: pulumi.Input<string>;
    resources?: ResourcesConfig;
    tolerations?: TolerationConfig[];
    nodeSelector?: { [key: string]: string };
    modelCache?: ModelCacheConfig;
  };
}

function getModelShortName(fullModelName: string): string {
  const parts = fullModelName.split('/');
  const modelName = parts[parts.length - 1];
  return modelName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * AI Inference Module - deploys multiple vLLM instances
 * 
 * This module orchestrates multiple vLLM model deployments. It enables:
 * - Multi-model deployment with consistent configuration
 * - Shared defaults with per-model overrides
 * 
 * @example
 * ```typescript
 * import { AiInferenceModule } from "../modules/ai-inference";
 * 
 * const aiInference = new AiInferenceModule("ai-models", {
 *   namespace: "ai-inference",
 *   huggingfaceToken: config.requireSecret("hf-token"),
 *   defaults: {
 *     runtimeClassName: "nvidia",
 *     tolerations: [{
 *       key: "cuda",
 *       operator: "Equal",
 *       value: "true",
 *       effect: "NoSchedule",
 *     }],
 *     nodeSelector: {
 *       "rholden.dev/gpu": "cuda",
 *     },
 *     modelCache: {
 *       size: "100Gi",
 *       storageClass: "ceph-block",
 *     },
 *   },
 *   models: [
 *     {
 *       model: {
 *         name: "Qwen/Qwen2.5-Coder-7B-Instruct",
 *         trustRemoteCode: true,
 *         dtype: "bfloat16",
 *         maxModelLen: 32768,
 *       },
 *       inference: {
 *         tensorParallelSize: 1,
 *         gpuMemoryUtilization: 0.95,
 *       },
 *       replicas: 2,
 *       weight: 50,
 *     },
 *     {
 *       model: {
 *         name: "meta-llama/Llama-3.1-8B-Instruct",
 *         dtype: "float16",
 *         maxModelLen: 8192,
 *       },
 *       inference: {
 *         tensorParallelSize: 2,
 *       },
 *       replicas: 1,
 *       weight: 50,
 *     },
 *   ],
 * });
 * 
 * export const modelNames = aiInference.getAllModelNames();
 * ```
 * 
 * @example
 * ```typescript
 * const codingInference = new AiInferenceModule("coding-models", {
 *   namespace: "ai-workspace",
 *   models: [
 *     {
 *       model: {
 *         name: "Qwen/Qwen2.5-Coder-32B-Instruct",
 *         trustRemoteCode: true,
 *       },
 *       inference: {
 *         tensorParallelSize: 4,
 *         enableChunkedPrefill: true,
 *       },
 *     },
 *   ],
 * });
 * ```
 * 
 * @see https://docs.vllm.ai/
 * @see https://gateway-api.sigs.k8s.io/
 */
export class AiInferenceModule extends pulumi.ComponentResource {
  public readonly vllmInstances: Map<string, Vllm>;
  public readonly serviceNames: pulumi.Output<string[]>;
  public readonly serviceUrls: pulumi.Output<string[]>;
  public readonly poolNames: pulumi.Output<string[]>;

  constructor(name: string, args: AiInferenceModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:AiInference", name, args, withWorkloadLabels(opts, args.workloadLabels));

    this.vllmInstances = new Map();
    const vllmDependencies: Vllm[] = [];

    args.models.forEach((modelConfig) => {
      const modelShortName = getModelShortName(modelConfig.model.name);
      const instanceName = `${name}-${modelShortName}`;

      const mergedResources: ResourcesConfig = {
        requests: {
          ...args.defaults?.resources?.requests,
          ...modelConfig.resources?.requests,
        },
        limits: {
          ...args.defaults?.resources?.limits,
          ...modelConfig.resources?.limits,
        },
      };

      const mergedTolerations = modelConfig.tolerations || args.defaults?.tolerations;
      const mergedNodeSelector = modelConfig.nodeSelector || args.defaults?.nodeSelector;

      const mergedModelCache = modelConfig.modelCache || args.defaults?.modelCache;

      const vllmInstance = new Vllm(instanceName, {
        namespace: args.namespace,

        model: modelConfig.model.name,
        trustRemoteCode: modelConfig.model.trustRemoteCode,
        dtype: modelConfig.model.dtype,
        maxModelLen: modelConfig.model.maxModelLen,
        quantization: modelConfig.model.quantization,

        huggingfaceToken: args.huggingfaceToken,

        tensorParallelSize: modelConfig.inference?.tensorParallelSize,
        gpuMemoryUtilization: modelConfig.inference?.gpuMemoryUtilization,
        maxNumSeqs: modelConfig.inference?.maxNumSeqs,
        maxNumBatchedTokens: modelConfig.inference?.maxNumBatchedTokens,
        kvCacheDtype: modelConfig.inference?.kvCacheDtype,
        calculateKvScales: modelConfig.inference?.calculateKvScales,
        enableChunkedPrefill: modelConfig.inference?.enableChunkedPrefill,
        enableExpertParallel: modelConfig.inference?.enableExpertParallel,
        enableAutoToolChoice: modelConfig.inference?.enableAutoToolChoice,
        toolCallParser: modelConfig.inference?.toolCallParser,
        reasoningParser: modelConfig.inference?.reasoningParser,
        enforceEager: modelConfig.inference?.enforceEager,
        defaultChatTemplateKwargs: modelConfig.inference?.defaultChatTemplateKwargs,
        runner: modelConfig.inference?.runner,
        compilationConfig: modelConfig.inference?.compilationConfig,
        speculativeConfig: modelConfig.inference?.speculativeConfig,

        runtimeClassName: modelConfig.runtimeClassName !== undefined ? modelConfig.runtimeClassName : args.defaults?.runtimeClassName,
        replicas: modelConfig.replicas ?? args.defaults?.replicas ?? 1,
        deploymentStrategy: modelConfig.deploymentStrategy,
        startupProbe: modelConfig.startupProbe,
        image: modelConfig.image || args.defaults?.image,
        imagePullPolicy: modelConfig.imagePullPolicy,

        modelCache: mergedModelCache,

        resources: mergedResources,

        tolerations: mergedTolerations,
        nodeSelector: mergedNodeSelector,

        env: modelConfig.env,
        securityContext: modelConfig.securityContext,
        podSecurityContext: modelConfig.podSecurityContext,
        hostIPC: modelConfig.hostIPC,
        hostDevices: modelConfig.hostDevices,

        ingress: modelConfig.ingress,
      }, {
        parent: this,
      });

      this.vllmInstances.set(modelShortName, vllmInstance);
      vllmDependencies.push(vllmInstance);
    });

    this.serviceNames = pulumi.output(
      Array.from(this.vllmInstances.values()).map(vllm => vllm.service.metadata.name)
    );

    this.serviceUrls = pulumi.output(
      Array.from(this.vllmInstances.values()).map(vllm => vllm.getApiUrl())
    );

    this.poolNames = pulumi.output([]);

    this.registerOutputs({
      vllmInstances: Array.from(this.vllmInstances.entries()).map(([name, instance]) => ({ name, instance })),
      serviceNames: this.serviceNames,
      serviceUrls: this.serviceUrls,
      poolNames: this.poolNames,
    });
  }

  public getServiceUrl(modelShortName: string): pulumi.Output<string> | undefined {
    const vllm = this.vllmInstances.get(modelShortName);
    return vllm?.getApiUrl();
  }

  public getServiceName(modelShortName: string): pulumi.Output<string> | undefined {
    const vllm = this.vllmInstances.get(modelShortName);
    return vllm?.service.metadata.name;
  }

  public getVllmInstance(modelShortName: string): Vllm | undefined {
    return this.vllmInstances.get(modelShortName);
  }

  public getAllModelNames(): string[] {
    return Array.from(this.vllmInstances.keys());
  }
}

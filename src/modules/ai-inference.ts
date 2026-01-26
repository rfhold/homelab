import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { BodyBasedRouter } from "../components/body-based-router";
import { Vllm } from "../components/vllm";
import { InferencePool } from "../components/inference-pool";

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
  enableChunkedPrefill?: boolean;
  enableAutoToolChoice?: boolean;
  swapSpace?: number;
  enableExpertParallel?: boolean;
  toolCallParser?: string;
  enforceEager?: boolean;
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
  requests?: {
    memory?: string;
    cpu?: string;
  };
  limits?: {
    memory?: string;
    cpu?: string;
  };
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
 * Shared inference pool configuration for Gateway API routing
 */
export interface SharedPoolConfig {
  hostname: string;
  createHttpRoute?: boolean;
  tlsSecretName?: string;
  clusterIssuer?: string;
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
 *   ai-inference:sharedPool:
 *     hostname: "inference.example.com"
 *     createHttpRoute: true
 * ```
 */
export interface AiInferenceModuleArgs {
  namespace: pulumi.Input<string>;

  models: ModelInstanceConfig[];

  sharedPool?: SharedPoolConfig;

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
 * AI Inference Module - deploys multiple vLLM instances with inference pool routing
 * 
 * This module orchestrates multiple vLLM model deployments and combines them using an InferencePool
 * for intelligent routing via Kubernetes Gateway API. It enables:
 * - Multi-model deployment with consistent configuration
 * - Inference pool with load balancing across models
 * - Gateway API HTTPRoute for unified external access
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
 *   sharedPool: {
 *     hostname: "inference.example.com",
 *   },
 * });
 * 
 * export const poolUrl = aiInference.getSharedPoolUrl();
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
 *   sharedPool: {
 *     hostname: "coding-ai.example.com",
 *     createHttpRoute: true,
 *   },
 * });
 * ```
 * 
 * @see https://docs.vllm.ai/
 * @see https://gateway-api.sigs.k8s.io/
 */
export class AiInferenceModule extends pulumi.ComponentResource {
  public readonly gateway?: k8s.apiextensions.CustomResource;
  public readonly vllmInstances: Map<string, Vllm>;
  public readonly inferencePools: Map<string, InferencePool>;
  public readonly serviceNames: pulumi.Output<string[]>;
  public readonly serviceUrls: pulumi.Output<string[]>;
  public readonly poolNames: pulumi.Output<string[]>;
  public readonly poolHostname?: pulumi.Output<string>;
  public readonly gatewayRouteUrl?: pulumi.Output<string>;

  constructor(name: string, args: AiInferenceModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:AiInference", name, args, opts);

    const bodyBasedRouter = new BodyBasedRouter(`${name}-router`, {
      namespace: args.namespace,
      provider: "none",
    }, { parent: this });

    if (args.sharedPool) {
      const hostname = args.sharedPool.hostname;
      const tlsSecretName = args.sharedPool.tlsSecretName || `${name}-gateway-tls`;
      const clusterIssuer = args.sharedPool.clusterIssuer || "letsencrypt-prod";

      this.gateway = new k8s.apiextensions.CustomResource(`${name}-gateway`, {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "Gateway",
        metadata: {
          name: `${name}-gateway`,
          namespace: args.namespace,
          annotations: {
            "cert-manager.io/cluster-issuer": clusterIssuer,
            "external-dns.alpha.kubernetes.io/hostname": hostname,
          },
        },
        spec: {
          gatewayClassName: "agentgateway",
          listeners: [{
            name: "https",
            protocol: "HTTPS",
            port: 443,
            hostname: hostname,
            tls: {
              mode: "Terminate",
              certificateRefs: [{
                kind: "Secret",
                name: tlsSecretName,
              }],
            },
          }],
        },
      }, {
        parent: this,
        dependsOn: [],
      });
    }

    this.vllmInstances = new Map();
    this.inferencePools = new Map();
    const vllmDependencies: Vllm[] = [];

    args.models.forEach((modelConfig) => {
      const modelShortName = getModelShortName(modelConfig.model.name);
      const instanceName = `${name}-${modelShortName}`;

      const mergedResources: ResourcesConfig = {
        requests: {
          memory: modelConfig.resources?.requests?.memory || args.defaults?.resources?.requests?.memory,
          cpu: modelConfig.resources?.requests?.cpu || args.defaults?.resources?.requests?.cpu,
        },
        limits: {
          memory: modelConfig.resources?.limits?.memory || args.defaults?.resources?.limits?.memory,
          cpu: modelConfig.resources?.limits?.cpu || args.defaults?.resources?.limits?.cpu,
        },
      };

      const mergedTolerations = modelConfig.tolerations || args.defaults?.tolerations;
      const mergedNodeSelector = modelConfig.nodeSelector || args.defaults?.nodeSelector;

      const mergedModelCache = modelConfig.modelCache || args.defaults?.modelCache;

      const gatewayDeps = this.gateway ? [this.gateway] : [];

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
        enableChunkedPrefill: modelConfig.inference?.enableChunkedPrefill,
        swapSpace: modelConfig.inference?.swapSpace,
        enableExpertParallel: modelConfig.inference?.enableExpertParallel,
        enableAutoToolChoice: modelConfig.inference?.enableAutoToolChoice,
        toolCallParser: modelConfig.inference?.toolCallParser,
        enforceEager: modelConfig.inference?.enforceEager,

        runtimeClassName: modelConfig.runtimeClassName || args.defaults?.runtimeClassName,
        replicas: modelConfig.replicas || args.defaults?.replicas || 1,
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
        dependsOn: gatewayDeps,
      });

      this.vllmInstances.set(modelShortName, vllmInstance);
      vllmDependencies.push(vllmInstance);

      if (args.sharedPool) {
        const createHttpRoute = args.sharedPool.createHttpRoute ?? true;
        const hostname = args.sharedPool.hostname;

        const poolDeps = this.gateway ? [vllmInstance, this.gateway] : [vllmInstance];

        const inferencePool = new InferencePool(`${instanceName}-pool`, {
          namespace: args.namespace,
          selector: {
            "app": instanceName,
          },
          targetPorts: [{ number: 8000 }],
          httpRoute: createHttpRoute ? {
            enabled: true,
            hostname: hostname,
            gatewayRef: {
              name: this.gateway ? pulumi.output(this.gateway.metadata.name) : `${name}-gateway`,
              namespace: args.namespace,
            },
            modelName: modelConfig.model.name,
            requestTimeout: "300s",
          } : undefined,
        }, {
          parent: this,
          dependsOn: poolDeps,
        });

        this.inferencePools.set(modelShortName, inferencePool);
      }
    });

    if (args.sharedPool && this.inferencePools.size > 0) {
      const hostname = args.sharedPool.hostname;
      this.poolHostname = pulumi.output(hostname);
      this.gatewayRouteUrl = pulumi.interpolate`https://${hostname}`;
    }

    this.serviceNames = pulumi.output(
      Array.from(this.vllmInstances.values()).map(vllm => vllm.service.metadata.name)
    );

    this.serviceUrls = pulumi.output(
      Array.from(this.vllmInstances.values()).map(vllm => vllm.getApiUrl())
    );

    this.poolNames = pulumi.output(
      Array.from(this.inferencePools.values()).map(pool => pool.getPoolName())
    );

    this.registerOutputs({
      gateway: this.gateway,
      vllmInstances: Array.from(this.vllmInstances.entries()).map(([name, instance]) => ({ name, instance })),
      inferencePools: Array.from(this.inferencePools.entries()).map(([name, pool]) => ({ name, pool })),
      serviceNames: this.serviceNames,
      serviceUrls: this.serviceUrls,
      poolNames: this.poolNames,
      poolHostname: this.poolHostname,
      gatewayRouteUrl: this.gatewayRouteUrl,
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

  public getSharedPoolUrl(): pulumi.Output<string> | undefined {
    return this.gatewayRouteUrl;
  }

  public getAllModelNames(): string[] {
    return Array.from(this.vllmInstances.keys());
  }
}

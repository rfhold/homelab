import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { getIngressUrl } from "../utils/kubernetes";
import { createPVC } from "../adapters/storage";

export interface VllmArgs {
  namespace: pulumi.Input<string>;

  model: pulumi.Input<string>;
  trustRemoteCode?: pulumi.Input<boolean>;
  dtype?: pulumi.Input<"auto" | "float16" | "bfloat16" | "float32">;
  maxModelLen?: pulumi.Input<number>;
  quantization?: pulumi.Input<string>;

  huggingfaceToken?: pulumi.Input<string>;

  tensorParallelSize?: pulumi.Input<number>;
  gpuMemoryUtilization?: pulumi.Input<number>;
  maxNumSeqs?: pulumi.Input<number>;
  enableChunkedPrefill?: pulumi.Input<boolean>;
  swapSpace?: pulumi.Input<number>;
  enableExpertParallel?: pulumi.Input<boolean>;
  enableAutoToolChoice?: pulumi.Input<boolean>;
  toolCallParser?: pulumi.Input<string>;

  runtimeClassName?: pulumi.Input<string>;
  replicas?: pulumi.Input<number>;

  image?: pulumi.Input<string>;
  imagePullPolicy?: pulumi.Input<"Always" | "IfNotPresent" | "Never">;

  env?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;

  securityContext?: pulumi.Input<{
    capabilities?: pulumi.Input<{
      add?: pulumi.Input<string[]>;
      drop?: pulumi.Input<string[]>;
    }>;
  }>;

  podSecurityContext?: pulumi.Input<{
    supplementalGroups?: pulumi.Input<number[]>;
  }>;

  hostDevices?: pulumi.Input<string[]>;

  modelCache?: {
    size: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
    nfs?: {
      server: pulumi.Input<string>;
      path: pulumi.Input<string>;
      readOnly?: pulumi.Input<boolean>;
    };
  };

  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };

  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;

  ingress?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };


}

/**
 * vLLM component - Fast and easy-to-use library for LLM inference and serving
 * 
 * This component deploys vLLM, which provides:
 * - High-throughput serving with PagedAttention
 * - Efficient memory management
 * - Continuous batching of incoming requests
 * - Fast model execution with CUDA/ROCm
 * - OpenAI-compatible API server
 * - Support for various quantization methods (AWQ, GPTQ, SqueezeLLM, FP8 KV Cache)
 * - Tensor parallelism for distributed inference
 * - Streaming output
 * - 
 * The service automatically downloads models from HuggingFace on first run
 * and optionally caches them in a persistent volume for faster startup.
 * 
 * @example
 * ```typescript
 * import { Vllm } from "../components/vllm";
 * 
 * const vllm = new Vllm("llama-3", {
 *   namespace: "ai-workspace",
 *   model: "meta-llama/Meta-Llama-3-8B-Instruct",
 *   runtimeClassName: "nvidia",
 *   dtype: "float16",
 *   maxModelLen: 8192,
 *   tensorParallelSize: 1,
 *   gpuMemoryUtilization: 0.9,
 *   modelCache: {
 *     size: "50Gi",
 *     storageClass: "ceph-block",
 *   },
 *   resources: {
 *     requests: { memory: "4Gi", cpu: "2000m" },
 *     limits: { memory: "16Gi", cpu: "8000m" },
 *   },
 *   tolerations: [{
 *     key: "cuda",
 *     operator: "Equal",
 *     value: "true",
 *     effect: "NoSchedule",
 *   }],
 *   nodeSelector: {
 *     "rholden.dev/gpu": "cuda",
 *   },
 *   ingress: {
 *     enabled: true,
 *     className: "traefik",
 *     host: "llama3.example.com",
 *     tls: { enabled: true },
 *   },
 * });
 * 
 * const apiUrl = vllm.getApiUrl();
 * ```
 * 
 * @example
 * ```typescript
 * const qwenVllm = new Vllm("qwen-coder", {
 *   namespace: "ai-workspace",
 *   model: "Qwen/Qwen2.5-Coder-7B-Instruct",
 *   trustRemoteCode: true,
 *   huggingfaceToken: config.requireSecret("hf-token"),
 *   runtimeClassName: "nvidia",
 *   dtype: "bfloat16",
 *   maxModelLen: 32768,
 *   tensorParallelSize: 2,
 *   gpuMemoryUtilization: 0.95,
 *   enableChunkedPrefill: true,
 *   maxNumSeqs: 256,
 *   modelCache: {
 *     size: "100Gi",
 *     storageClass: "ceph-block",
 *   },
 * });
 * ```
 * 
 * @example
 * ```typescript
 * const quantizedVllm = new Vllm("mistral-awq", {
 *   namespace: "ai-workspace",
 *   model: "TheBloke/Mistral-7B-Instruct-v0.2-AWQ",
 *   quantization: "awq",
 *   dtype: "auto",
 *   maxModelLen: 16384,
 * });
 * ```
 * 

 * @see https://docs.vllm.ai/
 * @see https://github.com/vllm-project/vllm
 * @see https://catalog.ngc.nvidia.com/orgs/nvidia/containers/vllm
 */
export class Vllm extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly modelCachePvc?: k8s.core.v1.PersistentVolumeClaim;
  public readonly secret?: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: VllmArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Vllm", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: name };

    if (args.modelCache) {
      this.modelCachePvc = createPVC(`${name}-model-cache`, {
        size: args.modelCache.size,
        storageClass: args.modelCache.storageClass,
        namespace: args.namespace,
        labels,
        nfs: args.modelCache.nfs,
      }, defaultResourceOptions);
    }

    if (args.huggingfaceToken) {
      this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
        metadata: {
          name: `${name}-secret`,
          namespace: args.namespace,
          labels,
        },
        stringData: {
          HF_TOKEN: args.huggingfaceToken,
        },
      }, defaultResourceOptions);
    }

    const vllmArgs = pulumi.all([
      args.model,
      args.trustRemoteCode,
      args.dtype,
      args.tensorParallelSize,
      args.gpuMemoryUtilization,
      args.maxModelLen,
      args.quantization,
      args.maxNumSeqs,
      args.enableChunkedPrefill,
      args.swapSpace,
      args.enableExpertParallel,
      args.enableAutoToolChoice,
      args.toolCallParser,
    ]).apply(([
      model,
      trustRemoteCode,
      dtype,
      tensorParallelSize,
      gpuMemoryUtilization,
      maxModelLen,
      quantization,
      maxNumSeqs,
      enableChunkedPrefill,
      swapSpace,
      enableExpertParallel,
      enableAutoToolChoice,
      toolCallParser,
    ]) => {
      const cmdArgs: string[] = [
        "--model", model as string,
        "--dtype", (dtype as string) || "auto",
        "--tensor-parallel-size", (tensorParallelSize !== undefined ? tensorParallelSize : 1).toString(),
        "--gpu-memory-utilization", (gpuMemoryUtilization !== undefined ? gpuMemoryUtilization : 0.9).toString(),
        "--swap-space", (swapSpace !== undefined ? swapSpace : 4).toString(),
      ];

      if (trustRemoteCode) {
        cmdArgs.push("--trust-remote-code");
      }

      if (maxModelLen !== undefined) {
        cmdArgs.push("--max-model-len", maxModelLen.toString());
      }

      if (quantization) {
        cmdArgs.push("--quantization", quantization as string);
      }

      if (maxNumSeqs !== undefined) {
        cmdArgs.push("--max-num-seqs", maxNumSeqs.toString());
      }

      if (enableChunkedPrefill) {
        cmdArgs.push("--enable-chunked-prefill");
      }

      if (enableExpertParallel) {
        cmdArgs.push("--enable-expert-parallel");
      }

      if (enableAutoToolChoice) {
        cmdArgs.push("--enable-auto-tool-choice");
      }

      if (toolCallParser) {
        cmdArgs.push("--tool-call-parser", toolCallParser as string);
      }

      return cmdArgs;
    });

    const env: k8s.types.input.core.v1.EnvVar[] = [];

    if (this.secret) {
      env.push({
        name: "HUGGING_FACE_HUB_TOKEN",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "HF_TOKEN",
          },
        },
      });
    }

    if (args.env) {
      Object.entries(args.env).forEach(([key, value]) => {
        env.push({
          name: key,
          value: pulumi.output(value),
        });
      });
    }

    const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [];
    const volumes: k8s.types.input.core.v1.Volume[] = [];

    if (this.modelCachePvc) {
      volumeMounts.push({
        name: "model-cache",
        mountPath: "/root/.cache/huggingface",
      });
      volumes.push({
        name: "model-cache",
        persistentVolumeClaim: {
          claimName: this.modelCachePvc.metadata.name,
        },
      });
    }

    if (args.hostDevices) {
      pulumi.output(args.hostDevices).apply((devices) => {
        devices.forEach((device, index) => {
          const deviceName = `device-${index}`;
          volumeMounts.push({
            name: deviceName,
            mountPath: device,
          });
          volumes.push({
            name: deviceName,
            hostPath: {
              path: device,
            },
          });
        });
      });
    }

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: args.replicas || 1,
        selector: {
          matchLabels: labels,
        },
        strategy: {
          type: "Recreate",
          rollingUpdate: undefined,
        },
        template: {
          metadata: {
            labels,
          },
          spec: {
            runtimeClassName: args.runtimeClassName,
            tolerations: args.tolerations,
            nodeSelector: args.nodeSelector,
            securityContext: args.podSecurityContext,
            containers: [{
              name: "vllm",
              image: args.image || "nvcr.io/nvidia/vllm:25.09-py3",
              imagePullPolicy: args.imagePullPolicy || "IfNotPresent",
              command: ["python3", "-m", "vllm.entrypoints.openai.api_server"],
              args: vllmArgs,
              ports: [{
                containerPort: 8000,
                name: "http",
              }],
              env,
              volumeMounts,
              resources: args.resources,
              securityContext: args.securityContext,
              livenessProbe: {
                httpGet: {
                  path: "/health",
                  port: "http",
                },
                initialDelaySeconds: 120,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/health",
                  port: "http",
                },
                initialDelaySeconds: 60,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/health",
                  port: "http",
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                failureThreshold: 60,
              },
            }],
            volumes,
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 8000,
          targetPort: 8000,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    if (args.ingress?.enabled) {
      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.className,
          tls: args.ingress.tls?.enabled ? [{
            hosts: [args.ingress.host],
            secretName: args.ingress.tls.secretName,
          }] : undefined,
          rules: [{
            host: args.ingress.host,
            http: {
              paths: [{
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: this.service.metadata.name,
                    port: {
                      number: 8000,
                    },
                  },
                },
              }],
            },
          }],
        },
      }, defaultResourceOptions);
    }



    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      modelCachePvc: this.modelCachePvc,
      secret: this.secret,
      ingress: this.ingress,
    });
  }

  public getApiUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8000`;
  }

  public getIngressUrl(): pulumi.Output<string> | undefined {
    if (this.ingress) {
      return getIngressUrl(this.ingress);
    }
    return undefined;
  }

  public getPoolTargetModel(poolName?: pulumi.Input<string>, weight?: pulumi.Input<number>) {
    return {
      name: poolName || this.service.metadata.name,
      weight: weight || 100,
      targetRef: {
        kind: "Service",
        name: this.service.metadata.name,
        namespace: this.service.metadata.namespace,
      },
    };
  }
}

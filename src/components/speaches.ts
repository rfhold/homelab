import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { getIngressUrl } from "../utils/kubernetes";
import { createPVC } from "../adapters/storage";

export interface SpeachesArgs {
  namespace: pulumi.Input<string>;
  
  modelCache: {
    size: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
    nfs?: {
      server: pulumi.Input<string>;
      path: pulumi.Input<string>;
      readOnly?: pulumi.Input<boolean>;
    };
  };
  
  runtimeClassName?: pulumi.Input<string>;
  
  image?: pulumi.Input<string>;
  replicas?: pulumi.Input<number>;
  
  whisper?: {
    inferenceDevice?: pulumi.Input<"auto" | "cpu" | "cuda">;
    computeType?: pulumi.Input<"default" | "int8" | "float16" | "float32">;
    useBatchedMode?: pulumi.Input<boolean>;
    cpuThreads?: pulumi.Input<number>;
    numWorkers?: pulumi.Input<number>;
  };
  
  sttModelTtl?: pulumi.Input<number>;
  ttsModelTtl?: pulumi.Input<number>;
  
  apiKey?: pulumi.Input<string>;
  
  chatCompletion?: {
    baseUrl: pulumi.Input<string>;
    apiKey?: pulumi.Input<string>;
  };
  
  enableUi?: pulumi.Input<boolean>;
  allowOrigins?: pulumi.Input<string[]>;
  logLevel?: pulumi.Input<"debug" | "info" | "warning" | "error" | "critical">;
  
  unstableVadFilter?: pulumi.Input<boolean>;
  
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
  
  gpuResources?: {
    limits?: {
      "nvidia.com/gpu"?: pulumi.Input<number>;
    };
  };
  
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  
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
 * Speaches component - OpenAI API-compatible STT/TTS service
 * 
 * This component deploys Speaches, which provides:
 * - Speech-to-Text (STT) via faster-whisper with CUDA support
 * - Text-to-Speech (TTS) via Piper and Kokoro models
 * - OpenAI-compatible API endpoints
 * - Realtime voice chat API
 * - Voice Activity Detection (VAD)
 * - Dynamic model loading/unloading
 * - Gradio UI for testing
 * 
 * The service automatically downloads models from HuggingFace on first run
 * and caches them in a persistent volume. Model TTL settings control when
 * models are unloaded from memory to save resources.
 * 
 * @example
 * ```typescript
 * import { Speaches } from "../components/speaches";
 * 
 * const speaches = new Speaches("speaches", {
 *   namespace: "ai-workspace",
 *   runtimeClassName: "nvidia",
 *   modelCache: {
 *     size: "50Gi",
 *     storageClass: "ceph-block",
 *   },
 *   whisper: {
 *     inferenceDevice: "cuda",
 *     computeType: "float16",
 *     useBatchedMode: true,
 *   },
 *   sttModelTtl: -1,
 *   ttsModelTtl: -1,
 *   apiKey: config.requireSecret("speaches-api-key"),
 *   resources: {
 *     requests: { memory: "4Gi", cpu: "2000m" },
 *     limits: { memory: "16Gi", cpu: "8000m" },
 *   },
 *   gpuResources: {
 *     limits: { "nvidia.com/gpu": 1 },
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
 *     host: "speaches.example.com",
 *     tls: { enabled: true },
 *   },
 * });
 * 
 * const apiUrl = speaches.getApiUrl();
 * ```
 * 
 * @see https://github.com/speaches-ai/speaches
 * @see https://speaches.ai/
 */
export class Speaches extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly modelCachePvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly secret?: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: SpeachesArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Speaches", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: "speaches", component: name };

    this.modelCachePvc = createPVC(`${name}-model-cache`, {
      size: args.modelCache.size,
      storageClass: args.modelCache.storageClass,
      namespace: args.namespace,
      labels,
      nfs: args.modelCache.nfs,
    }, defaultResourceOptions);

    if (args.apiKey || args.chatCompletion?.apiKey) {
      this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
        metadata: {
          name: `${name}-secret`,
          namespace: args.namespace,
          labels,
        },
        stringData: pulumi.all([
          args.apiKey,
          args.chatCompletion?.apiKey,
        ]).apply(([apiKey, chatApiKey]) => {
          const data: { [key: string]: string } = {};
          if (apiKey) data.API_KEY = apiKey as string;
          if (chatApiKey) data.CHAT_COMPLETION_API_KEY = chatApiKey as string;
          return data;
        }),
      }, defaultResourceOptions);
    }

    const env = pulumi.all([
      args.logLevel,
      args.sttModelTtl,
      args.ttsModelTtl,
      args.enableUi,
      args.allowOrigins,
      args.unstableVadFilter,
      args.whisper?.inferenceDevice,
      args.whisper?.computeType,
      args.whisper?.useBatchedMode,
      args.whisper?.cpuThreads,
      args.whisper?.numWorkers,
      args.chatCompletion?.baseUrl,
      args.runtimeClassName,
    ]).apply(([
      logLevel,
      sttModelTtl,
      ttsModelTtl,
      enableUi,
      allowOrigins,
      unstableVadFilter,
      inferenceDevice,
      computeType,
      useBatchedMode,
      cpuThreads,
      numWorkers,
      chatBaseUrl,
      runtimeClassName,
    ]) => {
      const envVars: k8s.types.input.core.v1.EnvVar[] = [
        { name: "LOG_LEVEL", value: (logLevel as string) || "info" },
        { name: "UVICORN_HOST", value: "0.0.0.0" },
        { name: "UVICORN_PORT", value: "8000" },
        { name: "STT_MODEL_TTL", value: (sttModelTtl !== undefined ? sttModelTtl : 300).toString() },
        { name: "TTS_MODEL_TTL", value: (ttsModelTtl !== undefined ? ttsModelTtl : 300).toString() },
        { name: "ENABLE_UI", value: (enableUi !== undefined ? enableUi : true).toString() },
        { name: "_UNSTABLE_VAD_FILTER", value: (unstableVadFilter !== undefined ? unstableVadFilter : true).toString() },
      ];

      if (allowOrigins && (allowOrigins as string[]).length > 0) {
        envVars.push({ name: "ALLOW_ORIGINS", value: JSON.stringify(allowOrigins) });
      }

      const device = runtimeClassName ? "cuda" : (inferenceDevice as string || "auto");
      envVars.push({ name: "WHISPER__INFERENCE_DEVICE", value: device });
      
      if (computeType) {
        envVars.push({ name: "WHISPER__COMPUTE_TYPE", value: computeType as string });
      }
      
      if (useBatchedMode !== undefined) {
        envVars.push({ name: "WHISPER__USE_BATCHED_MODE", value: useBatchedMode.toString() });
      }
      
      if (cpuThreads !== undefined) {
        envVars.push({ name: "WHISPER__CPU_THREADS", value: cpuThreads.toString() });
      }
      
      if (numWorkers !== undefined) {
        envVars.push({ name: "WHISPER__NUM_WORKERS", value: numWorkers.toString() });
      }

      if (chatBaseUrl) {
        envVars.push({ name: "CHAT_COMPLETION_BASE_URL", value: chatBaseUrl as string });
      }

      if (this.secret) {
        if (args.apiKey) {
          envVars.push({
            name: "API_KEY",
            valueFrom: {
              secretKeyRef: {
                name: this.secret.metadata.name,
                key: "API_KEY",
              },
            },
          });
        }
        
        if (args.chatCompletion?.apiKey) {
          envVars.push({
            name: "CHAT_COMPLETION_API_KEY",
            valueFrom: {
              secretKeyRef: {
                name: this.secret.metadata.name,
                key: "CHAT_COMPLETION_API_KEY",
              },
            },
          });
        }
      }

      return envVars;
    });

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
        template: {
          metadata: {
            labels,
          },
          spec: {
            runtimeClassName: args.runtimeClassName,
            tolerations: args.tolerations,
            nodeSelector: args.nodeSelector,
            containers: [{
              name: "speaches",
              image: args.image || DOCKER_IMAGES.SPEACHES.image,
              imagePullPolicy: "Always",
              ports: [{
                containerPort: 8000,
                name: "http",
              }],
              env,
              volumeMounts: [{
                name: "model-cache",
                mountPath: "/home/ubuntu/.cache/huggingface/hub",
              }],
              resources: pulumi.all([
                args.resources,
                args.gpuResources,
              ]).apply(([resources, gpuResources]) => {
                const limits: { [key: string]: pulumi.Input<string> } = {
                  memory: resources?.limits?.memory || "16Gi",
                  cpu: resources?.limits?.cpu || "8000m",
                };
                
                if (gpuResources?.limits?.["nvidia.com/gpu"]) {
                  limits["nvidia.com/gpu"] = gpuResources.limits["nvidia.com/gpu"].toString();
                }
                
                const resourceSpec: k8s.types.input.core.v1.ResourceRequirements = {
                  requests: {
                    memory: resources?.requests?.memory || "4Gi",
                    cpu: resources?.requests?.cpu || "2000m",
                  },
                  limits,
                };
                
                return resourceSpec;
              }),
              livenessProbe: {
                httpGet: {
                  path: "/health",
                  port: 8000,
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/health",
                  port: 8000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/health",
                  port: 8000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                failureThreshold: 30,
              },
            }],
            volumes: [{
              name: "model-cache",
              persistentVolumeClaim: {
                claimName: this.modelCachePvc.metadata.name,
              },
            }],
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
}

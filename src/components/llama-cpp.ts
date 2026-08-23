import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createPVC } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";

export interface LlamaCppArgs {
  namespace: pulumi.Input<string>;

  modelPath?: pulumi.Input<string>;
  huggingFaceRepo?: pulumi.Input<string>;
  huggingFaceFile?: pulumi.Input<string>;
  huggingfaceToken?: pulumi.Input<string>;
  modelUrl?: pulumi.Input<string>;
  alias?: pulumi.Input<string>;

  host?: pulumi.Input<string>;
  port?: pulumi.Input<number>;
  contextSize?: pulumi.Input<number>;
  gpuLayers?: pulumi.Input<number>;
  threads?: pulumi.Input<number>;
  parallel?: pulumi.Input<number>;
  extraArgs?: pulumi.Input<string[]>;

  runtimeClassName?: pulumi.Input<string>;
  replicas?: pulumi.Input<number>;

  image?: pulumi.Input<string>;
  imagePullPolicy?: pulumi.Input<"Always" | "IfNotPresent" | "Never">;

  env?: { [key: string]: pulumi.Input<string> };

  service?: {
    port?: pulumi.Input<number>;
    annotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };

  modelCache?: {
    size: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
    mountPath?: pulumi.Input<string>;
    nfs?: {
      server: pulumi.Input<string>;
      path: pulumi.Input<string>;
      readOnly?: pulumi.Input<boolean>;
    };
  };

  resources?: {
    requests?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
    limits?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };

  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;

  hostDevices?: Array<{
    hostPath: pulumi.Input<string>;
    mountPath: pulumi.Input<string>;
    readOnly?: pulumi.Input<boolean>;
  }>;

  securityContext?: pulumi.Input<k8s.types.input.core.v1.SecurityContext>;
  podSecurityContext?: pulumi.Input<k8s.types.input.core.v1.PodSecurityContext>;

  livenessProbe?: pulumi.Input<k8s.types.input.core.v1.Probe>;
  readinessProbe?: pulumi.Input<k8s.types.input.core.v1.Probe>;
  startupProbe?: pulumi.Input<k8s.types.input.core.v1.Probe>;
}

export class LlamaCpp extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly modelCachePvc?: k8s.core.v1.PersistentVolumeClaim;
  public readonly secret?: k8s.core.v1.Secret;
  private readonly servicePort: pulumi.Input<number>;

  constructor(name: string, args: LlamaCppArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:LlamaCpp", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };
    const labels = { app: name };
    const port = args.port ?? 8000;
    this.servicePort = args.service?.port ?? port;
    const modelCacheMountPath = args.modelCache?.mountPath || "/models";

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

    const serverArgs = pulumi.all([
      args.modelPath,
      args.huggingFaceRepo,
      args.huggingFaceFile,
      args.modelUrl,
      args.alias,
      args.host,
      port,
      args.contextSize,
      args.gpuLayers,
      args.threads,
      args.parallel,
      args.extraArgs,
    ]).apply(([
      modelPath,
      huggingFaceRepo,
      huggingFaceFile,
      modelUrl,
      alias,
      host,
      serverPort,
      contextSize,
      gpuLayers,
      threads,
      parallel,
      extraArgs,
    ]) => {
      const cmdArgs: string[] = ["--host", (host as string) || "0.0.0.0", "--port", (serverPort ?? 8000).toString()];

      if (modelPath) {
        cmdArgs.push("--model", modelPath as string);
      }

      if (huggingFaceRepo) {
        cmdArgs.push("--hf-repo", huggingFaceRepo as string);
      }

      if (huggingFaceFile) {
        cmdArgs.push("--hf-file", huggingFaceFile as string);
      }

      if (modelUrl) {
        cmdArgs.push("--model-url", modelUrl as string);
      }

      if (alias) {
        cmdArgs.push("--alias", alias as string);
      }

      if (contextSize !== undefined) {
        cmdArgs.push("--ctx-size", contextSize.toString());
      }

      if (gpuLayers !== undefined) {
        cmdArgs.push("--n-gpu-layers", gpuLayers.toString());
      }

      if (threads !== undefined) {
        cmdArgs.push("--threads", threads.toString());
      }

      if (parallel !== undefined) {
        cmdArgs.push("--parallel", parallel.toString());
      }

      if (extraArgs) {
        cmdArgs.push(...extraArgs as string[]);
      }

      return cmdArgs;
    });

    const env: k8s.types.input.core.v1.EnvVar[] = [];

    if (this.secret) {
      env.push({
        name: "HF_TOKEN",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "HF_TOKEN",
          },
        },
      }, {
        name: "HUGGING_FACE_HUB_TOKEN",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "HF_TOKEN",
          },
        },
      });
    }

    if (this.modelCachePvc) {
      if (!args.env?.HF_HOME) {
        env.push({
          name: "HF_HOME",
          value: pulumi.interpolate`${modelCacheMountPath}/huggingface`,
        });
      }

      if (!args.env?.HUGGINGFACE_HUB_CACHE) {
        env.push({
          name: "HUGGINGFACE_HUB_CACHE",
          value: pulumi.interpolate`${modelCacheMountPath}/huggingface/hub`,
        });
      }
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
        mountPath: modelCacheMountPath,
      });
      volumes.push({
        name: "model-cache",
        persistentVolumeClaim: {
          claimName: this.modelCachePvc.metadata.name,
        },
      });
    }

    args.hostDevices?.forEach((device, index) => {
      const volumeName = `host-device-${index}`;

      volumeMounts.push({
        name: volumeName,
        mountPath: device.mountPath,
        readOnly: device.readOnly,
      });
      volumes.push({
        name: volumeName,
        hostPath: {
          path: device.hostPath,
        },
      });
    });

    const defaultProbe: k8s.types.input.core.v1.Probe = {
      httpGet: {
        path: "/health",
        port: "http",
      },
      initialDelaySeconds: 30,
      periodSeconds: 10,
      timeoutSeconds: 5,
      failureThreshold: 3,
    };

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: args.replicas ?? 1,
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
            runtimeClassName: args.runtimeClassName || undefined,
            tolerations: args.tolerations,
            nodeSelector: args.nodeSelector,
            securityContext: args.podSecurityContext,
            containers: [{
              name: "llama-cpp",
              image: args.image || DOCKER_IMAGES.LLAMA_CPP_SERVER_CUDA.image,
              imagePullPolicy: args.imagePullPolicy || "IfNotPresent",
              args: serverArgs,
              ports: [{
                containerPort: port,
                name: "http",
              }],
              env,
              volumeMounts,
              resources: args.resources,
              securityContext: args.securityContext,
              livenessProbe: args.livenessProbe || defaultProbe,
              readinessProbe: args.readinessProbe || defaultProbe,
              startupProbe: args.startupProbe || {
                ...defaultProbe,
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
        name,
        namespace: args.namespace,
        labels,
        annotations: args.service?.annotations,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: this.servicePort,
          targetPort: port,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      modelCachePvc: this.modelCachePvc,
      secret: this.secret,
    });
  }

  public getApiUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:${this.servicePort}`;
  }

  public getPoolTargetModel(poolName?: pulumi.Input<string>, weight?: pulumi.Input<number>): { name: pulumi.Input<string>; weight: pulumi.Input<number>; targetRef: { kind: string; name: pulumi.Output<string>; namespace: pulumi.Output<string> } } {
    return {
      name: poolName || this.service.metadata.name,
      weight: weight ?? 100,
      targetRef: {
        kind: "Service",
        name: this.service.metadata.name,
        namespace: this.service.metadata.namespace,
      },
    };
  }
}

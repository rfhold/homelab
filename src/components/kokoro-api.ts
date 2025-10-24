import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface KokoroApiArgs {
  namespace: pulumi.Input<string>;
  
  name?: pulumi.Input<string>;
  
  image?: pulumi.Input<string>;
  
  replicas?: pulumi.Input<number>;
  
  port?: pulumi.Input<number>;
  
  env?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  
  defaultVoice?: pulumi.Input<string>;
  
  enableWebPlayer?: pulumi.Input<boolean>;
  
  downloadModel?: pulumi.Input<boolean>;
  
  useGpu?: pulumi.Input<boolean>;
  
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
  
  runtimeClassName?: pulumi.Input<string>;
  
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  
  ingress?: {
    enabled?: pulumi.Input<boolean>;
    hostname?: pulumi.Input<string>;
    ingressClassName?: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };
}

export class KokoroApi extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: KokoroApiArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:KokoroApi", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { 
      app: "kokoro-api",
      component: args.name || name,
    };

    const port = args.port || 8880;
    const defaultVoice = args.defaultVoice || "af_heart";
    const enableWebPlayer = args.enableWebPlayer !== undefined ? args.enableWebPlayer : true;
    const downloadModel = args.downloadModel !== undefined ? args.downloadModel : true;
    const useGpu = args.useGpu !== undefined ? args.useGpu : true;

    const env = pulumi.all([
      args.env,
      port,
      defaultVoice,
      enableWebPlayer,
      downloadModel,
      useGpu,
    ]).apply(([
      customEnv,
      portValue,
      voiceValue,
      webPlayerValue,
      downloadValue,
      gpuValue,
    ]) => {
      const envVars: k8s.types.input.core.v1.EnvVar[] = [
        { name: "PORT", value: (portValue as number).toString() },
        { name: "HOST", value: "0.0.0.0" },
        { name: "USE_GPU", value: (gpuValue as boolean).toString() },
        { name: "DOWNLOAD_MODEL", value: (downloadValue as boolean).toString() },
        { name: "DEFAULT_VOICE", value: voiceValue as string },
        { name: "ENABLE_WEB_PLAYER", value: (webPlayerValue as boolean).toString() },
      ];

      if (customEnv) {
        Object.entries(customEnv as { [key: string]: string }).forEach(([key, value]) => {
          envVars.push({ name: key, value: value as string });
        });
      }

      return envVars;
    });

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: args.name || name,
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
              name: "kokoro-api",
              image: args.image || DOCKER_IMAGES.KOKORO_FASTAPI_GPU.image,
              imagePullPolicy: "Always",
              ports: [{
                containerPort: port,
                name: "http",
              }],
              env,
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "4Gi",
                  cpu: args.resources?.requests?.cpu || "1000m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "8Gi",
                  cpu: args.resources?.limits?.cpu || "4000m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/health",
                  port: port,
                },
                initialDelaySeconds: 120,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/health",
                  port: port,
                },
                initialDelaySeconds: 60,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/health",
                  port: port,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                failureThreshold: 60,
              },
            }],
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: args.name || name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: port,
          targetPort: port,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    if (args.ingress?.enabled) {
      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: args.name || name,
          namespace: args.namespace,
          labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.ingressClassName || "nginx",
          tls: args.ingress.tls?.enabled ? [{
            hosts: args.ingress.hostname ? [args.ingress.hostname] : [],
            secretName: args.ingress.tls.secretName,
          }] : undefined,
          rules: args.ingress.hostname ? [{
            host: args.ingress.hostname,
            http: {
              paths: [{
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: this.service.metadata.name,
                    port: {
                      number: port,
                    },
                  },
                },
              }],
            },
          }] : [],
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      ingress: this.ingress,
    });
  }

  public getApiUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:${this.service.spec.ports[0].port}`;
  }
}

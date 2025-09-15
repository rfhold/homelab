import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";

export interface OctoPrintArgs {
  namespace: pulumi.Input<string>;

  image?: pulumi.Input<string>;

  storage?: StorageConfig;

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

  config?: {
    enableMjpgStreamer?: pulumi.Input<boolean>;
    autoMigrate?: pulumi.Input<boolean>;
    timezone?: pulumi.Input<string>;
    serverHost?: pulumi.Input<string>;
    serverPort?: pulumi.Input<number>;
  };

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

export class OctoPrint extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: OctoPrintArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:OctoPrint", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const storageConfig: StorageConfig = {
      size: args.storage?.size || "15Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    this.pvc = createPVC(`${name}-data-pvc`, {
      ...storageConfig,
      namespace: args.namespace,
    }, defaultResourceOptions);

    const labels = {
      app: "octoprint",
      component: name,
    };

    const serverPort = args.config?.serverPort || 80;
    const enableMjpgStreamer = args.config?.enableMjpgStreamer ?? false;
    const environment = [
      {
        name: "ENABLE_MJPG_STREAMER",
        value: enableMjpgStreamer.toString(),
      },
      {
        name: "AUTOMIGRATE",
        value: (args.config?.autoMigrate || false).toString(),
      },
      {
        name: "TZ",
        value: args.config?.timezone || "UTC",
      },
      {
        name: "OCTOPRINT_PORT",
        value: serverPort.toString(),
      },
    ];

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: "Recreate",
        },
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {

            containers: [{
              name: "octoprint",
              image: args.image || DOCKER_IMAGES.OCTOPRINT.image,
              ports: pulumi.output(enableMjpgStreamer).apply(enabled => {
                const ports = [
                  {
                    containerPort: serverPort,
                    name: "http",
                  }
                ];
                if (enabled) {
                  ports.push({
                    containerPort: 8080,
                    name: "mjpg-streamer",
                  });
                }
                return ports;
              }),
              env: environment,
              volumeMounts: [{
                name: "data",
                mountPath: "/octoprint",
              }],
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "512Mi",
                  cpu: args.resources?.requests?.cpu || "1000m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "2Gi",
                  cpu: args.resources?.limits?.cpu || "2000m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/",
                  port: serverPort,
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: serverPort,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/",
                  port: serverPort,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 12,
              },
            }],
            volumes: [{
              name: "data",
              persistentVolumeClaim: {
                claimName: this.pvc.metadata.name,
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
        labels: labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: pulumi.output(enableMjpgStreamer).apply(enabled => {
          const ports = [
            {
              port: 80,
              targetPort: serverPort,
              protocol: "TCP",
              name: "http",
            }
          ];
          if (enabled) {
            ports.push({
              port: 8080,
              targetPort: 8080,
              protocol: "TCP",
              name: "mjpg-streamer",
            });
          }
          return ports;
        }),
      },
    }, defaultResourceOptions);

    if (args.ingress?.enabled) {
      const ingressRules = [{
        host: args.ingress.host,
        http: {
          paths: [{
            path: "/",
            pathType: "Prefix" as const,
            backend: {
              service: {
                name: this.service.metadata.name,
                port: {
                  number: 80,
                },
              },
            },
          }],
        },
      }];

      const ingressTls = args.ingress.tls?.enabled ? [{
        hosts: [args.ingress.host],
        secretName: args.ingress.tls.secretName,
      }] : undefined;

      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.className,
          rules: ingressRules,
          tls: ingressTls,
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      pvc: this.pvc,
      ingress: this.ingress,
    });
  }

  public getServiceEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:80`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }

  public getMjpgStreamerEndpoint(): pulumi.Output<string | undefined> {
    const enableMjpgStreamer = this.deployment.spec.template.spec.containers[0].env.apply(env => {
      const mjpgEnv = env?.find(e => e.name === "ENABLE_MJPG_STREAMER");
      return mjpgEnv?.value === "true";
    });
    
    return pulumi.all([this.service.metadata.name, this.service.metadata.namespace, enableMjpgStreamer]).apply(([name, namespace, enabled]) => {
      if (!enabled) {
        return undefined;
      }
      return `http://${name}.${namespace}.svc.cluster.local:8080`;
    });
  }
}
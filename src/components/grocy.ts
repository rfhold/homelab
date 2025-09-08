import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";

export interface GrocyArgs {
  namespace: pulumi.Input<string>;

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

export class Grocy extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: GrocyArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Grocy", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const storageConfig: StorageConfig = {
      size: args.storage?.size || "2Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    this.pvc = createPVC(`${name}-config-pvc`, {
      ...storageConfig,
      namespace: args.namespace,
    }, defaultResourceOptions);

    const labels = {
      app: "grocy",
      component: name,
    };

    const environment = [
      {
        name: "PUID",
        value: (1000).toString(),
      },
      {
        name: "PGID",
        value: (1000).toString(),
      },
      {
        name: "TZ",
        value: "UTC",
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
            securityContext: {
              fsGroup: 1000,
            },
            containers: [{
              name: "grocy",
              image: DOCKER_IMAGES.GROCY.image,
              ports: [{
                containerPort: 80,
                name: "http",
              }],
              env: environment,
              volumeMounts: [{
                name: "config",
                mountPath: "/config",
              }],
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "256Mi",
                  cpu: args.resources?.requests?.cpu || "500m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "512Mi",
                  cpu: args.resources?.limits?.cpu || "1000m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/login",
                  port: 80,
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 80,
                },
                initialDelaySeconds: 10,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/",
                  port: 80,
                },
                initialDelaySeconds: 10,
                periodSeconds: 5,
                timeoutSeconds: 3,
                failureThreshold: 6,
              },
            }],
            volumes: [{
              name: "config",
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
        ports: [{
          port: 80,
          targetPort: 80,
          protocol: "TCP",
          name: "http",
        }],
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
}

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { getIngressUrl } from "../utils/kubernetes";

export interface OpenCodeArgs {
  namespace: pulumi.Input<string>;

  replicas?: pulumi.Input<number>;

  images?: {
    web?: pulumi.Input<string>;
    functions?: pulumi.Input<string>;
  };

  storage?: {
    size?: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
  };

  resources?: {
    web?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
    functions?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
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

  apiIngress?: {
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

export class OpenCode extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly webService: k8s.core.v1.Service;
  public readonly functionsService: k8s.core.v1.Service;
  public readonly pvc?: k8s.core.v1.PersistentVolumeClaim;
  public readonly ingress?: k8s.networking.v1.Ingress;
  public readonly apiIngress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: OpenCodeArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:OpenCode", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: "opencode", component: name };
    const webLabels = { ...labels, service: "web" };
    const functionsLabels = { ...labels, service: "functions" };

    if (args.storage?.size) {
      this.pvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-data`, {
        metadata: {
          name: `${name}-data`,
          namespace: args.namespace,
          labels,
        },
        spec: {
          accessModes: ["ReadWriteOnce"],
          storageClassName: args.storage.storageClass,
          resources: {
            requests: {
              storage: args.storage.size,
            },
          },
        },
      }, defaultResourceOptions);
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
        template: {
          metadata: {
            labels,
          },
          spec: {
            containers: [
              {
                name: "web",
                image: args.images?.web || DOCKER_IMAGES.OPENCODE_WEB.image,
                ports: [{
                  containerPort: 4321,
                  name: "http",
                }],
                env: [
                  { name: "HOST", value: "0.0.0.0" },
                  { name: "VITE_PUBLIC_API_URL", value: pulumi.interpolate`https://${args.apiIngress?.host}` },
                  { name: "VITE_API_URL", value: "http://localhost:3000" },
                ],
                resources: {
                  requests: {
                    memory: args.resources?.web?.requests?.memory || "256Mi",
                    cpu: args.resources?.web?.requests?.cpu || "100m",
                  },
                  limits: {
                    memory: args.resources?.web?.limits?.memory || "512Mi",
                    cpu: args.resources?.web?.limits?.cpu || "500m",
                  },
                },
              },
              {
                name: "functions",
                image: args.images?.functions || DOCKER_IMAGES.OPENCODE_FUNCTIONS.image,
                ports: [{
                  containerPort: 3000,
                  name: "http",
                }],
                env: [
                  { name: "HOST", value: "0.0.0.0" },
                  { name: "WEB_URL", value: pulumi.interpolate`https://${args.ingress?.host}` },
                ],
                volumeMounts: this.pvc ? [{
                  name: "data",
                  mountPath: "/app/data",
                }] : [],
                resources: {
                  requests: {
                    memory: args.resources?.functions?.requests?.memory || "256Mi",
                    cpu: args.resources?.functions?.requests?.cpu || "100m",
                  },
                  limits: {
                    memory: args.resources?.functions?.limits?.memory || "512Mi",
                    cpu: args.resources?.functions?.limits?.cpu || "500m",
                  },
                },
              },
            ],
            volumes: this.pvc ? [{
              name: "data",
              persistentVolumeClaim: {
                claimName: this.pvc.metadata.name,
              },
            }] : [],
          },
        },
      },
    }, defaultResourceOptions);

    this.webService = new k8s.core.v1.Service(`${name}-web-service`, {
      metadata: {
        name: `${name}-web`,
        namespace: args.namespace,
        labels: webLabels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 80,
          targetPort: 4321,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    this.functionsService = new k8s.core.v1.Service(`${name}-functions-service`, {
      metadata: {
        name: `${name}-functions`,
        namespace: args.namespace,
        labels: functionsLabels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 80,
          targetPort: 3000,
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
              paths: [
                {
                  path: "/",
                  pathType: "Prefix" as const,
                  backend: {
                    service: {
                      name: this.webService.metadata.name,
                      port: {
                        number: 80,
                      },
                    },
                  },
                },
              ],
            },
          }],
        },
      }, defaultResourceOptions);

    }

    if (args.apiIngress?.enabled) {
      this.apiIngress = new k8s.networking.v1.Ingress(`${name}-api-ingress`, {
        metadata: {
          name: `${name}-api`,
          namespace: args.namespace,
          labels: { ...labels, component: `${name}-api` },
          annotations: args.apiIngress.annotations,
        },
        spec: {
          ingressClassName: args.apiIngress.className,
          tls: args.apiIngress.tls?.enabled ? [{
            hosts: [args.apiIngress.host],
            secretName: args.apiIngress.tls.secretName,
          }] : undefined,
          rules: [{
            host: args.apiIngress.host,
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix" as const,
                  backend: {
                    service: {
                      name: this.functionsService.metadata.name,
                      port: {
                        number: 80,
                      },
                    },
                  },
                },
              ],
            },
          }],
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      webService: this.webService,
      functionsService: this.functionsService,
      pvc: this.pvc,
      ingress: this.ingress,
      apiIngress: this.apiIngress,
    });
  }

  public getUrl(): pulumi.Output<string> {
    if (this.ingress) {
      return getIngressUrl(this.ingress);
    }
    return pulumi.interpolate`http://${this.webService.metadata.name}`;
  }

  public getWebServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.webService.metadata.name}`;
  }

  public getFunctionsServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.functionsService.metadata.name}`;
  }
}

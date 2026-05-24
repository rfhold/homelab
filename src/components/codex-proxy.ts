import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";
import { createYAMLOutput } from "../utils/yaml";

export interface CodexProxyArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  name?: string;
  image?: pulumi.Input<string>;
  imagePullPolicy?: pulumi.Input<"Always" | "IfNotPresent" | "Never">;
  replicas?: pulumi.Input<number>;
  port?: pulumi.Input<number>;
  storage?: {
    size?: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
  };
  resources?: {
    requests?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
    limits?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
  };
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  httpRoute?: {
    enabled?: boolean;
    hostname: pulumi.Input<string>;
    gatewayRef: {
      name: pulumi.Input<string>;
      namespace: pulumi.Input<string>;
    };
    requestTimeout?: pulumi.Input<string>;
  };
}

export class CodexProxy extends pulumi.ComponentResource {
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly httpRoute?: k8s.apiextensions.CustomResource;

  constructor(name: string, args: CodexProxyArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CodexProxy", name, {}, withWorkloadLabels(opts, args.workloadLabels));

    const componentName = args.name ?? name;
    const labels = { app: "codex-proxy", component: componentName };
    const port = args.port ?? 8080;
    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const localYaml = createYAMLOutput({
      server: {
        host: "0.0.0.0",
        port,
        proxy_api_key: null,
      },
      logs: {
        enabled: false,
        capture_body: false,
        llm_only: true,
      },
      update: {
        auto_update: false,
        show_update_dialog: false,
      },
    });

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${componentName}-config`,
        namespace: args.namespace,
        labels,
      },
      data: {
        "local.yaml": localYaml,
      },
    }, defaultResourceOptions);

    this.pvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-data`, {
      metadata: {
        name: `${componentName}-data`,
        namespace: args.namespace,
        labels,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        storageClassName: args.storage?.storageClass,
        resources: {
          requests: {
            storage: args.storage?.size ?? "10Gi",
          },
        },
      },
    }, defaultResourceOptions);

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: componentName,
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: args.replicas ?? 1,
        selector: { matchLabels: labels },
        template: {
          metadata: { labels },
          spec: {
            nodeSelector: args.nodeSelector,
            tolerations: args.tolerations,
            initContainers: [
              {
                name: "seed-config",
                image: DOCKER_IMAGES.BUSYBOX.image,
                command: ["sh", "-c", "cp /config/local.yaml /app/data/local.yaml"],
                volumeMounts: [
                  {
                    name: "config",
                    mountPath: "/config",
                    readOnly: true,
                  },
                  {
                    name: "data",
                    mountPath: "/app/data",
                  },
                ],
              },
            ],
            containers: [
              {
                name: "codex-proxy",
                image: args.image ?? DOCKER_IMAGES.CODEX_PROXY.image,
                imagePullPolicy: args.imagePullPolicy ?? "IfNotPresent",
                ports: [
                  { name: "http", containerPort: port, protocol: "TCP" },
                ],
                volumeMounts: [
                  {
                    name: "data",
                    mountPath: "/app/data",
                  },
                ],
                resources: {
                  requests: {
                    cpu: args.resources?.requests?.cpu ?? "100m",
                    memory: args.resources?.requests?.memory ?? "256Mi",
                  },
                  limits: {
                    cpu: args.resources?.limits?.cpu ?? "1000m",
                    memory: args.resources?.limits?.memory ?? "1Gi",
                  },
                },
                livenessProbe: {
                  httpGet: {
                    path: "/health",
                    port,
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 30,
                },
                readinessProbe: {
                  httpGet: {
                    path: "/health",
                    port,
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                },
              },
            ],
            volumes: [
              {
                name: "config",
                configMap: {
                  name: this.configMap.metadata.name,
                },
              },
              {
                name: "data",
                persistentVolumeClaim: {
                  claimName: this.pvc.metadata.name,
                },
              },
            ],
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: componentName,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [
          {
            name: "http",
            port,
            targetPort: port,
            protocol: "TCP",
          },
        ],
      },
    }, defaultResourceOptions);

    if (args.httpRoute?.enabled) {
      this.httpRoute = new k8s.apiextensions.CustomResource(`${name}-httproute`, {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "HTTPRoute",
        metadata: {
          name: componentName,
          namespace: args.namespace,
          labels,
        },
        spec: {
          parentRefs: [{
            group: "gateway.networking.k8s.io",
            kind: "Gateway",
            name: args.httpRoute.gatewayRef.name,
            namespace: args.httpRoute.gatewayRef.namespace,
          }],
          hostnames: [args.httpRoute.hostname],
          rules: [{
            matches: [{ path: { type: "PathPrefix", value: "/" } }],
            backendRefs: [{
              name: this.service.metadata.name,
              port,
            }],
            timeouts: args.httpRoute.requestTimeout
              ? { request: args.httpRoute.requestTimeout }
              : undefined,
          }],
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      configMap: this.configMap,
      pvc: this.pvc,
      deployment: this.deployment,
      service: this.service,
      httpRoute: this.httpRoute,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:${this.service.spec.ports[0].port}`;
  }
}

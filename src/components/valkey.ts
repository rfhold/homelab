import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createRedisPassword, RedisConfig } from "../adapters/redis";
import { StorageConfig, createPVCSpec } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";

export interface ValkeyArgs {
  namespace: pulumi.Input<string>;
  password?: pulumi.Input<string>;
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
  maxMemory?: pulumi.Input<string>;
  maxMemoryPolicy?: pulumi.Input<string>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

export class ValkeyComponent extends pulumi.ComponentResource {
  public readonly statefulSet: k8s.apps.v1.StatefulSet;
  public readonly service: k8s.core.v1.Service;
  public readonly password: ReturnType<typeof createRedisPassword>;

  private readonly connectionConfig: RedisConfig;

  constructor(name: string, args: ValkeyArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Valkey", name, args, opts);

    this.password = args.password
      ? { result: pulumi.output(args.password) } as ReturnType<typeof createRedisPassword>
      : createRedisPassword(`${name}-password`, 32, { parent: this });

    const labels = { app: name };

    const configData = pulumi.all([
      args.maxMemory,
      args.maxMemoryPolicy,
    ]).apply(([maxMemory, maxMemoryPolicy]) => {
      const lines = [
        "bind 0.0.0.0",
        "port 6379",
        "protected-mode yes",
        "tcp-keepalive 300",
        "timeout 0",
        "appendonly no",
        'save ""',
        "dir /data",
      ];

      if (maxMemory) {
        lines.push(`maxmemory ${maxMemory}`);
      }
      lines.push(`maxmemory-policy ${maxMemoryPolicy || "allkeys-lru"}`);

      return lines.join("\n");
    });

    const configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
        labels,
      },
      data: {
        "valkey.conf": configData,
      },
    }, { parent: this });

    const headlessService = new k8s.core.v1.Service(`${name}-headless`, {
      metadata: {
        name: `${name}-headless`,
        namespace: args.namespace,
        labels,
      },
      spec: {
        clusterIP: "None",
        selector: labels,
        ports: [{
          port: 6379,
          targetPort: 6379,
          name: "valkey",
        }],
      },
    }, { parent: this });

    this.service = new k8s.core.v1.Service(name, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 6379,
          targetPort: 6379,
          name: "valkey",
        }],
      },
    }, { parent: this });

    const storageConfig: StorageConfig = {
      size: args.storage?.size || "8Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
    };

    this.statefulSet = new k8s.apps.v1.StatefulSet(name, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        serviceName: headlessService.metadata.name,
        replicas: 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels,
          },
          spec: {
            terminationGracePeriodSeconds: 20,
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 999,
              runAsGroup: 999,
              fsGroup: 999,
            },
            tolerations: args.tolerations,
            nodeSelector: args.nodeSelector,
            initContainers: [{
              name: "init-config",
              image: DOCKER_IMAGES.VALKEY.image,
              command: ["sh", "-c", `cp /config-template/valkey.conf /conf/valkey.conf && printf '\\nrequirepass %s\\n' "$VALKEY_PASSWORD" >> /conf/valkey.conf`],
              env: [{
                name: "VALKEY_PASSWORD",
                valueFrom: {
                  secretKeyRef: {
                    name: `${name}-secret`,
                    key: "password",
                  },
                },
              }],
              volumeMounts: [
                {
                  name: "config-template",
                  mountPath: "/config-template",
                },
                {
                  name: "config",
                  mountPath: "/conf",
                },
              ],
            }],
            containers: [{
              name: "valkey",
              image: DOCKER_IMAGES.VALKEY.image,
              command: ["valkey-server", "/conf/valkey.conf"],
              ports: [{
                containerPort: 6379,
                name: "valkey",
              }],
              volumeMounts: [
                {
                  name: "data",
                  mountPath: "/data",
                },
                {
                  name: "config",
                  mountPath: "/conf",
                },
              ],
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "128Mi",
                  cpu: args.resources?.requests?.cpu || "100m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "256Mi",
                  cpu: args.resources?.limits?.cpu || "500m",
                },
              },
              livenessProbe: {
                exec: {
                  command: ["sh", "-c", "valkey-cli -a $VALKEY_PASSWORD ping"],
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              readinessProbe: {
                exec: {
                  command: ["sh", "-c", "valkey-cli -a $VALKEY_PASSWORD ping"],
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                timeoutSeconds: 1,
                failureThreshold: 3,
              },
              env: [{
                name: "VALKEY_PASSWORD",
                valueFrom: {
                  secretKeyRef: {
                    name: `${name}-secret`,
                    key: "password",
                  },
                },
              }],
            }],
            volumes: [
              {
                name: "config-template",
                configMap: {
                  name: configMap.metadata.name,
                },
              },
              {
                name: "config",
                emptyDir: {},
              },
            ],
          },
        },
        volumeClaimTemplates: [{
          metadata: {
            name: "data",
          },
          spec: createPVCSpec(storageConfig),
        }],
      },
    }, { parent: this });

    new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-secret`,
        namespace: args.namespace,
        labels,
      },
      stringData: {
        password: this.password.result,
      },
    }, { parent: this });

    this.connectionConfig = {
      host: pulumi.interpolate`${this.service.metadata.name}.${args.namespace}`,
      port: 6379,
      password: this.password.result,
    };

    this.registerOutputs({
      statefulSet: this.statefulSet,
      service: this.service,
      password: this.password,
    });
  }

  public getConnectionConfig(): RedisConfig {
    return {
      host: this.connectionConfig.host,
      port: this.connectionConfig.port,
      password: this.connectionConfig.password,
    };
  }
}

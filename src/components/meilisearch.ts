import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import { createTOMLDocumentOutput } from "../utils/toml";
import { DOCKER_IMAGES } from "../docker-images";

export interface MeilisearchArgs {
  namespace: string;
  name?: string;

  environment?: "development" | "production";

  storage?: {
    size?: string;
    storageClass?: string;
  };

  resources?: {
    limits?: {
      cpu?: string;
      memory?: string;
    };
    requests?: {
      cpu?: string;
      memory?: string;
    };
  };

  config?: {
    maxIndexingMemory?: string;
    maxIndexingThreads?: number;
    logLevel?: "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE" | "OFF";
    httpPayloadSizeLimit?: string;
    noAnalytics?: boolean;
    scheduleSnapshot?: number | boolean;
    experimentalLogsMode?: "human" | "json";
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

  image?: {
    repository?: string;
    tag?: string;
    pullPolicy?: string;
  };
}

export class MeilisearchComponent extends pulumi.ComponentResource {
  public readonly statefulSet: k8s.apps.v1.StatefulSet;
  public readonly service: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly ingress?: k8s.networking.v1.Ingress;
  public readonly url: pulumi.Output<string>;
  public readonly masterKey: pulumi.Output<string>;

  constructor(
    name: string,
    args: MeilisearchArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:components:Meilisearch", name, {}, opts);

    const componentName = args.name || name;
    const labels = { app: "meilisearch", component: componentName };
    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const masterKey = new random.RandomPassword(
      `${name}-master-key`,
      {
        length: 32,
        special: false,
      },
      defaultResourceOptions
    );

    this.masterKey = masterKey.result;

    this.secret = new k8s.core.v1.Secret(
      `${name}-secret`,
      {
        metadata: {
          name: componentName,
          namespace: args.namespace,
          labels,
        },
        stringData: {
          MEILI_MASTER_KEY: masterKey.result,
        },
      },
      defaultResourceOptions
    );

    const configData = pulumi
      .all([args.environment, args.config])
      .apply(([environment, config]) => {
        const meiliConfig: Record<string, unknown> = {
          db_path: "/meili_data/data.ms",
          env: environment || "production",
          http_addr: "0.0.0.0:7700",
        };

        if (config?.maxIndexingMemory) {
          meiliConfig.max_indexing_memory = config.maxIndexingMemory;
        }
        if (config?.maxIndexingThreads !== undefined) {
          meiliConfig.max_indexing_threads = config.maxIndexingThreads;
        }
        if (config?.logLevel) {
          meiliConfig.log_level = config.logLevel;
        }
        if (config?.httpPayloadSizeLimit) {
          meiliConfig.http_payload_size_limit = config.httpPayloadSizeLimit;
        }
        if (config?.noAnalytics) {
          meiliConfig.no_analytics = true;
        }
        if (config?.scheduleSnapshot !== undefined) {
          meiliConfig.schedule_snapshot = config.scheduleSnapshot;
        }
        if (config?.experimentalLogsMode) {
          meiliConfig.experimental_logs_mode = config.experimentalLogsMode;
        }

        return meiliConfig;
      });

    const tomlConfig = createTOMLDocumentOutput(
      configData,
      "Meilisearch Configuration\nManaged by Pulumi",
      { sortKeys: true }
    );

    this.configMap = new k8s.core.v1.ConfigMap(
      `${name}-config`,
      {
        metadata: {
          name: `${componentName}-config`,
          namespace: args.namespace,
          labels,
        },
        data: {
          "config.toml": tomlConfig,
        },
      },
      defaultResourceOptions
    );

    this.pvc = new k8s.core.v1.PersistentVolumeClaim(
      `${name}-data`,
      {
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
              storage: args.storage?.size || "10Gi",
            },
          },
        },
      },
      defaultResourceOptions
    );

    this.statefulSet = new k8s.apps.v1.StatefulSet(
      name,
      {
        metadata: {
          name: componentName,
          namespace: args.namespace,
          labels,
        },
        spec: {
          serviceName: componentName,
          replicas: 1,
          selector: { matchLabels: labels },
          template: {
            metadata: { labels },
            spec: {
              containers: [
                {
                  name: "meilisearch",
                  image: args.image
                    ? pulumi.interpolate`${args.image.repository}:${args.image.tag}`
                    : DOCKER_IMAGES.MEILISEARCH.image,
                  imagePullPolicy: args.image?.pullPolicy || "IfNotPresent",
                  env: [
                    {
                      name: "MEILI_CONFIG_FILE_PATH",
                      value: "/meili_data/config.toml",
                    },
                    {
                      name: "MEILI_MASTER_KEY",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.secret.metadata.name,
                          key: "MEILI_MASTER_KEY",
                        },
                      },
                    },
                  ],
                  ports: [
                    {
                      name: "http",
                      containerPort: 7700,
                      protocol: "TCP",
                    },
                  ],
                  volumeMounts: [
                    {
                      name: "data",
                      mountPath: "/meili_data",
                    },
                    {
                      name: "config",
                      mountPath: "/meili_data/config.toml",
                      subPath: "config.toml",
                    },
                  ],
                  resources: args.resources || {
                    requests: {
                      cpu: "100m",
                      memory: "512Mi",
                    },
                    limits: {
                      cpu: "1000m",
                      memory: "2Gi",
                    },
                  },
                  livenessProbe: {
                    httpGet: {
                      path: "/health",
                      port: 7700,
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 10,
                  },
                  readinessProbe: {
                    httpGet: {
                      path: "/health",
                      port: 7700,
                    },
                    initialDelaySeconds: 10,
                    periodSeconds: 5,
                  },
                },
              ],
              volumes: [
                {
                  name: "data",
                  persistentVolumeClaim: {
                    claimName: this.pvc.metadata.name,
                  },
                },
                {
                  name: "config",
                  configMap: {
                    name: this.configMap.metadata.name,
                  },
                },
              ],
            },
          },
        },
      },
      defaultResourceOptions
    );

    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
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
              port: 7700,
              targetPort: 7700,
              protocol: "TCP",
            },
          ],
        },
      },
      defaultResourceOptions
    );

    if (args.ingress?.enabled) {
      const ingressRules = [
        {
          host: args.ingress.host,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix" as const,
                backend: {
                  service: {
                    name: this.service.metadata.name,
                    port: {
                      number: 7700,
                    },
                  },
                },
              },
            ],
          },
        },
      ];

      const ingressTls = args.ingress.tls?.enabled
        ? [
            {
              hosts: [args.ingress.host],
              secretName: args.ingress.tls.secretName,
            },
          ]
        : undefined;

      this.ingress = new k8s.networking.v1.Ingress(
        `${name}-ingress`,
        {
          metadata: {
            name: componentName,
            namespace: args.namespace,
            labels,
            annotations: args.ingress.annotations,
          },
          spec: {
            ingressClassName: args.ingress.className,
            rules: ingressRules,
            tls: ingressTls,
          },
        },
        defaultResourceOptions
      );
    }

    this.url = pulumi.interpolate`http://${this.service.metadata.name}:7700`;

    this.registerOutputs({
      statefulSet: this.statefulSet,
      service: this.service,
      secret: this.secret,
      configMap: this.configMap,
      pvc: this.pvc,
      ingress: this.ingress,
      url: this.url,
      masterKey: this.masterKey,
    });
  }
}

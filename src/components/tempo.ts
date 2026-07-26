import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface TempoArgs {
  namespace: pulumi.Input<string>;

  s3: {
    endpoint: pulumi.Input<string>;
    region: pulumi.Input<string>;
    bucket: pulumi.Input<string>;
    accessKeyId: pulumi.Input<string>;
    secretAccessKey: pulumi.Input<string>;
    insecureSkipVerify?: pulumi.Input<boolean>;
  };

  metricsGenerator?: {
    remoteWriteUrl: pulumi.Input<string>;
    replicas?: number;
  };

  kafka: {
    bootstrapServers: pulumi.Input<string>;
    topic: pulumi.Input<string>;
  };

  replicas?: {
    distributor?: number;
    querier?: number;
    queryFrontend?: number;
    blockBuilder?: number;
    liveStore?: number;
    backendWorker?: number;
  };

  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
}

export class Tempo extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;
  public readonly distributorEndpoint: pulumi.Output<string>;
  public readonly queryFrontendEndpoint: pulumi.Output<string>;

  private readonly chartReleaseName: string;

  constructor(name: string, args: TempoArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Tempo", name, args, opts);

    const chartConfig = HELM_CHARTS.TEMPO_DISTRIBUTED;
    this.chartReleaseName = `${name}-chart`;
    this.namespace = pulumi.output(args.namespace);
    const blockBuilderReplicas = args.replicas?.blockBuilder ?? 3;
    const liveStoreReplicas = args.replicas?.liveStore ?? 3;

    if (blockBuilderReplicas !== 3 || liveStoreReplicas !== 3) {
      throw new Error("Tempo block-builder and live-store replicas must match the three tempo-traces partitions");
    }

    const s3Endpoint = pulumi.output(args.s3.endpoint).apply(endpoint => {
      return endpoint.replace(/^https?:\/\//, '');
    });

    const s3CredentialsSecret = new k8s.core.v1.Secret(
      `${name}-s3-credentials`,
      {
        metadata: {
          namespace: args.namespace,
          name: `${name}-s3-credentials`,
        },
        type: "Opaque",
        stringData: {
          "AWS_ACCESS_KEY_ID": args.s3.accessKeyId,
          "AWS_SECRET_ACCESS_KEY": args.s3.secretAccessKey,
        },
      },
      { parent: this }
    );

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          memcached: {
            enabled: false,
          },

          cache: {
            caches: [],
          },

          gateway: {
            enabled: false,
          },

          multitenancyEnabled: false,
          reportingEnabled: false,

          metricsGenerator: {
            enabled: !!args.metricsGenerator,
            ...(args.metricsGenerator && {
              replicas: args.metricsGenerator.replicas ?? 1,
              extraEnvFrom: [
                {
                  secretRef: {
                    name: s3CredentialsSecret.metadata.name,
                  },
                },
              ],
              ...(args.tolerations && { tolerations: args.tolerations }),
              config: {
                storage: {
                  path: "/var/tempo/wal",
                  remote_write_flush_deadline: "1m",
                  remote_write: [
                    {
                      url: args.metricsGenerator.remoteWriteUrl,
                      send_exemplars: true,
                      headers: {
                        "X-Scope-OrgID": "0",
                      },
                    },
                  ],
                },
              },
            }),
          },

          ...(args.metricsGenerator && {
            overrides: {
              defaults: {
                metrics_generator: {
                  processors: ["service-graphs", "span-metrics"],
                },
              },
            },
          }),

          ingest: {
            kafka: {
              address: args.kafka.bootstrapServers,
              topic: args.kafka.topic,
              auto_create_topic_enabled: false,
              auto_create_topic_default_partitions: 3,
            },
          },

          traces: {
            otlp: {
              grpc: {
                enabled: true,
              },
              http: {
                enabled: false,
              },
            },
          },

          storage: {
            trace: {
              backend: "s3",
              s3: {
                bucket: args.s3.bucket,
                endpoint: s3Endpoint,
                tls_insecure_skip_verify: true,
                forcepathstyle: true,
              },
            },
          },

          distributor: {
            replicas: args.replicas?.distributor ?? 2,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          backendScheduler: {
            enabled: true,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
            config: {
              provider: {
                compaction: {
                  compaction: {
                    block_retention: "168h",
                  },
                },
              },
            },
          },

          backendWorker: {
            replicas: args.replicas?.backendWorker ?? 1,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          blockBuilder: {
            enabled: true,
            replicas: blockBuilderReplicas,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          liveStore: {
            enabled: true,
            replicas: liveStoreReplicas,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          querier: {
            replicas: args.replicas?.querier ?? 2,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          queryFrontend: {
            replicas: args.replicas?.queryFrontend ?? 2,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

        },
      },
      {
        parent: this,
        dependsOn: [s3CredentialsSecret],
      }
    );

    this.distributorEndpoint = pulumi.interpolate`${this.chartReleaseName}-distributor.${this.namespace}:4317`;
    this.queryFrontendEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-query-frontend.${this.namespace}:3200`;

    this.registerOutputs({
      chart: this.chart,
      namespace: this.namespace,
      distributorEndpoint: this.distributorEndpoint,
      queryFrontendEndpoint: this.queryFrontendEndpoint,
    });
  }

  public getDistributorUrl(): pulumi.Output<string> {
    return this.distributorEndpoint;
  }

  public getQueryFrontendUrl(): pulumi.Output<string> {
    return this.queryFrontendEndpoint;
  }
}

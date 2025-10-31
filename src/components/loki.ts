import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface LokiArgs {
  namespace: pulumi.Input<string>;

  s3: {
    region: pulumi.Input<string>;
    bucketChunks: pulumi.Input<string>;
    bucketRuler: pulumi.Input<string>;
    bucketAdmin: pulumi.Input<string>;
    accessKeyId: pulumi.Input<string>;
    secretAccessKey: pulumi.Input<string>;
    endpoint?: pulumi.Input<string>;
    s3ForcePathStyle?: pulumi.Input<boolean>;
    insecureSkipVerify?: pulumi.Input<boolean>;
  };

  replicas?: {
    distributor?: number;
    ingester?: number;
    querier?: number;
    queryFrontend?: number;
    queryScheduler?: number;
    indexGateway?: number;
    compactor?: number;
    ruler?: number;
  };

  retentionPeriod?: pulumi.Input<string>;

  minio?: {
    enabled?: boolean;
  };

  resources?: {
    distributor?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    ingester?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    querier?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    queryFrontend?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    queryScheduler?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    indexGateway?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    compactor?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    ruler?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
  };

  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
}

export class Loki extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;
  public readonly gatewayEndpoint: pulumi.Output<string>;

  private readonly chartReleaseName: string;

  constructor(name: string, args: LokiArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Loki", name, args, opts);

    const chartConfig = HELM_CHARTS.LOKI;
    this.chartReleaseName = `${name}-chart`;
    this.namespace = pulumi.output(args.namespace);

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
          deploymentMode: "Distributed",

          loki: {
            schemaConfig: {
              configs: [
                {
                  from: "2024-04-01",
                  store: "tsdb",
                  object_store: "s3",
                  schema: "v13",
                  index: {
                    prefix: "loki_index_",
                    period: "24h",
                  },
                },
              ],
            },

            ingester: {
              chunk_encoding: "snappy",
            },

            pattern_ingester: {
              enabled: true,
            },

            limits_config: {
              allow_structured_metadata: true,
              volume_enabled: true,
              retention_period: args.retentionPeriod || "672h",
            },

            querier: {
              max_concurrent: 4,
            },

            storage: {
              type: "s3",
              bucketNames: {
                chunks: args.s3.bucketChunks,
                ruler: args.s3.bucketRuler,
                admin: args.s3.bucketAdmin,
              },
              s3: {
                ...(args.s3.endpoint && { endpoint: args.s3.endpoint }),
                region: args.s3.region,
                s3ForcePathStyle: args.s3.s3ForcePathStyle ?? false,
                ...(args.s3.insecureSkipVerify && { insecure: args.s3.insecureSkipVerify }),
              },
            },

            storage_config: {
              aws: {
                region: args.s3.region,
                bucketnames: args.s3.bucketChunks,
                s3forcepathstyle: args.s3.s3ForcePathStyle ?? false,
                ...(args.s3.endpoint && { endpoint: args.s3.endpoint }),
              },
            },
          },

          distributor: {
            replicas: args.replicas?.distributor ?? 3,
            maxUnavailable: 2,
            ...(args.resources?.distributor && {
              resources: args.resources.distributor,
            }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
          },

          ingester: {
            replicas: args.replicas?.ingester ?? 3,
            maxUnavailable: 2,
            ...(args.resources?.ingester && {
              resources: args.resources.ingester,
            }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
          },

          querier: {
            replicas: args.replicas?.querier ?? 3,
            maxUnavailable: 2,
            ...(args.resources?.querier && {
              resources: args.resources.querier,
            }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
          },

          queryFrontend: {
            replicas: args.replicas?.queryFrontend ?? 2,
            maxUnavailable: 1,
            ...(args.resources?.queryFrontend && {
              resources: args.resources.queryFrontend,
            }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
          },

          queryScheduler: {
            replicas: args.replicas?.queryScheduler ?? 2,
            ...(args.resources?.queryScheduler && {
              resources: args.resources.queryScheduler,
            }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
          },

          indexGateway: {
            replicas: args.replicas?.indexGateway ?? 2,
            maxUnavailable: 1,
            ...(args.resources?.indexGateway && {
              resources: args.resources.indexGateway,
            }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
          },

          compactor: {
            replicas: args.replicas?.compactor ?? 1,
            ...(args.resources?.compactor && {
              resources: args.resources.compactor,
            }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
          },

          ruler: {
            replicas: args.replicas?.ruler ?? 0,
            ...(args.resources?.ruler && {
              resources: args.resources.ruler,
            }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
          },

          backend: {
            replicas: 0,
          },

          read: {
            replicas: 0,
          },

          write: {
            replicas: 0,
          },

          gateway: {
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          minio: {
            enabled: args.minio?.enabled ?? false,
          },

          singleBinary: {
            replicas: 0,
          },

          chunksCache: {
            enabled: true,
          },

          resultsCache: {
            enabled: true,
          },

          lokiCanary: {
            enabled: false,
          },

          test: {
            enabled: false,
          },

          monitoring: {
            selfMonitoring: {
              enabled: false,
              grafanaAgent: {
                installOperator: false,
              },
            },
            lokiCanary: {
              enabled: false,
            },
          },
        },
      },
      { parent: this, dependsOn: [s3CredentialsSecret] }
    );

    this.gatewayEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-gateway.${this.namespace}:80`;

    this.registerOutputs({
      chart: this.chart,
      namespace: this.namespace,
      gatewayEndpoint: this.gatewayEndpoint,
    });
  }

  public getGatewayUrl(): pulumi.Output<string> {
    return this.gatewayEndpoint;
  }

  public getPushUrl(): pulumi.Output<string> {
    return pulumi.interpolate`${this.gatewayEndpoint}/loki/api/v1/push`;
  }

  public getQueryUrl(): pulumi.Output<string> {
    return pulumi.interpolate`${this.gatewayEndpoint}/loki/api/v1/query`;
  }

  public getDistributorUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}-distributor.${this.namespace}:3100`;
  }

  public getQueryFrontendUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}-query-frontend.${this.namespace}:3100`;
  }
}

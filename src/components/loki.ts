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
    read?: number;
    write?: number;
    backend?: number;
  };

  retentionPeriod?: pulumi.Input<string>;

  minio?: {
    enabled?: boolean;
  };

  resources?: {
    read?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    write?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    backend?: {
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
          deploymentMode: "SimpleScalable",

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


          backend: {
            replicas: args.replicas?.backend ?? 3,
            ...(args.resources?.backend && {
              resources: args.resources.backend,
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

          read: {
            replicas: args.replicas?.read ?? 3,
            ...(args.resources?.read && {
              resources: args.resources.read,
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

          write: {
            replicas: args.replicas?.write ?? 3,
            ...(args.resources?.write && {
              resources: args.resources.write,
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
}

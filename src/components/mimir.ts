import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface MimirArgs {
  namespace: pulumi.Input<string>;

  s3: {
    endpoint: pulumi.Input<string>;
    region: pulumi.Input<string>;
    bucketBlocks: pulumi.Input<string>;
    bucketRuler: pulumi.Input<string>;
    bucketAlertmanager: pulumi.Input<string>;
    accessKeyId: pulumi.Input<string>;
    secretAccessKey: pulumi.Input<string>;
    insecureSkipVerify?: pulumi.Input<boolean>;
  };

  kafka?: {
    enabled?: boolean;
  };

  multitenancy?: {
    enabled?: boolean;
  };

  replicas?: {
    ingester?: number;
    querier?: number;
    queryFrontend?: number;
    distributor?: number;
    compactor?: number;
    storeGateway?: number;
    ruler?: number;
  };

  rules?: {
    [namespace: string]: {
      [groupName: string]: string;
    };
  };

  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
}

export class Mimir extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;
  public readonly queryFrontendEndpoint: pulumi.Output<string>;
  public readonly distributorEndpoint: pulumi.Output<string>;
  public readonly nginxGatewayEndpoint: pulumi.Output<string>;

  private readonly chartReleaseName: string;

  constructor(name: string, args: MimirArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Mimir", name, args, opts);

    const chartConfig = HELM_CHARTS.MIMIR_DISTRIBUTED;
    this.chartReleaseName = `${name}-chart`;
    this.namespace = pulumi.output(args.namespace);

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

    let rulesConfigMap: k8s.core.v1.ConfigMap | undefined;
    if (args.rules) {
      const rulesData: Record<string, string> = {};
      for (const [namespace, groups] of Object.entries(args.rules)) {
        for (const [groupName, content] of Object.entries(groups)) {
          rulesData[`${namespace}_${groupName}.yaml`] = content;
        }
      }

      rulesConfigMap = new k8s.core.v1.ConfigMap(
        `${name}-rules`,
        {
          metadata: {
            namespace: args.namespace,
            name: `${name}-rules`,
          },
          data: rulesData,
        },
        { parent: this }
      );
    }

    const helmDependencies = rulesConfigMap
      ? [s3CredentialsSecret, rulesConfigMap]
      : [s3CredentialsSecret];

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          minio: {
            enabled: false,
          },

          kafka: {
            enabled: args.kafka?.enabled ?? true,
          },

          mimir: {
            structuredConfig: {
              multitenancy_enabled: args.multitenancy?.enabled ?? false,

              common: {
                storage: {
                  backend: "s3",
                  s3: {
                    endpoint: s3Endpoint,
                    region: args.s3.region,
                    access_key_id: pulumi.interpolate`\${AWS_ACCESS_KEY_ID}`,
                    secret_access_key: pulumi.interpolate`\${AWS_SECRET_ACCESS_KEY}`,
                    ...(args.s3.insecureSkipVerify && {
                      http: {
                        insecure_skip_verify: args.s3.insecureSkipVerify,
                      },
                    }),
                  },
                },
              },

              blocks_storage: {
                s3: {
                  bucket_name: args.s3.bucketBlocks,
                },
              },

              alertmanager_storage: {
                s3: {
                  bucket_name: args.s3.bucketAlertmanager,
                },
              },

              ruler_storage: {
                s3: {
                  bucket_name: args.s3.bucketRuler,
                },
              },

              ruler: {
                enable_api: true,
                rule_path: "/data",
              },
            },
          },

          ingester: {
            replicas: args.replicas?.ingester ?? 3,
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

          query_frontend: {
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

          compactor: {
            replicas: args.replicas?.compactor ?? 1,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          store_gateway: {
            replicas: args.replicas?.storeGateway ?? 2,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          ruler: {
            replicas: args.replicas?.ruler ?? 1,
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          alertmanager: {
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
      { parent: this, dependsOn: helmDependencies }
    );

    this.queryFrontendEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-query-frontend.${this.namespace}:8080/prometheus`;
    this.distributorEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-distributor.${this.namespace}:8080`;
    this.nginxGatewayEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-nginx.${this.namespace}:80`;

    if (rulesConfigMap) {
      const rulerEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-ruler.${this.namespace}:8080`;
      
      const uploadScript = pulumi.all([rulesConfigMap.data, rulerEndpoint]).apply(([data, endpoint]) => {
        const commands: string[] = [];
        for (const [filename, content] of Object.entries(data || {})) {
          const [namespace, groupFile] = filename.split("_");
          const groupName = groupFile.replace(".yaml", "");
          commands.push(`echo "Uploading ${namespace}/${groupName}..."`);
          commands.push(`mimirtool rules load /rules/${filename} --address=${endpoint} --id=anonymous || true`);
        }
        return commands.join("\n");
      });

      new k8s.batch.v1.Job(
        `${name}-rules-loader`,
        {
          metadata: {
            namespace: args.namespace,
            name: `${name}-rules-loader`,
          },
          spec: {
            backoffLimit: 3,
            ttlSecondsAfterFinished: 300,
            template: {
              spec: {
                restartPolicy: "OnFailure",
                containers: [
                  {
                    name: "mimirtool",
                    image: "grafana/mimirtool:latest",
                    command: ["/bin/sh", "-c"],
                    args: [uploadScript],
                    volumeMounts: [
                      {
                        name: "rules",
                        mountPath: "/rules",
                        readOnly: true,
                      },
                    ],
                  },
                ],
                volumes: [
                  {
                    name: "rules",
                    configMap: {
                      name: rulesConfigMap.metadata.name,
                    },
                  },
                ],
              },
            },
          },
        },
        { parent: this, dependsOn: [this.chart] }
      );
    }

    this.registerOutputs({
      chart: this.chart,
      namespace: this.namespace,
      queryFrontendEndpoint: this.queryFrontendEndpoint,
      distributorEndpoint: this.distributorEndpoint,
      nginxGatewayEndpoint: this.nginxGatewayEndpoint,
    });
  }

  public getQueryFrontendUrl(): pulumi.Output<string> {
    return this.queryFrontendEndpoint;
  }

  public getDistributorUrl(): pulumi.Output<string> {
    return this.distributorEndpoint;
  }

  public getNginxGatewayUrl(): pulumi.Output<string> {
    return this.nginxGatewayEndpoint;
  }

  public getPrometheusRemoteWriteUrl(): pulumi.Output<string> {
    return pulumi.interpolate`${this.distributorEndpoint}/api/v1/push`;
  }
}

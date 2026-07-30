import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { DOCKER_IMAGES } from "../docker-images";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

const mimirScrapeAnnotations = (component: string, port: string = "8080"): Record<string, string> => ({
  "k8s.grafana.com/scrape": "true",
  "k8s.grafana.com/job": `mimir/${component}`,
  "k8s.grafana.com/metrics.path": "/metrics",
  "k8s.grafana.com/metrics.portNumber": port,
  "k8s.grafana.com/metrics.scheme": "http",
  "k8s.grafana.com/metrics.scrapeInterval": "30s",
});

export interface MimirArgs extends WorkloadLabelArgs {
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

  multitenancy?: {
    enabled?: boolean;
  };

  limits?: {
    ingestionRate?: number;
    ingestionBurstSize?: number;
    maxGlobalSeriesPerUser?: number;
  };

  kafka?: {
    bootstrapServers: pulumi.Input<string>;
    topic: pulumi.Input<string>;
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

  httpRoute?: {
    hostname: pulumi.Input<string>;
    gatewayName?: pulumi.Input<string>;
    gatewayNamespace?: pulumi.Input<string>;
  };

  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
}

export class Mimir extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;
  public readonly queryFrontendEndpoint: pulumi.Output<string>;
  public readonly distributorEndpoint: pulumi.Output<string>;
  public readonly gatewayEndpoint: pulumi.Output<string>;
  public readonly httpRoute?: k8s.apiextensions.CustomResource;

  private readonly chartReleaseName: string;

  constructor(name: string, args: MimirArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Mimir", name, args, withWorkloadLabels(opts, args.workloadLabels));

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
            enabled: false,
          },

          mimir: {
            structuredConfig: {
              multitenancy_enabled: args.multitenancy?.enabled ?? false,

              usage_stats: {
                enabled: false,
              },

              ingest_storage: {
                enabled: !!args.kafka,
                ...(args.kafka && {
                  kafka: {
                    address: args.kafka.bootstrapServers,
                    topic: args.kafka.topic,
                  },
                }),
              },

              memberlist: {
                cluster_label: "mimir",
              },

              ingester: {
                push_grpc_method_enabled: !args.kafka,
              },

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

              limits: {
                ...(args.limits?.ingestionRate !== undefined && {
                  ingestion_rate: args.limits.ingestionRate,
                }),
                ...(args.limits?.ingestionBurstSize !== undefined && {
                  ingestion_burst_size: args.limits.ingestionBurstSize,
                }),
                ...(args.limits?.maxGlobalSeriesPerUser !== undefined && {
                  max_global_series_per_user: args.limits.maxGlobalSeriesPerUser,
                }),
                ruler_max_rules_per_rule_group: 30,
                ruler_max_rule_groups_per_tenant: 100,
              },
            },
          },

          ingester: {
            replicas: args.replicas?.ingester ?? 3,
            podAnnotations: mimirScrapeAnnotations("ingester"),
            persistentVolume: {
              size: "50Gi",
            },
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
            podAnnotations: mimirScrapeAnnotations("querier"),
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
            podAnnotations: mimirScrapeAnnotations("query-frontend"),
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
            podAnnotations: mimirScrapeAnnotations("distributor"),
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
            podAnnotations: mimirScrapeAnnotations("compactor"),
            persistentVolume: {
              size: "50Gi",
            },
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
            podAnnotations: mimirScrapeAnnotations("store-gateway"),
            persistentVolume: {
              size: "20Gi",
            },
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
            podAnnotations: mimirScrapeAnnotations("ruler"),
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
            podAnnotations: mimirScrapeAnnotations("alertmanager"),
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
          },

          query_scheduler: {
            podAnnotations: mimirScrapeAnnotations("query-scheduler"),
          },

          overrides_exporter: {
            podAnnotations: mimirScrapeAnnotations("overrides-exporter"),
          },

          rollout_operator: {
            podAnnotations: mimirScrapeAnnotations("rollout-operator", "8001"),
            serviceMonitor: {
              enabled: false,
            },
          },

          metaMonitoring: {
            serviceMonitor: {
              enabled: false,
            },
          },

        },
      },
      { parent: this, dependsOn: helmDependencies }
    );

    this.queryFrontendEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-query-frontend.${this.namespace}:8080/prometheus`;
    this.distributorEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-distributor.${this.namespace}:8080`;
    this.gatewayEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-gateway.${this.namespace}:80`;

    if (args.httpRoute) {
      this.httpRoute = new k8s.apiextensions.CustomResource(`${name}-httproute`, {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "HTTPRoute",
        metadata: {
          name: `${name}-prometheus`,
          namespace: args.namespace,
        },
        spec: {
          parentRefs: [{
            group: "gateway.networking.k8s.io",
            kind: "Gateway",
            name: args.httpRoute.gatewayName ?? "default-gateway",
            namespace: args.httpRoute.gatewayNamespace ?? "ingress",
          }],
          hostnames: [args.httpRoute.hostname],
          rules: [{
            matches: [{
              method: "GET",
              path: { type: "PathPrefix", value: "/prometheus/" },
            }],
            backendRefs: [{
              name: `${this.chartReleaseName}-gateway`,
              port: 80,
            }],
          }],
        },
      }, { parent: this, dependsOn: [this.chart] });
    }

    if (rulesConfigMap) {
      const rulerEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-ruler.${this.namespace}:8080`;
      
      const uploadScript = pulumi.all([rulesConfigMap.data, rulerEndpoint]).apply(([data, endpoint]) => {
        const filenames = Object.keys(data || {}).map(f => `/rules/${f}`).join(" ");
        return `mimirtool rules sync ${filenames} --address=${endpoint} --id=anonymous`;
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
                    image: DOCKER_IMAGES.ALPINE.image,
                    command: ["/bin/sh", "-c"],
                    args: [pulumi.interpolate`
                      apk add --no-cache curl && 
                      curl -fsSL https://github.com/grafana/mimir/releases/latest/download/mimirtool-linux-amd64 -o /usr/local/bin/mimirtool &&
                      chmod +x /usr/local/bin/mimirtool &&
                      ${uploadScript}
                    `],
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
      gatewayEndpoint: this.gatewayEndpoint,
      httpRoute: this.httpRoute,
    });
  }

  public getQueryFrontendUrl(): pulumi.Output<string> {
    return this.queryFrontendEndpoint;
  }

  public getDistributorUrl(): pulumi.Output<string> {
    return this.distributorEndpoint;
  }

  public getGatewayUrl(): pulumi.Output<string> {
    return this.gatewayEndpoint;
  }

  public getPrometheusRemoteWriteUrl(): pulumi.Output<string> {
    return pulumi.interpolate`${this.distributorEndpoint}/api/v1/push`;
  }
}

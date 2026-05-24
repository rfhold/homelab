import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface PyroscopeArgs {
  namespace: pulumi.Input<string>;

  s3: {
    endpoint: pulumi.Input<string>;
    region?: pulumi.Input<string>;
    bucket: pulumi.Input<string>;
    accessKeyId: pulumi.Input<string>;
    secretAccessKey: pulumi.Input<string>;
    insecureSkipVerify?: pulumi.Input<boolean>;
  };

  replicas?: {
    distributor?: number;
    ingester?: number;
    querier?: number;
    queryFrontend?: number;
    queryScheduler?: number;
    compactor?: number;
    storeGateway?: number;
    tenantSettings?: number;
    adhocProfiles?: number;
  };

  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
}

export class Pyroscope extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;
  public readonly readEndpoint: pulumi.Output<string>;
  public readonly writeEndpoint: pulumi.Output<string>;

  private readonly chartReleaseName: string;

  constructor(name: string, args: PyroscopeArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Pyroscope", name, args, opts);

    const chartConfig = HELM_CHARTS.PYROSCOPE;
    this.chartReleaseName = `${name}-chart`;
    this.namespace = pulumi.output(args.namespace);

    const s3Endpoint = pulumi.output(args.s3.endpoint).apply((endpoint) => {
      return endpoint.replace(/^https?:\/\//, "");
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
          AWS_ACCESS_KEY_ID: args.s3.accessKeyId,
          AWS_SECRET_ACCESS_KEY: args.s3.secretAccessKey,
        },
      },
      { parent: this }
    );

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          alloy: {
            enabled: false,
          },

          agent: {
            enabled: false,
          },

          minio: {
            enabled: false,
          },

          architecture: {
            storage: {
              v1: false,
              v2: true,
            },
            deployUnifiedServices: true,
            microservices: {
              enabled: true,
            },
          },

          pyroscope: {
            extraArgs: {
              "config.expand-env": "true",
            },
            extraEnvFrom: [
              {
                secretRef: {
                  name: s3CredentialsSecret.metadata.name,
                },
              },
            ],
            ...(args.tolerations && { tolerations: args.tolerations }),
            structuredConfig: {
              storage: {
                backend: "s3",
                s3: {
                  endpoint: s3Endpoint,
                  bucket_name: args.s3.bucket,
                  access_key_id: "${AWS_ACCESS_KEY_ID}",
                  secret_access_key: "${AWS_SECRET_ACCESS_KEY}",
                  ...(args.s3.region && { region: args.s3.region }),
                  insecure: pulumi
                    .output(args.s3.endpoint)
                    .apply((endpoint) => endpoint.startsWith("http://")),
                  ...(args.s3.insecureSkipVerify && {
                    http: {
                      insecure_skip_verify: args.s3.insecureSkipVerify,
                    },
                  }),
                },
              },
            },
          },
        },
      },
      { parent: this, dependsOn: [s3CredentialsSecret] }
    );

    this.readEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-read.${this.namespace}:80`;
    this.writeEndpoint = pulumi.interpolate`http://${this.chartReleaseName}-write.${this.namespace}:80`;

    this.registerOutputs({
      chart: this.chart,
      namespace: this.namespace,
      readEndpoint: this.readEndpoint,
      writeEndpoint: this.writeEndpoint,
    });
  }

  public getReadUrl(): pulumi.Output<string> {
    return this.readEndpoint;
  }

  public getWriteUrl(): pulumi.Output<string> {
    return this.writeEndpoint;
  }
}

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { StorageConfig, createPVCSpec } from "../adapters/storage";

/**
 * Configuration for the NATS component
 */
export interface NatsArgs {
  namespace: pulumi.Input<string>;
  storage?: StorageConfig;
  memStorageSize?: pulumi.Input<string>;
  cpu?: pulumi.Input<string>;
  memory?: pulumi.Input<string>;
}

/**
 * NATS component - cloud native messaging system with JetStream persistence
 */
export class Nats extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly clientUrl: pulumi.Output<string>;

  constructor(name: string, args: NatsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Nats", name, args, opts);

    const chartConfig = HELM_CHARTS.NATS;

    const cpu = args.cpu || "500m";
    const memory = args.memory || "512Mi";
    const memStorageSize = args.memStorageSize || "256Mi";
    const goMemLimit = pulumi.output(memory).apply(m => `${m}B`);

    const storageConfig: StorageConfig = {
      size: args.storage?.size || "10Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    const pvcSpec = createPVCSpec(storageConfig);

    const chartReleaseName = name;

    this.chart = new k8s.helm.v4.Chart(
      chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          config: {
            jetstream: {
              enabled: true,
              memStorage: {
                enabled: true,
                size: memStorageSize,
              },
              fileStorage: {
                enabled: true,
                pvc: {
                  size: storageConfig.size,
                  storageClassName: storageConfig.storageClass,
                },
              },
            },
          },
          container: {
            env: {
              GOMEMLIMIT: goMemLimit,
            },
            merge: {
              resources: {
                requests: { cpu, memory },
                limits: { cpu, memory },
              },
            },
          },
          podTemplate: {
            merge: {
              metadata: {
                annotations: {
                  "k8s.grafana.com/scrape": "true",
                  "k8s.grafana.com/job": "nats",
                  "k8s.grafana.com/metrics.portNumber": "7777",
                  "k8s.grafana.com/metrics.path": "/metrics",
                  "k8s.grafana.com/metrics.scheme": "http",
                },
              },
              spec: {
                terminationGracePeriodSeconds: 60,
              },
            },
          },
          promExporter: {
            enabled: true,
            port: 7777,
          },
          natsBox: {
            enabled: true,
          },
        },
      },
      { parent: this }
    );

    this.clientUrl = pulumi.interpolate`nats://${chartReleaseName}.${args.namespace}.svc.cluster.local:4222`;

    this.registerOutputs({
      chart: this.chart,
      clientUrl: this.clientUrl,
    });
  }
}

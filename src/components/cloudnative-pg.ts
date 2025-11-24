import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

export interface CloudNativePGArgs {
  namespace: pulumi.Input<string>;
  monitoring?: {
    enablePodMonitor?: pulumi.Input<boolean>;
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
}

export class CloudNativePG extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;

  constructor(name: string, args: CloudNativePGArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CloudNativePG", name, args, opts);

    const chartConfig = HELM_CHARTS.CLOUDNATIVE_PG;

    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        chart: chartConfig.chart,
        version: chartConfig.version,
        namespace: args.namespace,
        repositoryOpts: {
          repo: chartConfig.repository,
        },
        values: {
          monitoring: {
            podMonitorEnabled: args.monitoring?.enablePodMonitor ?? true,
          },
          resources: args.resources,
        },
      },
      { parent: this }
    );

    this.namespace = pulumi.output(args.namespace);

    this.registerOutputs({
      chart: this.chart,
      namespace: this.namespace,
    });
  }
}

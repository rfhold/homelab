import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

export interface ReloaderArgs {
  namespace: pulumi.Input<string>;
}

export class Reloader extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: ReloaderArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Reloader", name, args, opts);

    const chartConfig = HELM_CHARTS.RELOADER;

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
          reloader: {
            watchGlobally: true,
            reloadStrategy: "annotations",
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
    });
  }
}

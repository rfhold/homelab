import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface ReloaderArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
}

export class Reloader extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: ReloaderArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Reloader", name, args, withWorkloadLabels(opts, args.workloadLabels));

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

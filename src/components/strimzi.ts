import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface StrimziArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  watchAnyNamespace?: pulumi.Input<boolean>;
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

export class Strimzi extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;

  constructor(name: string, args: StrimziArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Strimzi", name, args, withWorkloadLabels(opts, args.workloadLabels));

    const chartConfig = HELM_CHARTS.STRIMZI;

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
          watchAnyNamespace: args.watchAnyNamespace ?? true,
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

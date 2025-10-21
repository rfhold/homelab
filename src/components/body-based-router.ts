import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface BodyBasedRouterArgs {
  namespace: pulumi.Input<string>;
  provider?: string;
}

export class BodyBasedRouter extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: BodyBasedRouterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:BodyBasedRouter", name, args, opts);

    const provider = args.provider || "none";

    const chartConfig = HELM_CHARTS.GATEWAY_API_BODY_BASED_ROUTING;
    const chartArgs = createHelmChartArgs(chartConfig, args.namespace);

    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        ...chartArgs,
        values: {
          provider: {
            name: provider,
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

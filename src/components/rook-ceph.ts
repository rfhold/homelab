import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

export interface RookCephArgs {
  namespace: pulumi.Input<string>;
  enableCsiDriver?: pulumi.Input<boolean>;
  enableMonitoring?: pulumi.Input<boolean>;
  logLevel?: pulumi.Input<string>;
  obcAllowedAdditionalConfigFields?: pulumi.Input<string>;
  csiPluginTolerations?: pulumi.Input<any[]>;
  csiProvisionerTolerations?: pulumi.Input<any[]>;
}

export class RookCeph extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: RookCephArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:RookCeph", name, args, opts);

    const chartConfig = HELM_CHARTS.ROOK_CEPH;

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
          csi: {
            disableCsiDriver: pulumi.output(args.enableCsiDriver ?? true).apply(enabled => !enabled),
            pluginTolerations: args.csiPluginTolerations,
            provisionerTolerations: args.csiProvisionerTolerations,
          },
          monitoring: {
            enabled: true,
          },
          logLevel: args.logLevel ?? "INFO",
          obcAllowAdditionalConfigFields: args.obcAllowedAdditionalConfigFields,
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
    });
  }
}

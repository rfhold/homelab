import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

export interface RookCephArgs {
  /** Namespace to deploy the Rook Ceph operator */
  namespace: pulumi.Input<string>;
  /** Enable CSI driver (default: true) */
  enableCsiDriver?: pulumi.Input<boolean>;
  /** Enable monitoring (default: false) */
  enableMonitoring?: pulumi.Input<boolean>;
  /** Log level for the operator (default: INFO) */
  logLevel?: pulumi.Input<string>;
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
          },
          monitoring: {
            enabled: args.enableMonitoring ?? false,
          },
          logLevel: args.logLevel ?? "INFO",
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
    });
  }
}

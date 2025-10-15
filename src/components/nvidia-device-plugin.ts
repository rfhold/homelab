import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

export interface NvidiaDevicePluginArgs {
  namespace: pulumi.Input<string>;
  runtimeClassName?: pulumi.Input<string>;
  deviceDiscoveryStrategy?: pulumi.Input<string>;
  tolerations?: pulumi.Input<{
    key?: pulumi.Input<string>;
    operator?: pulumi.Input<string>;
    value?: pulumi.Input<string>;
    effect?: pulumi.Input<string>;
  }>[];
  nodeSelector?: pulumi.Input<Record<string, pulumi.Input<string>>>;
  gfdEnabled?: pulumi.Input<boolean>;
}

export class NvidiaDevicePlugin extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: NvidiaDevicePluginArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:NvidiaDevicePlugin", name, args, opts);

    const chartConfig = HELM_CHARTS.NVIDIA_DEVICE_PLUGIN;

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
          devicePlugin: {
            enabled: true,
          },
          runtimeClassName: args.runtimeClassName || "nvidia",
          deviceDiscoveryStrategy: args.deviceDiscoveryStrategy || "nvml",
          gfd: {
            enabled: args.gfdEnabled ?? true,
          },
          tolerations: args.tolerations || [],
          nodeSelector: args.nodeSelector || {},
          nfd: {
            worker: {
              tolerations: args.tolerations || [],
              nodeSelector: args.nodeSelector || {},
            },
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

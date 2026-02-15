import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface InferencePoolArgs {
  namespace: pulumi.Input<string>;
  selector: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  targetPorts: pulumi.Input<pulumi.Input<{ number: pulumi.Input<number> }>[]>;
  gatewayProvider?: "gke" | "istio" | "none";
  httpRoute?: {
    enabled: boolean;
    gatewayName: pulumi.Input<string>;
    baseModel: pulumi.Input<string>;
  };
}

export class InferencePool extends pulumi.ComponentResource {
  public readonly chart?: k8s.helm.v4.Chart;

  constructor(public name: string, args: InferencePoolArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:InferencePool", name, args, opts);

    const gatewayProvider = args.gatewayProvider ?? "none";

    const chartConfig = HELM_CHARTS.GATEWAY_API_INFERENCE_POOL;
    const chartArgs = createHelmChartArgs(chartConfig, args.namespace);

    const helmValues: any = {
      inferencePool: {
        modelServers: {
          matchLabels: args.selector,
        },
      },
      provider: {
        name: gatewayProvider,
      },
    };

    if (args.httpRoute?.enabled) {
      helmValues.experimentalHttpRoute = {
        enabled: true,
        inferenceGatewayName: args.httpRoute.gatewayName,
        baseModel: args.httpRoute.baseModel,
      };
    }

    this.chart = new k8s.helm.v4.Chart(name,
      {
        ...chartArgs,
        values: helmValues,
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
    });
  }

  public getPoolName(): pulumi.Output<string> {
    return pulumi.output(this.name);
  }
}

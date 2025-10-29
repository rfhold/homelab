import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface K8sMonitoringDestination {
  name: pulumi.Input<string>;
  type: "otlp" | "prometheus" | "loki";
  url: pulumi.Input<string>;
  protocol?: pulumi.Input<string>;
}

export interface K8sMonitoringArgs {
  namespace: pulumi.Input<string>;
  clusterName: pulumi.Input<string>;
  destinations: K8sMonitoringDestination[];

  clusterMetrics?: {
    enabled?: boolean;
  };

  podLogs?: {
    enabled?: boolean;
  };

  alloyMetrics?: {
    enabled?: boolean;
  };

  alloyLogs?: {
    enabled?: boolean;
  };
}

export class K8sMonitoring extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;

  private readonly chartReleaseName: string;

  constructor(name: string, args: K8sMonitoringArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:K8sMonitoring", name, args, opts);

    const chartConfig = HELM_CHARTS.K8S_MONITORING;
    this.chartReleaseName = `${name}-chart`;
    this.namespace = pulumi.output(args.namespace);

    const clusterMetricsEnabled = args.clusterMetrics?.enabled ?? true;
    const podLogsEnabled = args.podLogs?.enabled ?? true;
    const alloyMetricsEnabled = args.alloyMetrics?.enabled ?? true;
    const alloyLogsEnabled = args.alloyLogs?.enabled ?? true;

    const destinations = args.destinations.map((dest) => ({
      name: dest.name,
      type: dest.type,
      url: dest.url,
      ...(dest.protocol && { protocol: dest.protocol }),
    }));

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          cluster: {
            name: args.clusterName,
          },

          destinations: destinations,

          clusterMetrics: {
            enabled: clusterMetricsEnabled,
            ...(clusterMetricsEnabled ? { "node-exporter": { enabled: true, metricsTuning: { useIntegrationAllowList: true } } } : {}),
          },

          podLogs: {
            enabled: podLogsEnabled,
          },

          "alloy-metrics": {
            enabled: alloyMetricsEnabled,
          },

          "alloy-logs": {
            enabled: alloyLogsEnabled,
          },

          ...(alloyLogsEnabled ? {
            nodeLogs: {
              enabled: true,
              journal: {
                jobLabel: "integrations/node_exporter",
              },
              lebelsToKeep: ["instance", "job", "level", "name", "unit", "service_name", "source", "transport", "boot_id"],
              extraLogProcessingStages: `
stage.labels {
  values = {
    boot_id = "__journal__boot_id",
    transport = "__journal__transport",
  }
}`,
            }
          } : {}),
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
      namespace: this.namespace,
    });
  }
}

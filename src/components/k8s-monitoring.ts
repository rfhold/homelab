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

  annotationAutodiscovery?: {
    enabled?: boolean;
    scrapeInterval?: string;
    scrapeTimeout?: string;
    namespaces?: string[];
    excludeNamespaces?: string[];
    pods?: {
      enabled?: boolean;
      labelSelectors?: Record<string, string | string[]>;
      staticLabels?: Record<string, string>;
    };
    services?: {
      enabled?: boolean;
      labelSelectors?: Record<string, string | string[]>;
      staticLabels?: Record<string, string>;
    };
    metricsTuning?: {
      includeMetrics?: string[];
      excludeMetrics?: string[];
    };
  };

  prometheusOperatorObjects?: {
    enabled?: boolean;
    crds?: {
      deploy?: boolean;
    };
    serviceMonitors?: {
      enabled?: boolean;
      scrapeInterval?: string;
      namespaces?: string[];
      excludeNamespaces?: string[];
      labelSelectors?: Record<string, string | string[]>;
      metricsTuning?: {
        includeMetrics?: string[];
        excludeMetrics?: string[];
      };
    };
    podMonitors?: {
      enabled?: boolean;
      scrapeInterval?: string;
      namespaces?: string[];
      excludeNamespaces?: string[];
      labelSelectors?: Record<string, string | string[]>;
      metricsTuning?: {
        includeMetrics?: string[];
        excludeMetrics?: string[];
      };
    };
    probes?: {
      enabled?: boolean;
      scrapeInterval?: string;
      namespaces?: string[];
      excludeNamespaces?: string[];
      labelSelectors?: Record<string, string | string[]>;
      metricsTuning?: {
        includeMetrics?: string[];
        excludeMetrics?: string[];
      };
    };
  };

  integrations?: {
    grafana?: Array<{
      name: string;
      namespace?: string;
      labelSelectors?: Record<string, string>;
      metricsTuning?: {
        includeMetrics?: string[];
        excludeMetrics?: string[];
      };
    }>;
    loki?: Array<{
      name: string;
      namespace?: string;
      labelSelectors?: Record<string, string>;
      metricsTuning?: {
        includeMetrics?: string[];
        excludeMetrics?: string[];
      };
    }>;
    alloy?: Array<{
      name: string;
      namespace?: string;
      labelSelectors?: Record<string, string>;
      metricsTuning?: {
        includeMetrics?: string[];
        excludeMetrics?: string[];
      };
    }>;
    mimir?: Array<{
      name: string;
      namespace?: string;
      labelSelectors?: Record<string, string>;
      metricsTuning?: {
        includeMetrics?: string[];
        excludeMetrics?: string[];
      };
    }>;
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
    const annotationAutodiscoveryEnabled = args.annotationAutodiscovery?.enabled ?? false;
    const prometheusOperatorObjectsEnabled = args.prometheusOperatorObjects?.enabled ?? false;

    const grafanaIntegrationEnabled = (args.integrations?.grafana?.length ?? 0) > 0;
    const lokiIntegrationEnabled = (args.integrations?.loki?.length ?? 0) > 0;
    const alloyIntegrationEnabled = (args.integrations?.alloy?.length ?? 0) > 0;
    const mimirIntegrationEnabled = (args.integrations?.mimir?.length ?? 0) > 0;
    const integrationsEnabled = grafanaIntegrationEnabled || lokiIntegrationEnabled || alloyIntegrationEnabled || mimirIntegrationEnabled;

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

          ...(annotationAutodiscoveryEnabled ? {
            annotationAutodiscovery: {
              enabled: true,
              ...(args.annotationAutodiscovery?.scrapeInterval && { scrapeInterval: args.annotationAutodiscovery.scrapeInterval }),
              ...(args.annotationAutodiscovery?.scrapeTimeout && { scrapeTimeout: args.annotationAutodiscovery.scrapeTimeout }),
              ...(args.annotationAutodiscovery?.namespaces && { namespaces: args.annotationAutodiscovery.namespaces }),
              ...(args.annotationAutodiscovery?.excludeNamespaces && { excludeNamespaces: args.annotationAutodiscovery.excludeNamespaces }),
              ...(args.annotationAutodiscovery?.pods && {
                pods: {
                  ...(args.annotationAutodiscovery.pods.enabled !== undefined && { enabled: args.annotationAutodiscovery.pods.enabled }),
                  ...(args.annotationAutodiscovery.pods.labelSelectors && { labelSelectors: args.annotationAutodiscovery.pods.labelSelectors }),
                  ...(args.annotationAutodiscovery.pods.staticLabels && { staticLabels: args.annotationAutodiscovery.pods.staticLabels }),
                },
              }),
              ...(args.annotationAutodiscovery?.services && {
                services: {
                  ...(args.annotationAutodiscovery.services.enabled !== undefined && { enabled: args.annotationAutodiscovery.services.enabled }),
                  ...(args.annotationAutodiscovery.services.labelSelectors && { labelSelectors: args.annotationAutodiscovery.services.labelSelectors }),
                  ...(args.annotationAutodiscovery.services.staticLabels && { staticLabels: args.annotationAutodiscovery.services.staticLabels }),
                },
              }),
              ...(args.annotationAutodiscovery?.metricsTuning && {
                metricsTuning: {
                  ...(args.annotationAutodiscovery.metricsTuning.includeMetrics && { includeMetrics: args.annotationAutodiscovery.metricsTuning.includeMetrics }),
                  ...(args.annotationAutodiscovery.metricsTuning.excludeMetrics && { excludeMetrics: args.annotationAutodiscovery.metricsTuning.excludeMetrics }),
                },
              }),
            },
          } : {}),

          ...(prometheusOperatorObjectsEnabled ? {
            prometheusOperatorObjects: {
              enabled: true,
              ...(args.prometheusOperatorObjects?.crds && {
                crds: {
                  ...(args.prometheusOperatorObjects.crds.deploy !== undefined && { deploy: args.prometheusOperatorObjects.crds.deploy }),
                },
              }),
              ...(args.prometheusOperatorObjects?.serviceMonitors && {
                serviceMonitors: {
                  ...(args.prometheusOperatorObjects.serviceMonitors.enabled !== undefined && { enabled: args.prometheusOperatorObjects.serviceMonitors.enabled }),
                  ...(args.prometheusOperatorObjects.serviceMonitors.scrapeInterval && { scrapeInterval: args.prometheusOperatorObjects.serviceMonitors.scrapeInterval }),
                  ...(args.prometheusOperatorObjects.serviceMonitors.namespaces && { namespaces: args.prometheusOperatorObjects.serviceMonitors.namespaces }),
                  ...(args.prometheusOperatorObjects.serviceMonitors.excludeNamespaces && { excludeNamespaces: args.prometheusOperatorObjects.serviceMonitors.excludeNamespaces }),
                  ...(args.prometheusOperatorObjects.serviceMonitors.labelSelectors && { labelSelectors: args.prometheusOperatorObjects.serviceMonitors.labelSelectors }),
                  ...(args.prometheusOperatorObjects.serviceMonitors.metricsTuning && {
                    metricsTuning: {
                      ...(args.prometheusOperatorObjects.serviceMonitors.metricsTuning.includeMetrics && { includeMetrics: args.prometheusOperatorObjects.serviceMonitors.metricsTuning.includeMetrics }),
                      ...(args.prometheusOperatorObjects.serviceMonitors.metricsTuning.excludeMetrics && { excludeMetrics: args.prometheusOperatorObjects.serviceMonitors.metricsTuning.excludeMetrics }),
                    },
                  }),
                },
              }),
              ...(args.prometheusOperatorObjects?.podMonitors && {
                podMonitors: {
                  ...(args.prometheusOperatorObjects.podMonitors.enabled !== undefined && { enabled: args.prometheusOperatorObjects.podMonitors.enabled }),
                  ...(args.prometheusOperatorObjects.podMonitors.scrapeInterval && { scrapeInterval: args.prometheusOperatorObjects.podMonitors.scrapeInterval }),
                  ...(args.prometheusOperatorObjects.podMonitors.namespaces && { namespaces: args.prometheusOperatorObjects.podMonitors.namespaces }),
                  ...(args.prometheusOperatorObjects.podMonitors.excludeNamespaces && { excludeNamespaces: args.prometheusOperatorObjects.podMonitors.excludeNamespaces }),
                  ...(args.prometheusOperatorObjects.podMonitors.labelSelectors && { labelSelectors: args.prometheusOperatorObjects.podMonitors.labelSelectors }),
                  ...(args.prometheusOperatorObjects.podMonitors.metricsTuning && {
                    metricsTuning: {
                      ...(args.prometheusOperatorObjects.podMonitors.metricsTuning.includeMetrics && { includeMetrics: args.prometheusOperatorObjects.podMonitors.metricsTuning.includeMetrics }),
                      ...(args.prometheusOperatorObjects.podMonitors.metricsTuning.excludeMetrics && { excludeMetrics: args.prometheusOperatorObjects.podMonitors.metricsTuning.excludeMetrics }),
                    },
                  }),
                },
              }),
              ...(args.prometheusOperatorObjects?.probes && {
                probes: {
                  ...(args.prometheusOperatorObjects.probes.enabled !== undefined && { enabled: args.prometheusOperatorObjects.probes.enabled }),
                  ...(args.prometheusOperatorObjects.probes.scrapeInterval && { scrapeInterval: args.prometheusOperatorObjects.probes.scrapeInterval }),
                  ...(args.prometheusOperatorObjects.probes.namespaces && { namespaces: args.prometheusOperatorObjects.probes.namespaces }),
                  ...(args.prometheusOperatorObjects.probes.excludeNamespaces && { excludeNamespaces: args.prometheusOperatorObjects.probes.excludeNamespaces }),
                  ...(args.prometheusOperatorObjects.probes.labelSelectors && { labelSelectors: args.prometheusOperatorObjects.probes.labelSelectors }),
                  ...(args.prometheusOperatorObjects.probes.metricsTuning && {
                    metricsTuning: {
                      ...(args.prometheusOperatorObjects.probes.metricsTuning.includeMetrics && { includeMetrics: args.prometheusOperatorObjects.probes.metricsTuning.includeMetrics }),
                      ...(args.prometheusOperatorObjects.probes.metricsTuning.excludeMetrics && { excludeMetrics: args.prometheusOperatorObjects.probes.metricsTuning.excludeMetrics }),
                    },
                  }),
                },
              }),
            },
          } : {}),

          ...(integrationsEnabled ? {
            integrations: {
              ...(grafanaIntegrationEnabled && args.integrations?.grafana ? {
                grafana: {
                  instances: args.integrations.grafana.map((instance) => ({
                    name: instance.name,
                    ...(instance.namespace && { namespace: instance.namespace }),
                    ...(instance.labelSelectors && { labelSelectors: instance.labelSelectors }),
                    ...(instance.metricsTuning && {
                      metricsTuning: {
                        ...(instance.metricsTuning.includeMetrics && { includeMetrics: instance.metricsTuning.includeMetrics }),
                        ...(instance.metricsTuning.excludeMetrics && { excludeMetrics: instance.metricsTuning.excludeMetrics }),
                      },
                    }),
                  })),
                },
              } : {}),
              ...(lokiIntegrationEnabled && args.integrations?.loki ? {
                loki: {
                  instances: args.integrations.loki.map((instance) => ({
                    name: instance.name,
                    ...(instance.namespace && { namespace: instance.namespace }),
                    ...(instance.labelSelectors && { labelSelectors: instance.labelSelectors }),
                    ...(instance.metricsTuning && {
                      metricsTuning: {
                        ...(instance.metricsTuning.includeMetrics && { includeMetrics: instance.metricsTuning.includeMetrics }),
                        ...(instance.metricsTuning.excludeMetrics && { excludeMetrics: instance.metricsTuning.excludeMetrics }),
                      },
                    }),
                  })),
                },
              } : {}),
              ...(alloyIntegrationEnabled && args.integrations?.alloy ? {
                alloy: {
                  instances: args.integrations.alloy.map((instance) => ({
                    name: instance.name,
                    ...(instance.namespace && { namespace: instance.namespace }),
                    ...(instance.labelSelectors && { labelSelectors: instance.labelSelectors }),
                    ...(instance.metricsTuning && {
                      metricsTuning: {
                        ...(instance.metricsTuning.includeMetrics && { includeMetrics: instance.metricsTuning.includeMetrics }),
                        ...(instance.metricsTuning.excludeMetrics && { excludeMetrics: instance.metricsTuning.excludeMetrics }),
                      },
                    }),
                  })),
                },
              } : {}),
              ...(mimirIntegrationEnabled && args.integrations?.mimir ? {
                mimir: {
                  instances: args.integrations.mimir.map((instance) => ({
                    name: instance.name,
                    ...(instance.namespace && { namespace: instance.namespace }),
                    ...(instance.labelSelectors && { labelSelectors: instance.labelSelectors }),
                    ...(instance.metricsTuning && {
                      metricsTuning: {
                        ...(instance.metricsTuning.includeMetrics && { includeMetrics: instance.metricsTuning.includeMetrics }),
                        ...(instance.metricsTuning.excludeMetrics && { excludeMetrics: instance.metricsTuning.excludeMetrics }),
                      },
                    }),
                  })),
                },
              } : {}),
            },
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

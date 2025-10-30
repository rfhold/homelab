import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createConnectionSafePassword } from "../adapters/postgres";

export interface GrafanaDatasource {
  name: string;
  type: string;
  access: string;
  url: pulumi.Input<string>;
  isDefault?: boolean;
  editable?: boolean;
  orgId?: number;
  jsonData?: Record<string, any>;
  secureJsonData?: Record<string, pulumi.Input<string>>;
}

export type GrafanaDashboard = unknown;

export interface GrafanaArgs {
  namespace: pulumi.Input<string>;

  adminUsername?: pulumi.Input<string>;
  adminPassword?: pulumi.Input<string>;

  datasources?: GrafanaDatasource[];
  dashboards?: Record<string, Record<string, GrafanaDashboard>>;

  ingress?: {
    enabled?: boolean;
    className?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
    hostname?: pulumi.Input<string>;
    tls?: {
      secretName?: pulumi.Input<string>;
    };
  };

  memoryLimit?: pulumi.Input<string>;
  cpuLimit?: pulumi.Input<string>;
  memoryRequest?: pulumi.Input<string>;
  cpuRequest?: pulumi.Input<string>;
}

export class Grafana extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly adminPassword: ReturnType<typeof createConnectionSafePassword>;

  private readonly chartReleaseName: string;
  private readonly namespace: pulumi.Input<string>;

  constructor(name: string, args: GrafanaArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Grafana", name, args, opts);

    const chartConfig = HELM_CHARTS.GRAFANA;

    this.chartReleaseName = `${name}-chart`;
    this.namespace = args.namespace;

    this.adminPassword = createConnectionSafePassword(`${name}-admin-password`, 32, { parent: this });

    const datasourcesConfig = args.datasources && args.datasources.length > 0
      ? pulumi.output(args.datasources).apply(datasources => ({
          "datasources.yaml": {
            apiVersion: 1,
            datasources: datasources.map(ds => ({
              name: ds.name,
              type: ds.type,
              access: ds.access,
              url: ds.url,
              isDefault: ds.isDefault,
              editable: ds.editable,
              orgId: ds.orgId,
              ...(ds.jsonData && { jsonData: ds.jsonData }),
              ...(ds.secureJsonData && { secureJsonData: ds.secureJsonData }),
            })),
          },
        }))
      : undefined;

    const dashboardsConfig = args.dashboards && Object.keys(args.dashboards).length > 0
      ? args.dashboards
      : undefined;

    const dashboardProvidersConfig = dashboardsConfig
      ? {
          "dashboardproviders.yaml": {
            apiVersion: 1,
            providers: Object.keys(dashboardsConfig).map(folderName => ({
              name: folderName,
              orgId: 1,
              folder: folderName,
              type: "file",
              disableDeletion: false,
              editable: true,
              options: {
                path: `/var/lib/grafana/dashboards/${folderName}`,
              },
            })),
          },
        }
      : undefined;

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          adminUser: args.adminUsername || "admin",
          adminPassword: args.adminPassword || this.adminPassword.result,

          persistence: {
            enabled: false,
          },

          ...(datasourcesConfig ? { datasources: datasourcesConfig } : {}),
          ...(dashboardsConfig ? { dashboards: dashboardsConfig } : {}),
          ...(dashboardProvidersConfig ? { dashboardProviders: dashboardProvidersConfig } : {}),

          ingress: {
            enabled: args.ingress?.enabled || false,
            ingressClassName: args.ingress?.className,
            annotations: args.ingress?.annotations || {},
            hosts: args.ingress?.hostname ? [args.ingress.hostname] : [],
            tls: args.ingress?.tls ? [
              {
                secretName: args.ingress.tls.secretName,
                hosts: args.ingress?.hostname ? [args.ingress.hostname] : [],
              },
            ] : [],
          },

          resources: {
            limits: {
              memory: args.memoryLimit,
              cpu: args.cpuLimit,
            },
            requests: {
              memory: args.memoryRequest || "256Mi",
              cpu: args.cpuRequest || "100m",
            },
          },

          service: {
            type: "ClusterIP",
            port: 80,
            targetPort: 3000,
          },

          testFramework: {
            enabled: false,
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
      adminPassword: this.adminPassword,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}-grafana.${this.namespace}:80`;
  }

  public getAdminPassword(): pulumi.Output<string> {
    return pulumi.output(this.adminPassword.result);
  }
}

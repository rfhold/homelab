import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createConnectionSafePassword } from "../adapters/postgres";
import { DOCKER_IMAGES } from "../docker-images";

export interface GrafanaArgs {
  namespace: pulumi.Input<string>;

  adminUsername?: pulumi.Input<string>;
  adminPassword?: pulumi.Input<string>;

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

  persistence?: {
    enabled?: boolean;
    size?: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
  };

  imageRenderer?: {
    enabled?: boolean;
    resources?: {
      requests?: { cpu?: string; memory?: string };
      limits?: { cpu?: string; memory?: string };
    };
    env?: Record<string, string>;
  };
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

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          adminUser: args.adminUsername || "admin",
          adminPassword: args.adminPassword || this.adminPassword.result,

          persistence: {
            enabled: args.persistence?.enabled || false,
            ...(args.persistence?.size && { size: args.persistence.size }),
            ...(args.persistence?.storageClass && { storageClass: args.persistence.storageClass }),
          },

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

          "grafana.ini": {
            analytics: {
              check_for_updates: false,
              reporting_enabled: false,
            },
          },

          testFramework: {
            enabled: false,
          },

          imageRenderer: {
            enabled: args.imageRenderer?.enabled ?? false,
            image: {
              repository: DOCKER_IMAGES.GRAFANA_IMAGE_RENDERER.image.split(":")[0].replace(/^docker\.io\//, ""),
              tag: DOCKER_IMAGES.GRAFANA_IMAGE_RENDERER.image.split(":")[1],
              pullPolicy: "IfNotPresent",
            },
            env: {
              HTTP_HOST: "0.0.0.0",
              XDG_CONFIG_HOME: "/tmp/.chromium",
              XDG_CACHE_HOME: "/tmp/.chromium",
              BROWSER_SANDBOX: "false",
              GOMEMLIMIT: "12GiB",
              ...args.imageRenderer?.env,
            },
            resources: args.imageRenderer?.resources ?? {},
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

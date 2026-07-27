import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { PostgreSQLConfig, createConnectionSafePassword } from "../adapters/postgres";
import { DOCKER_IMAGES } from "../docker-images";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface GrafanaArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;

  adminUsername?: pulumi.Input<string>;
  adminPassword?: pulumi.Input<string>;
  replicas?: pulumi.Input<number>;
  headlessService?: pulumi.Input<boolean>;

  database?: PostgreSQLConfig;

  databaseSecret?: {
    name: pulumi.Input<string>;
    usernameKey?: pulumi.Input<string>;
    passwordKey?: pulumi.Input<string>;
    databaseKey?: pulumi.Input<string>;
  };

  alertingHa?: {
    enabled?: pulumi.Input<boolean>;
    listenAddress?: pulumi.Input<string>;
    advertiseAddress?: pulumi.Input<string>;
    peers?: pulumi.Input<string>;
  };

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
    super("homelab:components:Grafana", name, args, withWorkloadLabels(opts, args.workloadLabels));

    const chartConfig = HELM_CHARTS.GRAFANA;

    this.chartReleaseName = `${name}-chart`;
    this.namespace = args.namespace;

    this.adminPassword = createConnectionSafePassword(`${name}-admin-password`, 32, { parent: this });

    const databaseHost = args.database
      ? pulumi.interpolate`${args.database.host}:${args.database.port || 5432}`
      : undefined;
    const alertingHaEnabled = args.alertingHa?.enabled ?? false;
    const envValueFrom = {
      ...(args.databaseSecret && {
        GF_DATABASE_NAME: {
          secretKeyRef: {
            name: args.databaseSecret.name,
            key: args.databaseSecret.databaseKey || "dbname",
          },
        },
        GF_DATABASE_USER: {
          secretKeyRef: {
            name: args.databaseSecret.name,
            key: args.databaseSecret.usernameKey || "username",
          },
        },
        GF_DATABASE_PASSWORD: {
          secretKeyRef: {
            name: args.databaseSecret.name,
            key: args.databaseSecret.passwordKey || "password",
          },
        },
      }),
    };

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          ...(args.replicas && { replicas: args.replicas }),
          ...(args.headlessService !== undefined && { headlessService: args.headlessService }),

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
            feature_toggles: {
              kubernetesAlertingRules: true,
            },
            ...(args.database && {
              database: {
                type: "postgres",
                host: databaseHost,
                name: args.databaseSecret ? "$__env{GF_DATABASE_NAME}" : args.database.database,
                user: args.databaseSecret ? "$__env{GF_DATABASE_USER}" : args.database.username,
                password: "$__env{GF_DATABASE_PASSWORD}",
                ssl_mode: args.database.sslMode || "require",
              },
            }),
            ...(args.alertingHa && {
              unified_alerting: {
                enabled: alertingHaEnabled,
                ha_listen_address: args.alertingHa.listenAddress || "${POD_IP}:9094",
                ha_advertise_address: args.alertingHa.advertiseAddress || "${POD_IP}:9094",
                ha_peers: args.alertingHa.peers || `${this.chartReleaseName}-headless:9094`,
              },
            }),
          },

          ...(Object.keys(envValueFrom).length > 0 && { envValueFrom }),

          ...(args.database && !args.databaseSecret && {
            envRenderSecret: {
              GF_DATABASE_PASSWORD: args.database.password,
            },
          }),

          testFramework: {
            enabled: false,
          },

          rbac: {
            create: false,
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
      {
        parent: this,
      }
    );

    this.registerOutputs({
      chart: this.chart,
      adminPassword: this.adminPassword,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}.${this.namespace}:80`;
  }

  public getAdminPassword(): pulumi.Output<string> {
    return pulumi.output(this.adminPassword.result);
  }
}

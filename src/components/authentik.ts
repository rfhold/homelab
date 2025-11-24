import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createConnectionSafePassword } from "../adapters/postgres";

export interface AuthentikArgs {
  namespace: pulumi.Input<string>;

  secretKey?: pulumi.Input<string>;

  postgresql: {
    host: pulumi.Input<string>;
    port?: pulumi.Input<number>;
    name?: pulumi.Input<string>;
    user?: pulumi.Input<string>;
    password: pulumi.Input<string>;
  };

  email?: {
    host?: pulumi.Input<string>;
    port?: pulumi.Input<number>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    useTls?: boolean;
    from?: pulumi.Input<string>;
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

  replicas?: number;

  resources?: {
    server?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
    worker?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
  };

  errorReporting?: {
    enabled?: boolean;
  };
}

export class Authentik extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly secretKey: ReturnType<typeof createConnectionSafePassword>;

  private readonly chartReleaseName: string;
  private readonly namespace: pulumi.Input<string>;

  constructor(name: string, args: AuthentikArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Authentik", name, args, opts);

    const chartConfig = HELM_CHARTS.AUTHENTIK;
    this.chartReleaseName = `${name}-chart`;
    this.namespace = args.namespace;

    this.secretKey = createConnectionSafePassword(`${name}-secret-key`, 60, { parent: this });

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          authentik: {
            secret_key: args.secretKey || this.secretKey.result,
            error_reporting: {
              enabled: args.errorReporting?.enabled ?? true,
            },
            postgresql: {
              host: args.postgresql.host,
              port: args.postgresql.port || 5432,
              name: args.postgresql.name || "authentik",
              user: args.postgresql.user || "authentik",
              password: args.postgresql.password,
            },
            ...(args.email && {
              email: {
                host: args.email.host,
                port: args.email.port || 587,
                username: args.email.username,
                password: args.email.password,
                use_tls: args.email.useTls ?? true,
                from: args.email.from,
              },
            }),
          },

          server: {
            replicas: args.replicas || 1,
            ...(args.resources?.server && {
              resources: args.resources.server,
            }),
            ingress: {
              enabled: args.ingress?.enabled || false,
              ingressClassName: args.ingress?.className,
              annotations: args.ingress?.annotations || {},
              hosts: args.ingress?.hostname ? [args.ingress.hostname] : [],
              tls: args.ingress?.tls ? [
                {
                  secretName: args.ingress.tls.secretName,
                  hosts: args.ingress.hostname ? [args.ingress.hostname] : [],
                },
              ] : [],
            },
          },

          worker: {
            replicas: args.replicas || 1,
            ...(args.resources?.worker && {
              resources: args.resources.worker,
            }),
          },

          postgresql: {
            enabled: false,
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
      secretKey: this.secretKey,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}-authentik-server.${this.namespace}:80`;
  }

  public getSecretKey(): pulumi.Output<string> {
    return pulumi.output(this.secretKey.result);
  }
}

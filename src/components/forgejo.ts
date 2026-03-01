import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createConnectionSafePassword } from "../adapters/postgres";
import { PostgreSQLConfig } from "../adapters/postgres";
import { RedisConfig, createRedisConnectionString } from "../adapters/redis";
import { StorageConfig } from "../adapters/storage";

export interface ForgejoArgs {
  namespace: pulumi.Input<string>;

  adminUsername?: pulumi.Input<string>;
  adminPassword?: pulumi.Input<string>;
  adminEmail?: pulumi.Input<string>;

  domain: pulumi.Input<string>;
  rootUrl: pulumi.Input<string>;

  postgresql: PostgreSQLConfig;
  redis: RedisConfig;

  storage?: StorageConfig;

  ingress?: {
    enabled?: boolean;
    className?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
    tls?: {
      secretName?: pulumi.Input<string>;
    };
  };

  ssh?: {
    enabled?: boolean;
    serviceType?: pulumi.Input<string>;
    loadBalancerIP?: pulumi.Input<string>;
    port?: pulumi.Input<number>;
    nodePort?: pulumi.Input<number>;
    annotations?: Record<string, pulumi.Input<string>>;
  };

  webhook?: {
    allowedHostList?: pulumi.Input<string>;
  };

  migrations?: {
    allowedDomains?: pulumi.Input<string>;
  };

  memoryLimit?: pulumi.Input<string>;
  cpuLimit?: pulumi.Input<string>;
  memoryRequest?: pulumi.Input<string>;
  cpuRequest?: pulumi.Input<string>;
}

export class Forgejo extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly adminPassword: ReturnType<typeof createConnectionSafePassword>;

  private readonly chartReleaseName: string;
  private readonly namespace: pulumi.Input<string>;

  constructor(name: string, args: ForgejoArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Forgejo", name, args, opts);

    this.chartReleaseName = `${name}-chart`;
    this.namespace = args.namespace;

    this.adminPassword = createConnectionSafePassword(`${name}-admin-password`, 32, { parent: this });

    const storageSize = args.storage?.size || "200Gi";

    const cacheHost = createRedisConnectionString({ ...args.redis, database: 0 });
    const sessionHost = createRedisConnectionString({ ...args.redis, database: 1 });

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(HELM_CHARTS.FORGEJO, args.namespace),
        values: {
          persistence: {
            enabled: true,
            size: storageSize,
          },

          gitea: {
            admin: {
              username: args.adminUsername || "admin",
              password: args.adminPassword || this.adminPassword.result,
              email: args.adminEmail || "admin@homelab.local",
              passwordMode: "keepUpdated",
            },
            config: {
              server: {
                DOMAIN: args.domain,
                ROOT_URL: args.rootUrl,
                SSH_DOMAIN: args.domain,
                SSH_PORT: 22,
                SSH_LISTEN_PORT: 2222,
              },
              database: {
                DB_TYPE: "postgres",
                HOST: pulumi.interpolate`${args.postgresql.host}:5432`,
                NAME: args.postgresql.database,
                USER: args.postgresql.username,
                PASSWD: args.postgresql.password,
                SSL_MODE: args.postgresql.sslMode ?? "disable",
              },
              cache: {
                ADAPTER: "valkey",
                HOST: cacheHost,
              },
              session: {
                PROVIDER: "valkey",
                PROVIDER_CONFIG: sessionHost,
              },
              ...(args.webhook?.allowedHostList && {
                webhook: {
                  ALLOWED_HOST_LIST: args.webhook.allowedHostList,
                },
              }),
              ...(args.migrations?.allowedDomains && {
                migrations: {
                  ALLOWED_DOMAINS: args.migrations.allowedDomains,
                },
              }),
            },
          },

          postgresql: {
            enabled: false,
          },
          "postgresql-ha": {
            enabled: false,
          },
          valkey: {
            enabled: false,
          },
          "valkey-cluster": {
            enabled: false,
          },

          service: {
            ssh: {
              type: args.ssh?.enabled
                ? (args.ssh?.serviceType || "LoadBalancer")
                : "ClusterIP",
              port: args.ssh?.port || 22,
              annotations: {
                ...(args.ssh?.loadBalancerIP && {
                  "metallb.io/loadBalancerIPs": args.ssh.loadBalancerIP,
                }),
                ...(args.ssh?.annotations || {}),
              },
              ...(args.ssh?.nodePort && { nodePort: args.ssh.nodePort }),
            },
          },

          ingress: {
            enabled: args.ingress?.enabled || false,
            className: args.ingress?.className,
            annotations: args.ingress?.annotations || {},
            hosts: [
              {
                host: args.domain,
                paths: [
                  {
                    path: "/",
                    pathType: "Prefix",
                  },
                ],
              },
            ],
            tls: args.ingress?.tls ? [
              {
                secretName: args.ingress.tls.secretName,
                hosts: [args.domain],
              },
            ] : [],
          },

          resources: {
            limits: {
              memory: args.memoryLimit,
              cpu: args.cpuLimit,
            },
            requests: {
              memory: args.memoryRequest || "512Mi",
              cpu: args.cpuRequest || "250m",
            },
          },

          image: {
            rootless: true,
          },

          podSecurityContext: {
            fsGroup: 1000,
          },

          containerSecurityContext: {
            runAsNonRoot: true,
            runAsUser: 1000,
            runAsGroup: 1000,
            readOnlyRootFilesystem: false,
            allowPrivilegeEscalation: false,
            capabilities: {
              drop: ["ALL"],
            },
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
    return pulumi.interpolate`http://${this.chartReleaseName}-forgejo-http.${this.namespace}:3000`;
  }
}

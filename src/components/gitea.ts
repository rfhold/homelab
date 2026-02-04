import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createConnectionSafePassword } from "../adapters/postgres";
import { StorageConfig, createPVCSpec } from "../adapters/storage";

export interface GiteaArgs {
  namespace: pulumi.Input<string>;

  adminUsername?: pulumi.Input<string>;
  adminPassword?: pulumi.Input<string>;
  adminEmail?: pulumi.Input<string>;

  domain: pulumi.Input<string>;
  rootUrl: pulumi.Input<string>;

  storage?: StorageConfig;

  postgresql?: {
    enabled?: boolean;
    database?: pulumi.Input<string>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    storage?: StorageConfig;
  };

  valkey?: {
    enabled?: boolean;
    password?: pulumi.Input<string>;
    storage?: StorageConfig;
  };

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

  memoryLimit?: pulumi.Input<string>;
  cpuLimit?: pulumi.Input<string>;
  memoryRequest?: pulumi.Input<string>;
  cpuRequest?: pulumi.Input<string>;
}

export class Gitea extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly adminPassword: ReturnType<typeof createConnectionSafePassword>;
  public readonly postgresPassword: ReturnType<typeof createConnectionSafePassword>;
  public readonly valkeyPassword: ReturnType<typeof createConnectionSafePassword>;

  private readonly chartReleaseName: string;
  private readonly namespace: pulumi.Input<string>;

  constructor(name: string, args: GiteaArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Gitea", name, args, opts);

    const chartConfig = HELM_CHARTS.GITEA;

    this.chartReleaseName = `${name}-chart`;
    this.namespace = args.namespace;

    this.adminPassword = createConnectionSafePassword(`${name}-admin-password`, 32, { parent: this });
    this.postgresPassword = createConnectionSafePassword(`${name}-postgres-password`, 32, { parent: this });
    this.valkeyPassword = createConnectionSafePassword(`${name}-valkey-password`, 32, { parent: this });

    const giteaStorageConfig: StorageConfig = {
      size: args.storage?.size || "200Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    const postgresStorageConfig: StorageConfig = {
      size: args.postgresql?.storage?.size || "20Gi",
      storageClass: args.postgresql?.storage?.storageClass || args.storage?.storageClass,
      accessModes: args.postgresql?.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.postgresql?.storage?.volumeMode,
      namespace: args.postgresql?.storage?.namespace,
      labels: args.postgresql?.storage?.labels,
      annotations: args.postgresql?.storage?.annotations,
      selector: args.postgresql?.storage?.selector,
      dataSource: args.postgresql?.storage?.dataSource,
    };

    const valkeyStorageConfig: StorageConfig = {
      size: args.valkey?.storage?.size || "5Gi",
      storageClass: args.valkey?.storage?.storageClass || args.storage?.storageClass,
      accessModes: args.valkey?.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.valkey?.storage?.volumeMode,
      namespace: args.valkey?.storage?.namespace,
      labels: args.valkey?.storage?.labels,
      annotations: args.valkey?.storage?.annotations,
      selector: args.valkey?.storage?.selector,
      dataSource: args.valkey?.storage?.dataSource,
    };

    const postgresPvcSpec = createPVCSpec(postgresStorageConfig);
    const valkeyPvcSpec = createPVCSpec(valkeyStorageConfig);



    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          persistence: {
            enabled: true,
            size: giteaStorageConfig.size,
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
                HOST: pulumi.interpolate`${this.chartReleaseName}-postgresql:5432`,
                NAME: args.postgresql?.database || "gitea",
                USER: args.postgresql?.username || "gitea",
                PASSWD: args.postgresql?.password || this.postgresPassword.result,
              },
              cache: {
                ADAPTER: "redis",
                HOST: pulumi.interpolate`redis://${this.chartReleaseName}-valkey-master:6379/0`,
              },
              session: {
                PROVIDER: "redis",
                PROVIDER_CONFIG: pulumi.interpolate`redis://${this.chartReleaseName}-valkey-master:6379/1`,
              },
              ...(args.webhook?.allowedHostList && {
                webhook: {
                  ALLOWED_HOST_LIST: args.webhook.allowedHostList,
                },
              }),
            },
          },


          "postgresql-ha": {
            enabled: false,
          },

          postgresql: {
            enabled: args.postgresql?.enabled !== false,
            auth: {
              database: args.postgresql?.database || "gitea",
              username: args.postgresql?.username || "gitea",
              password: args.postgresql?.password || this.postgresPassword.result,
            },
            primary: {
              persistence: {
                enabled: true,
                ...postgresPvcSpec,
              },
            },
          },

          "valkey-cluster": {
            enabled: false,
          },

          valkey: {
            enabled: args.valkey?.enabled !== false,
            architecture: "standalone",
            auth: {
              enabled: false,
            },
            master: {
              persistence: {
                enabled: true,
                ...valkeyPvcSpec,
              },
            },
          },

          service: {
            ssh: {
              type: args.ssh?.serviceType || (args.ssh?.enabled !== false ? "LoadBalancer" : "ClusterIP"),
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
      postgresPassword: this.postgresPassword,
      valkeyPassword: this.valkeyPassword,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}-gitea-http.${this.namespace}:3000`;
  }
}

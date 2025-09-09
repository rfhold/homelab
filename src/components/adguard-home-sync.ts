import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";


export interface AdguardHomeSyncOriginConfig {
  url: pulumi.Input<string>;
  username: pulumi.Input<string>;
  password: pulumi.Input<string>;
}

export interface AdguardHomeSyncFeaturesConfig {
  generalSettings: pulumi.Input<boolean>;
  filters: pulumi.Input<boolean>;
  dhcp: pulumi.Input<boolean>;
  clients: pulumi.Input<boolean>;
  queryLogConfig: pulumi.Input<boolean>;
  statsConfig: pulumi.Input<boolean>;
  accessLists: pulumi.Input<boolean>;
  rewrites: pulumi.Input<boolean>;
}

export interface AdguardHomeSyncResourceConfig {
  requests: {
    memory: pulumi.Input<string>;
    cpu: pulumi.Input<string>;
  };
  limits: {
    memory: pulumi.Input<string>;
    cpu: pulumi.Input<string>;
  };
}

export interface AdguardHomeSyncArgs {
  namespace: pulumi.Input<string>;
  enabled: pulumi.Input<boolean>;
  mode: pulumi.Input<"origin" | "target">;
  origin?: AdguardHomeSyncOriginConfig;
  syncInterval: pulumi.Input<string>;
  syncFeatures: AdguardHomeSyncFeaturesConfig;
  resources: AdguardHomeSyncResourceConfig;
  localAdguardUrl?: pulumi.Input<string>;
  localAdguardUsername?: pulumi.Input<string>;
  localAdguardPassword?: pulumi.Input<string>;
}

export class AdguardHomeSync extends pulumi.ComponentResource {
  public readonly deployment?: k8s.apps.v1.Deployment;
  public readonly secret?: k8s.core.v1.Secret;

  constructor(name: string, args: AdguardHomeSyncArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:AdguardHomeSync", name, {}, opts);

    if (!args.enabled) {
      this.registerOutputs({});
      return;
    }

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-secret`,
        namespace: args.namespace,
      },
      stringData: {
        originPassword: args.origin?.password || "",
        localPassword: args.localAdguardPassword || "",
      },
    }, { parent: this });



    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
            },
          },
          spec: {
            containers: [{
              name: "adguard-home-sync",
              image: DOCKER_IMAGES.ADGUARD_HOME_SYNC.image,
              args: ["run"],
              env: pulumi.all([
                args.mode,
                args.origin?.url,
                args.origin?.username,
                args.localAdguardUrl,
                args.localAdguardUsername,
                args.syncInterval,
                args.syncFeatures.generalSettings,
                args.syncFeatures.filters,
                args.syncFeatures.dhcp,
                args.syncFeatures.clients,
                args.syncFeatures.queryLogConfig,
                args.syncFeatures.statsConfig,
                args.syncFeatures.accessLists,
                args.syncFeatures.rewrites
              ]).apply(([
                mode,
                originUrl,
                originUsername,
                localUrl,
                localUsername,
                syncInterval,
                generalSettings,
                filters,
                dhcp,
                clients,
                queryLogConfig,
                statsConfig,
                accessLists,
                rewrites
              ]) => {
                const envVars: Array<k8s.types.input.core.v1.EnvVar> = [
                  {
                    name: "LOG_LEVEL",
                    value: "info",
                  },
                  {
                    name: "RUN_ON_START",
                    value: "true",
                  },
                  {
                    name: "CONTINUE_ON_ERROR",
                    value: "false",
                  },
                  {
                    name: "FEATURES_GENERAL_SETTINGS",
                    value: (generalSettings || false).toString(),
                  },
                  {
                    name: "FEATURES_FILTERS",
                    value: (filters || false).toString(),
                  },
                  {
                    name: "FEATURES_DHCP_SERVER_CONFIG",
                    value: (dhcp || false).toString(),
                  },
                  {
                    name: "FEATURES_DHCP_STATIC_LEASES",
                    value: (dhcp || false).toString(),
                  },
                  {
                    name: "FEATURES_CLIENT_SETTINGS",
                    value: (clients || false).toString(),
                  },
                  {
                    name: "FEATURES_QUERY_LOG_CONFIG",
                    value: (queryLogConfig || false).toString(),
                  },
                  {
                    name: "FEATURES_STATS_CONFIG",
                    value: (statsConfig || false).toString(),
                  },
                  {
                    name: "FEATURES_DNS_ACCESS_LISTS",
                    value: (accessLists || false).toString(),
                  },
                  {
                    name: "FEATURES_DNS_REWRITES",
                    value: (rewrites || false).toString(),
                  },
                  {
                    name: "FEATURES_DNS_SERVER_CONFIG",
                    value: (generalSettings || false).toString(),
                  },
                  {
                    name: "FEATURES_SERVICES",
                    value: "true",
                  },
                  {
                    name: "FEATURES_THEME",
                    value: "true",
                  },
                ];

                if (syncInterval) {
                  envVars.push({
                    name: "CRON",
                    value: syncInterval.toString(),
                  });
                }

                if (mode === "target" && originUrl && originUsername) {
                  envVars.push(
                    {
                      name: "ORIGIN_URL",
                      value: originUrl.toString(),
                    },
                    {
                      name: "ORIGIN_USERNAME",
                      value: originUsername.toString(),
                    },
                    {
                      name: "ORIGIN_PASSWORD",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.secret!.metadata.name,
                          key: "originPassword",
                        },
                      },
                    },
                    {
                      name: "REPLICA1_URL",
                      value: (localUrl || "http://localhost:3000").toString(),
                    },
                    {
                      name: "REPLICA1_USERNAME",
                      value: (localUsername || "admin").toString(),
                    },
                    {
                      name: "REPLICA1_PASSWORD",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.secret!.metadata.name,
                          key: "localPassword",
                        },
                      },
                    }
                  );
                } else if (mode === "origin") {
                  envVars.push(
                    {
                      name: "ORIGIN_URL",
                      value: (localUrl || "http://localhost:3000").toString(),
                    },
                    {
                      name: "ORIGIN_USERNAME",
                      value: (localUsername || "admin").toString(),
                    },
                    {
                      name: "ORIGIN_PASSWORD",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.secret!.metadata.name,
                          key: "localPassword",
                        },
                      },
                    },
                    {
                      name: "REPLICA1_URL",
                      value: (originUrl || "").toString(),
                    },
                    {
                      name: "REPLICA1_USERNAME",
                      value: (originUsername || "").toString(),
                    },
                    {
                      name: "REPLICA1_PASSWORD",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.secret!.metadata.name,
                          key: "originPassword",
                        },
                      },
                    }
                  );
                }

                return envVars;
              }),

              resources: args.resources,

            }],

            restartPolicy: "Always",
          },
        },
      },
    }, { parent: this });

    this.registerOutputs({
      deployment: this.deployment,
      secret: this.secret,
    });
  }
}

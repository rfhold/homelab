import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface AdguardHomeSyncOriginConfig {
  url: pulumi.Input<string>;
  username: pulumi.Input<string>;
  passwordSecret: pulumi.Input<string>;
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
  public readonly configMap?: k8s.core.v1.ConfigMap;
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
        originPassword: args.origin?.passwordSecret || "",
        localPassword: args.localAdguardPassword || "",
      },
    }, { parent: this });

    const syncConfig = pulumi.all([
      args.mode,
      args.origin?.url,
      args.origin?.username,
      args.syncInterval,
      args.syncFeatures,
      args.localAdguardUrl,
      args.localAdguardUsername,
    ]).apply(([mode, originUrl, originUsername, syncInterval, syncFeatures, localUrl, localUsername]) => {
      const config: any = {
        interval: syncInterval,
        runOnStart: true,
        continueOnError: false,
        features: {
          generalSettings: syncFeatures.generalSettings,
          queryLogConfig: syncFeatures.queryLogConfig,
          statsConfig: syncFeatures.statsConfig,
          clientSettings: syncFeatures.clients,
          services: syncFeatures.filters,
          filters: syncFeatures.filters,
          dhcp: {
            serverConfig: syncFeatures.dhcp,
            staticLeases: syncFeatures.dhcp,
          },
          dns: {
            serverConfig: syncFeatures.generalSettings,
            accessLists: syncFeatures.accessLists,
            rewrites: syncFeatures.rewrites,
          },
        },
      };

      if (mode === "target" && originUrl && originUsername) {
        config.origin = {
          url: originUrl,
          username: originUsername,
          password: "${ORIGIN_PASSWORD}",
          insecureSkipVerify: false,
        };
        config.replica = {
          url: localUrl || "http://localhost:3000",
          username: localUsername || "admin",
          password: "${LOCAL_PASSWORD}",
          insecureSkipVerify: false,
        };
      } else if (mode === "origin") {
        config.origin = {
          url: localUrl || "http://localhost:3000",
          username: localUsername || "admin",
          password: "${LOCAL_PASSWORD}",
          insecureSkipVerify: false,
        };
      }

      return JSON.stringify(config, null, 2);
    });

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
      },
      data: {
        "adguardhome-sync.yaml": syncConfig,
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
              args: ["--config", "/config/adguardhome-sync.yaml"],
              env: [
                {
                  name: "ORIGIN_PASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: this.secret.metadata.name,
                      key: "originPassword",
                    },
                  },
                },
                {
                  name: "LOCAL_PASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: this.secret.metadata.name,
                      key: "localPassword",
                    },
                  },
                },
              ],
              volumeMounts: [
                {
                  name: "config",
                  mountPath: "/config",
                  readOnly: true,
                },
              ],
              resources: args.resources,
              livenessProbe: {
                exec: {
                  command: ["pgrep", "adguardhome-sync"],
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
              readinessProbe: {
                exec: {
                  command: ["pgrep", "adguardhome-sync"],
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            }],
            volumes: [
              {
                name: "config",
                configMap: {
                  name: this.configMap.metadata.name,
                },
              },
            ],
            restartPolicy: "Always",
          },
        },
      },
    }, { parent: this });

    this.registerOutputs({
      deployment: this.deployment,
      configMap: this.configMap,
      secret: this.secret,
    });
  }
}
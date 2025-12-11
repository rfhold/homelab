import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import { DOCKER_IMAGES } from "../docker-images";

export interface AdguardHomeServiceConfig {
  type: pulumi.Input<string>;
  annotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  ports: {
    dns: pulumi.Input<number>;
    dnsUdp: pulumi.Input<number>;
    webUi: pulumi.Input<number>;
  };
}

export interface AdguardHomeStorageConfig {
  work: {
    size: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
  };
  config: {
    size: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
  };
}

export interface AdguardHomeResourceConfig {
  requests: {
    memory: pulumi.Input<string>;
    cpu: pulumi.Input<string>;
  };
  limits: {
    memory: pulumi.Input<string>;
    cpu: pulumi.Input<string>;
  };
}

export interface AdguardHomeArgs {
  namespace: pulumi.Input<string>;
  adminUsername: pulumi.Input<string>;
  service: AdguardHomeServiceConfig;
  storage: AdguardHomeStorageConfig;
  resources: AdguardHomeResourceConfig;
  resetSessionsAndStatsDb?: pulumi.Input<boolean>;
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

export interface AdguardHomeConnectionConfig {
  dnsHost: pulumi.Output<string>;
  dnsPort: pulumi.Output<number>;
  webUiUrl: pulumi.Output<string>;
  adminUsername: pulumi.Output<string>;
  adminPassword: pulumi.Output<string>;
}

export class AdguardHome extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;
  public readonly workPvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly configPvc: k8s.core.v1.PersistentVolumeClaim;

  constructor(name: string, args: AdguardHomeArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:AdguardHome", name, {}, opts);

    const adminPassword = new random.RandomPassword(`${name}-password`, {
      length: 32,
      special: true,
      overrideSpecial: "!@#$%^&*()-_=+[]{}|;:,.<>?",
    }, { parent: this }).result;

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-secret`,
        namespace: args.namespace,
      },
      stringData: {
        adminUsername: args.adminUsername,
        adminPassword: adminPassword,
      },
    }, { parent: this });

    this.workPvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-work-pvc`, {
      metadata: {
        name: `${name}-work-data`,
        namespace: args.namespace,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {
          requests: {
            storage: args.storage.work.size,
          },
        },
        storageClassName: args.storage.work.storageClass,
      },
    }, { parent: this });

    this.configPvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-config-pvc`, {
      metadata: {
        name: `${name}-config-data`,
        namespace: args.namespace,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {
          requests: {
            storage: args.storage.config.size,
          },
        },
        storageClassName: args.storage.config.storageClass,
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
            nodeSelector: args.nodeSelector,
            initContainers: args.resetSessionsAndStatsDb ? [{
              name: "reset-sessions",
              image: "busybox:1.36",
              command: ["sh", "-c", "rm -f /opt/adguardhome/work/data/sessions.db && rm -f /opt/adguardhome/work/data/stats.db"],
              volumeMounts: [{
                name: "work-data",
                mountPath: "/opt/adguardhome/work",
              }],
            }] : undefined,
            containers: [{
              name: "adguard-home",
              image: DOCKER_IMAGES.ADGUARD_HOME.image,
              ports: [
                { containerPort: 53, name: "dns-tcp", protocol: "TCP" },
                { containerPort: 53, name: "dns-udp", protocol: "UDP" },
                { containerPort: 3000, name: "web-ui", protocol: "TCP" },
              ],
              volumeMounts: [
                {
                  name: "work-data",
                  mountPath: "/opt/adguardhome/work",
                },
                {
                  name: "config-data",
                  mountPath: "/opt/adguardhome/conf",
                },
              ],
              resources: args.resources,
              livenessProbe: {
                httpGet: {
                  path: "/",
                  port: 3000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 3000,
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
              },
            }],
            volumes: [
              {
                name: "work-data",
                persistentVolumeClaim: {
                  claimName: this.workPvc.metadata.name,
                },
              },
              {
                name: "config-data",
                persistentVolumeClaim: {
                  claimName: this.configPvc.metadata.name,
                },
              },
            ],
          },
        },
      },
    }, { parent: this });

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        annotations: args.service.annotations,
      },
      spec: {
        type: args.service.type,
        selector: {
          app: name,
        },
        ports: [
          {
            name: "dns-tcp",
            port: args.service.ports.dns,
            targetPort: 53,
            protocol: "TCP",
          },
          {
            name: "dns-udp",
            port: args.service.ports.dnsUdp,
            targetPort: 53,
            protocol: "UDP",
          },
          {
            name: "web-ui",
            port: args.service.ports.webUi,
            targetPort: 3000,
            protocol: "TCP",
          },
        ],
      },
    }, { parent: this });

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      secret: this.secret,
      workPvc: this.workPvc,
      configPvc: this.configPvc,
    });
  }

  getConnectionConfig(): AdguardHomeConnectionConfig {
    const serviceHost = pulumi.all([this.service.status, this.service.spec.clusterIP]).apply(([status, clusterIP]) => {
      if (status?.loadBalancer?.ingress?.[0]?.ip) {
        return status.loadBalancer.ingress[0].ip;
      }
      return clusterIP || "";
    });

    return {
      dnsHost: serviceHost,
      dnsPort: this.service.spec.ports[0].port,
      webUiUrl: pulumi.interpolate`http://${serviceHost}:${this.service.spec.ports[2].port}`,
      adminUsername: this.secret.data.adminUsername.apply(u => Buffer.from(u, "base64").toString()),
      adminPassword: this.secret.data.adminPassword.apply(p => Buffer.from(p, "base64").toString()),
    };
  }
}

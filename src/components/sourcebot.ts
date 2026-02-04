import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface SourcebotExclude {
  forks?: boolean;
  archived?: boolean;
  repos?: string[];
}

export interface SourcebotRevisions {
  branches?: string[];
  tags?: string[];
}

export interface SourcebotGiteaConnection {
  type: "gitea";
  url: string;
  token?: pulumi.Input<string>;
  orgs?: string[];
  users?: string[];
  repos?: string[];
  exclude?: SourcebotExclude;
  revisions?: SourcebotRevisions;
}

export interface SourcebotGitHubConnection {
  type: "github";
  url?: string;
  token?: pulumi.Input<string>;
  orgs?: string[];
  users?: string[];
  repos?: string[];
  topics?: string[];
  exclude?: SourcebotExclude & { topics?: string[] };
  revisions?: SourcebotRevisions;
}

export interface SourcebotGitLabConnection {
  type: "gitlab";
  url?: string;
  token?: pulumi.Input<string>;
  all?: boolean;
  groups?: string[];
  users?: string[];
  projects?: string[];
  topics?: string[];
  exclude?: SourcebotExclude & { topics?: string[]; projects?: string[] };
  revisions?: SourcebotRevisions;
}

export type SourcebotConnection =
  | SourcebotGiteaConnection
  | SourcebotGitHubConnection
  | SourcebotGitLabConnection;

export interface SourcebotSettings {
  reindexIntervalMs?: number;
  resyncConnectionIntervalMs?: number;
  maxFileSize?: number;
  maxTrigramCount?: number;
  maxConnectionSyncJobConcurrency?: number;
  maxRepoIndexingJobConcurrency?: number;
  repoIndexTimeoutMs?: number;
}

export interface SourcebotArgs {
  namespace: pulumi.Input<string>;
  name?: string;

  database?: {
    url: pulumi.Input<string>;
  };

  redis?: {
    url: pulumi.Input<string>;
  };

  auth?: {
    secret?: pulumi.Input<string>;
    url?: pulumi.Input<string>;
    encryptionKey?: pulumi.Input<string>;
  };

  connections?: { [name: string]: SourcebotConnection };

  settings?: SourcebotSettings;

  storage?: {
    size?: string;
    storageClass?: string;
  };

  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };

  ingress?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };

  telemetryDisabled?: boolean;
}

export class SourcebotComponent extends pulumi.ComponentResource {
  public readonly statefulSet: k8s.apps.v1.StatefulSet;
  public readonly service: k8s.core.v1.Service;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly secret: k8s.core.v1.Secret;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly ingress?: k8s.networking.v1.Ingress;
  public readonly url: pulumi.Output<string>;

  constructor(
    name: string,
    args: SourcebotArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:components:Sourcebot", name, {}, opts);

    const componentName = args.name || name;
    const labels = { app: "sourcebot", component: componentName };
    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const secretData: { [key: string]: pulumi.Input<string> } = {};
    const tokenEnvVars: { connName: string; envVar: string }[] = [];

    if (args.database?.url) {
      secretData["DATABASE_URL"] = args.database.url;
    }
    if (args.redis?.url) {
      secretData["REDIS_URL"] = args.redis.url;
    }
    if (args.auth?.secret) {
      secretData["AUTH_SECRET"] = args.auth.secret;
    }
    if (args.auth?.encryptionKey) {
      secretData["SOURCEBOT_ENCRYPTION_KEY"] = args.auth.encryptionKey;
    }

    if (args.connections) {
      Object.entries(args.connections).forEach(([connName, conn]) => {
        if (conn.token) {
          const envVar = `${connName.toUpperCase().replace(/-/g, "_")}_TOKEN`;
          secretData[envVar] = conn.token;
          tokenEnvVars.push({ connName, envVar });
        }
      });
    }

    this.secret = new k8s.core.v1.Secret(
      `${name}-secret`,
      {
        metadata: {
          name: componentName,
          namespace: args.namespace,
          labels,
        },
        stringData: secretData,
      },
      defaultResourceOptions
    );

    const configJson = this.buildConfigJson(args, tokenEnvVars);

    this.configMap = new k8s.core.v1.ConfigMap(
      `${name}-config`,
      {
        metadata: {
          name: `${componentName}-config`,
          namespace: args.namespace,
          labels,
        },
        data: {
          "config.json": configJson,
        },
      },
      defaultResourceOptions
    );

    this.pvc = new k8s.core.v1.PersistentVolumeClaim(
      `${name}-data`,
      {
        metadata: {
          name: `${componentName}-data`,
          namespace: args.namespace,
          labels,
        },
        spec: {
          accessModes: ["ReadWriteOnce"],
          storageClassName: args.storage?.storageClass,
          resources: {
            requests: {
              storage: args.storage?.size || "50Gi",
            },
          },
        },
      },
      defaultResourceOptions
    );

    const env: k8s.types.input.core.v1.EnvVar[] = [
      {
        name: "CONFIG_PATH",
        value: "/data/config.json",
      },
      {
        name: "DATA_DIR",
        value: "/data",
      },
    ];

    if (args.database?.url) {
      env.push({
        name: "DATABASE_URL",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "DATABASE_URL",
          },
        },
      });
    }

    if (args.redis?.url) {
      env.push({
        name: "REDIS_URL",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "REDIS_URL",
          },
        },
      });
    }

    if (args.auth?.secret) {
      env.push({
        name: "AUTH_SECRET",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "AUTH_SECRET",
          },
        },
      });
    }

    if (args.auth?.url) {
      env.push({
        name: "AUTH_URL",
        value: args.auth.url as string,
      });
    }

    if (args.auth?.encryptionKey) {
      env.push({
        name: "SOURCEBOT_ENCRYPTION_KEY",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "SOURCEBOT_ENCRYPTION_KEY",
          },
        },
      });
    }

    tokenEnvVars.forEach(({ envVar }) => {
      env.push({
        name: envVar,
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: envVar,
          },
        },
      });
    });

    if (args.telemetryDisabled) {
      env.push({
        name: "SOURCEBOT_TELEMETRY_DISABLED",
        value: "true",
      });
    }

    this.statefulSet = new k8s.apps.v1.StatefulSet(
      name,
      {
        metadata: {
          name: componentName,
          namespace: args.namespace,
          labels,
        },
        spec: {
          serviceName: componentName,
          replicas: 1,
          selector: {
            matchLabels: labels,
          },
          template: {
            metadata: {
              labels,
            },
            spec: {
              securityContext: {
                fsGroup: 1000,
              },
              containers: [
                {
                  name: "sourcebot",
                  image: DOCKER_IMAGES.SOURCEBOT.image,
                  ports: [
                    {
                      containerPort: 3000,
                      name: "http",
                    },
                  ],
                  env,
                  volumeMounts: [
                    {
                      name: "data",
                      mountPath: "/data",
                    },
                    {
                      name: "config",
                      mountPath: "/data/config.json",
                      subPath: "config.json",
                    },
                  ],
                  resources: {
                    requests: {
                      memory: args.resources?.requests?.memory || "1Gi",
                      cpu: args.resources?.requests?.cpu || "500m",
                    },
                    limits: {
                      memory: args.resources?.limits?.memory || "4Gi",
                      cpu: args.resources?.limits?.cpu || "2000m",
                    },
                  },
                  livenessProbe: {
                    httpGet: {
                      path: "/api/health",
                      port: 3000,
                    },
                    initialDelaySeconds: 60,
                    periodSeconds: 30,
                  },
                  readinessProbe: {
                    httpGet: {
                      path: "/api/health",
                      port: 3000,
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 10,
                  },
                },
              ],
              volumes: [
                {
                  name: "data",
                  persistentVolumeClaim: {
                    claimName: this.pvc.metadata.name,
                  },
                },
                {
                  name: "config",
                  configMap: {
                    name: this.configMap.metadata.name,
                  },
                },
              ],
            },
          },
        },
      },
      defaultResourceOptions
    );

    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name: componentName,
          namespace: args.namespace,
          labels,
        },
        spec: {
          type: "ClusterIP",
          selector: labels,
          ports: [
            {
              port: 3000,
              targetPort: 3000,
              protocol: "TCP",
              name: "http",
            },
          ],
        },
      },
      defaultResourceOptions
    );

    if (args.ingress?.enabled) {
      const ingressRules = [
        {
          host: args.ingress.host,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix" as const,
                backend: {
                  service: {
                    name: this.service.metadata.name,
                    port: {
                      number: 3000,
                    },
                  },
                },
              },
            ],
          },
        },
      ];

      const ingressTls = args.ingress.tls?.enabled
        ? [
            {
              hosts: [args.ingress.host],
              secretName: args.ingress.tls.secretName,
            },
          ]
        : undefined;

      this.ingress = new k8s.networking.v1.Ingress(
        `${name}-ingress`,
        {
          metadata: {
            name: componentName,
            namespace: args.namespace,
            labels,
            annotations: args.ingress.annotations,
          },
          spec: {
            ingressClassName: args.ingress.className,
            rules: ingressRules,
            tls: ingressTls,
          },
        },
        defaultResourceOptions
      );
    }

    this.url = pulumi.interpolate`http://${this.service.metadata.name}:3000`;

    this.registerOutputs({
      statefulSet: this.statefulSet,
      service: this.service,
      pvc: this.pvc,
      secret: this.secret,
      configMap: this.configMap,
      ingress: this.ingress,
      url: this.url,
    });
  }

  private buildConfigJson(
    args: SourcebotArgs,
    tokenEnvVars: { connName: string; envVar: string }[]
  ): string {
    const tokenMap = new Map(tokenEnvVars.map((t) => [t.connName, t.envVar]));

    const config: {
      $schema: string;
      settings?: SourcebotSettings;
      connections?: { [name: string]: object };
    } = {
      $schema:
        "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json",
    };

    if (args.settings) {
      config.settings = args.settings;
    }

    if (args.connections) {
      config.connections = {};

      Object.entries(args.connections).forEach(([connName, conn]) => {
        const connConfig: { [key: string]: unknown } = {
          type: conn.type,
        };

        if (tokenMap.has(connName)) {
          connConfig.token = { env: tokenMap.get(connName) };
        }

        if (conn.type === "gitea") {
          if (conn.url) connConfig.url = conn.url;
          if (conn.orgs) connConfig.orgs = conn.orgs;
          if (conn.users) connConfig.users = conn.users;
          if (conn.repos) connConfig.repos = conn.repos;
          if (conn.exclude) connConfig.exclude = conn.exclude;
          if (conn.revisions) connConfig.revisions = conn.revisions;
        } else if (conn.type === "github") {
          if (conn.url) connConfig.url = conn.url;
          if (conn.orgs) connConfig.orgs = conn.orgs;
          if (conn.users) connConfig.users = conn.users;
          if (conn.repos) connConfig.repos = conn.repos;
          if (conn.topics) connConfig.topics = conn.topics;
          if (conn.exclude) connConfig.exclude = conn.exclude;
          if (conn.revisions) connConfig.revisions = conn.revisions;
        } else if (conn.type === "gitlab") {
          if (conn.url) connConfig.url = conn.url;
          if (conn.all) connConfig.all = conn.all;
          if (conn.groups) connConfig.groups = conn.groups;
          if (conn.users) connConfig.users = conn.users;
          if (conn.projects) connConfig.projects = conn.projects;
          if (conn.topics) connConfig.topics = conn.topics;
          if (conn.exclude) connConfig.exclude = conn.exclude;
          if (conn.revisions) connConfig.revisions = conn.revisions;
        }

        config.connections![connName] = connConfig;
      });
    }

    return JSON.stringify(config, null, 2);
  }
}

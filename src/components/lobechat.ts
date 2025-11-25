import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface LobeChatOIDCProvider {
  provider: pulumi.Input<string>;
  env: pulumi.Input<Record<string, pulumi.Input<string>>>;
  secrets: pulumi.Input<Record<string, pulumi.Input<string>>>;
}

export interface LobeChatSearchConfig {
  providers: pulumi.Input<string[]>;
  searxng?: {
    url: pulumi.Input<string>;
  };
  crawlerImpls?: pulumi.Input<string[]>;
}

export interface LobeChatArgs {
  namespace: pulumi.Input<string>;

  domain: pulumi.Input<string>;

  database: {
    url: pulumi.Input<string>;
    keyVaultsSecret: pulumi.Input<string>;
  };

  s3: {
    endpoint: pulumi.Input<string>;
    bucket: pulumi.Input<string>;
    accessKeyId: pulumi.Input<string>;
    secretAccessKey: pulumi.Input<string>;
    publicDomain: pulumi.Input<string>;
    region?: pulumi.Input<string>;
    enablePathStyle?: pulumi.Input<boolean>;
    setAcl?: pulumi.Input<boolean>;
  };

  auth: {
    secret: pulumi.Input<string>;
    oidc: LobeChatOIDCProvider;
  };

  image?: pulumi.Input<string>;

  replicas?: pulumi.Input<number>;

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
    annotations?: pulumi.Input<{ [key: string]: string }>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };

  extraEnv?: pulumi.Input<k8s.types.input.core.v1.EnvVar[]>;

  search?: LobeChatSearchConfig;
}

export class LobeChat extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: LobeChatArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:LobeChat", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "lobechat",
      component: name,
    };

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      stringData: pulumi.all([
        args.database.url,
        args.database.keyVaultsSecret,
        args.s3.accessKeyId,
        args.s3.secretAccessKey,
        args.auth.secret,
        args.auth.oidc.secrets,
      ]).apply(([
        databaseUrl,
        keyVaultsSecret,
        s3AccessKeyId,
        s3SecretAccessKey,
        authSecret,
        oidcSecrets,
      ]) => ({
        DATABASE_URL: databaseUrl,
        KEY_VAULTS_SECRET: keyVaultsSecret,
        S3_ACCESS_KEY_ID: s3AccessKeyId,
        S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
        NEXT_AUTH_SECRET: authSecret,
        ...oidcSecrets,
      })),
    }, defaultResourceOptions);

    const env: pulumi.Input<k8s.types.input.core.v1.EnvVar[]> = pulumi.all([
      args.domain,
      args.s3.endpoint,
      args.s3.bucket,
      args.s3.publicDomain,
      args.s3.region,
      args.s3.enablePathStyle,
      args.s3.setAcl,
      args.auth.oidc.provider,
      args.auth.oidc.env,
      args.auth.oidc.secrets,
      args.extraEnv,
      args.search?.providers,
      args.search?.searxng?.url,
      args.search?.crawlerImpls,
    ]).apply(([
      domain,
      s3Endpoint,
      s3Bucket,
      s3PublicDomain,
      s3Region,
      s3EnablePathStyle,
      s3SetAcl,
      oidcProvider,
      oidcEnv,
      oidcSecrets,
      extraEnv,
      searchProviders,
      searxngUrl,
      crawlerImpls,
    ]) => {
      const envVars: k8s.types.input.core.v1.EnvVar[] = [
        { name: "APP_URL", value: `https://${domain}` },

        {
          name: "DATABASE_URL",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "DATABASE_URL",
            },
          },
        },
        { name: "DATABASE_DRIVER", value: "node" },
        {
          name: "KEY_VAULTS_SECRET",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "KEY_VAULTS_SECRET",
            },
          },
        },

        { name: "S3_ENDPOINT", value: s3Endpoint as string },
        { name: "S3_BUCKET", value: s3Bucket as string },
        { name: "S3_PUBLIC_DOMAIN", value: s3PublicDomain as string },
        {
          name: "S3_ACCESS_KEY_ID",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "S3_ACCESS_KEY_ID",
            },
          },
        },
        {
          name: "S3_SECRET_ACCESS_KEY",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "S3_SECRET_ACCESS_KEY",
            },
          },
        },

        { name: "NEXT_AUTH_SSO_PROVIDERS", value: oidcProvider as string },
        { name: "NEXTAUTH_URL", value: `https://${domain}/api/auth` },
        {
          name: "NEXT_AUTH_SECRET",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "NEXT_AUTH_SECRET",
            },
          },
        },
      ];

      for (const [key, value] of Object.entries(oidcEnv as Record<string, string>)) {
        envVars.push({ name: key, value });
      }

      for (const key of Object.keys(oidcSecrets as Record<string, string>)) {
        envVars.push({
          name: key,
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key,
            },
          },
        });
      }

      if (s3Region) {
        envVars.push({ name: "S3_REGION", value: s3Region as string });
      }

      if (s3EnablePathStyle !== undefined) {
        envVars.push({ name: "S3_ENABLE_PATH_STYLE", value: s3EnablePathStyle ? "1" : "0" });
      }

      if (s3SetAcl !== undefined) {
        envVars.push({ name: "S3_SET_ACL", value: s3SetAcl ? "1" : "0" });
      }

      if (extraEnv) {
        envVars.push(...(extraEnv as k8s.types.input.core.v1.EnvVar[]));
      }

      if (searchProviders && (searchProviders as string[]).length > 0) {
        envVars.push({ name: "SEARCH_PROVIDERS", value: (searchProviders as string[]).join(",") });
      }

      if (searxngUrl) {
        envVars.push({ name: "SEARXNG_URL", value: searxngUrl as string });
      }

      if (crawlerImpls && (crawlerImpls as string[]).length > 0) {
        envVars.push({ name: "CRAWLER_IMPLS", value: (crawlerImpls as string[]).join(",") });
      }

      return envVars;
    });

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: args.replicas || 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels,
          },
          spec: {
            containers: [{
              name: "lobechat",
              image: args.image || DOCKER_IMAGES.LOBECHAT_DATABASE.image,
              imagePullPolicy: "IfNotPresent",
              ports: [{
                containerPort: 3210,
                name: "http",
              }],
              env,
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "512Mi",
                  cpu: args.resources?.requests?.cpu || "200m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "2Gi",
                  cpu: args.resources?.limits?.cpu || "1000m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/",
                  port: 3210,
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 3210,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
            }],
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 80,
          targetPort: 3210,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    if (args.ingress?.enabled) {
      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.className,
          tls: args.ingress.tls?.enabled ? [{
            hosts: [args.domain],
            secretName: args.ingress.tls.secretName,
          }] : undefined,
          rules: [{
            host: args.domain,
            http: {
              paths: [{
                path: "/",
                pathType: "Prefix" as const,
                backend: {
                  service: {
                    name: this.service.metadata.name,
                    port: {
                      number: 80,
                    },
                  },
                },
              }],
            },
          }],
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      secret: this.secret,
      ingress: this.ingress,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local`;
  }
}

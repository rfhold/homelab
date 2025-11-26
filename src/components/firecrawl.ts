import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface FirecrawlResourceConfig {
  requests?: {
    memory?: pulumi.Input<string>;
    cpu?: pulumi.Input<string>;
  };
  limits?: {
    memory?: pulumi.Input<string>;
    cpu?: pulumi.Input<string>;
  };
}

export interface FirecrawlArgs {
  namespace: pulumi.Input<string>;

  redis: {
    url: pulumi.Input<string>;
  };

  postgres?: {
    resources?: FirecrawlResourceConfig;
  };

  searxng?: {
    endpoint: pulumi.Input<string>;
    engines?: pulumi.Input<string>;
    categories?: pulumi.Input<string>;
  };

  ai?: {
    baseUrl: pulumi.Input<string>;
    apiKey: pulumi.Input<string>;
    modelName?: pulumi.Input<string>;
    embeddingModelName?: pulumi.Input<string>;
  };

  resources?: {
    api?: FirecrawlResourceConfig;
    playwright?: FirecrawlResourceConfig;
  };

  httpRoute?: {
    enabled: boolean;
    hostname: pulumi.Input<string>;
    gatewayRef: {
      name: pulumi.Input<string>;
      namespace: pulumi.Input<string>;
    };
    requestTimeout?: pulumi.Input<string>;
  };

  image?: {
    api?: pulumi.Input<string>;
    playwright?: pulumi.Input<string>;
    nuqPostgres?: pulumi.Input<string>;
  };

  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

export class Firecrawl extends pulumi.ComponentResource {
  public readonly apiDeployment: k8s.apps.v1.Deployment;
  public readonly apiService: k8s.core.v1.Service;
  public readonly playwrightDeployment: k8s.apps.v1.Deployment;
  public readonly playwrightService: k8s.core.v1.Service;
  public readonly nuqPostgresDeployment: k8s.apps.v1.Deployment;
  public readonly nuqPostgresService: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;
  public readonly httpRoute?: k8s.apiextensions.CustomResource;

  constructor(name: string, args: FirecrawlArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Firecrawl", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "firecrawl",
      component: name,
    };

    const postgresPassword = new random.RandomPassword(`${name}-postgres-password`, {
      length: 32,
      special: false,
    }, defaultResourceOptions);

    const nuqPostgres = this.createNuqPostgresService(name, args, labels, postgresPassword, defaultResourceOptions);
    this.nuqPostgresDeployment = nuqPostgres.deployment;
    this.nuqPostgresService = nuqPostgres.service;

    this.secret = this.createSecret(name, args, labels, postgresPassword, defaultResourceOptions);

    const playwright = this.createPlaywrightService(name, args, labels, defaultResourceOptions);
    this.playwrightDeployment = playwright.deployment;
    this.playwrightService = playwright.service;

    const api = this.createApiService(name, args, labels, defaultResourceOptions);
    this.apiDeployment = api.deployment;
    this.apiService = api.service;

    if (args.httpRoute?.enabled) {
      this.httpRoute = this.createHttpRoute(name, args, labels, defaultResourceOptions);
    }

    this.registerOutputs({
      apiDeployment: this.apiDeployment,
      apiService: this.apiService,
      playwrightDeployment: this.playwrightDeployment,
      playwrightService: this.playwrightService,
      nuqPostgresDeployment: this.nuqPostgresDeployment,
      nuqPostgresService: this.nuqPostgresService,
      secret: this.secret,
      httpRoute: this.httpRoute,
    });
  }

  private createNuqPostgresService(
    name: string,
    args: FirecrawlArgs,
    labels: { app: string; component: string },
    postgresPassword: random.RandomPassword,
    resourceOptions: pulumi.ResourceOptions
  ): { deployment: k8s.apps.v1.Deployment; service: k8s.core.v1.Service } {
    const nuqLabels = { ...labels, service: "nuq-postgres" };

    const deployment = new k8s.apps.v1.Deployment(`${name}-nuq-postgres-deployment`, {
      metadata: {
        name: `${name}-nuq-postgres`,
        namespace: args.namespace,
        labels: nuqLabels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: nuqLabels,
        },
        template: {
          metadata: {
            labels: nuqLabels,
          },
          spec: {
            tolerations: args.tolerations,
            nodeSelector: args.nodeSelector,
            containers: [{
              name: "postgres",
              image: args.image?.nuqPostgres || DOCKER_IMAGES.FIRECRAWL_NUQ_POSTGRES.image,
              ports: [{
                containerPort: 5432,
                name: "postgres",
              }],
              env: [
                { name: "POSTGRES_USER", value: "postgres" },
                { name: "POSTGRES_PASSWORD", value: postgresPassword.result },
                { name: "POSTGRES_DB", value: "postgres" },
              ],
              resources: {
                requests: {
                  memory: args.postgres?.resources?.requests?.memory || "256Mi",
                  cpu: args.postgres?.resources?.requests?.cpu || "100m",
                },
                limits: {
                  memory: args.postgres?.resources?.limits?.memory || "1Gi",
                  cpu: args.postgres?.resources?.limits?.cpu || "500m",
                },
              },
              readinessProbe: {
                exec: {
                  command: ["pg_isready", "-U", "postgres"],
                },
                initialDelaySeconds: 10,
                periodSeconds: 10,
              },
              livenessProbe: {
                exec: {
                  command: ["pg_isready", "-U", "postgres"],
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
            }],
          },
        },
      },
    }, resourceOptions);

    const service = new k8s.core.v1.Service(`${name}-nuq-postgres-service`, {
      metadata: {
        name: `${name}-nuq-postgres`,
        namespace: args.namespace,
        labels: nuqLabels,
      },
      spec: {
        type: "ClusterIP",
        selector: nuqLabels,
        ports: [{
          port: 5432,
          targetPort: 5432,
          protocol: "TCP",
          name: "postgres",
        }],
      },
    }, resourceOptions);

    return { deployment, service };
  }

  private createSecret(
    name: string,
    args: FirecrawlArgs,
    labels: { app: string; component: string },
    postgresPassword: random.RandomPassword,
    resourceOptions: pulumi.ResourceOptions
  ): k8s.core.v1.Secret {
    const postgresUrl = pulumi.interpolate`postgresql://postgres:${postgresPassword.result}@${name}-nuq-postgres:5432/postgres`;

    return new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      stringData: pulumi.all([
        args.redis.url,
        postgresUrl,
        args.ai?.apiKey,
      ]).apply(([redisUrl, pgUrl, aiApiKey]) => {
        const data: Record<string, string> = {
          REDIS_URL: redisUrl,
          NUQ_DATABASE_URL: pgUrl,
        };
        if (aiApiKey) {
          data.OPENAI_API_KEY = aiApiKey;
        }
        return data;
      }),
    }, resourceOptions);
  }

  private createPlaywrightService(
    name: string,
    args: FirecrawlArgs,
    labels: { app: string; component: string },
    resourceOptions: pulumi.ResourceOptions
  ): { deployment: k8s.apps.v1.Deployment; service: k8s.core.v1.Service } {
    const playwrightLabels = { ...labels, service: "playwright" };

    const deployment = new k8s.apps.v1.Deployment(`${name}-playwright-deployment`, {
      metadata: {
        name: `${name}-playwright`,
        namespace: args.namespace,
        labels: playwrightLabels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: playwrightLabels,
        },
        template: {
          metadata: {
            labels: playwrightLabels,
          },
          spec: {
            tolerations: args.tolerations,
            nodeSelector: args.nodeSelector,
            containers: [{
              name: "playwright",
              image: args.image?.playwright || DOCKER_IMAGES.PLAYWRIGHT_SERVICE.image,
              ports: [{
                containerPort: 3000,
                name: "http",
              }],
              env: [
                { name: "PORT", value: "3000" },
                { name: "BLOCK_MEDIA", value: "true" },
              ],
              resources: {
                requests: {
                  memory: args.resources?.playwright?.requests?.memory || "512Mi",
                  cpu: args.resources?.playwright?.requests?.cpu || "200m",
                },
                limits: {
                  memory: args.resources?.playwright?.limits?.memory || "2Gi",
                  cpu: args.resources?.playwright?.limits?.cpu || "1000m",
                },
              },
              readinessProbe: {
                httpGet: {
                  path: "/health",
                  port: 3000,
                },
                initialDelaySeconds: 10,
                periodSeconds: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: "/health",
                  port: 3000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
            }],
          },
        },
      },
    }, resourceOptions);

    const service = new k8s.core.v1.Service(`${name}-playwright-service`, {
      metadata: {
        name: `${name}-playwright`,
        namespace: args.namespace,
        labels: playwrightLabels,
      },
      spec: {
        type: "ClusterIP",
        selector: playwrightLabels,
        ports: [{
          port: 3000,
          targetPort: 3000,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, resourceOptions);

    return { deployment, service };
  }

  private createApiService(
    name: string,
    args: FirecrawlArgs,
    labels: { app: string; component: string },
    resourceOptions: pulumi.ResourceOptions
  ): { deployment: k8s.apps.v1.Deployment; service: k8s.core.v1.Service } {
    const apiLabels = { ...labels, service: "api" };

    const env: pulumi.Input<k8s.types.input.core.v1.EnvVar[]> = pulumi.all([
      args.searxng?.endpoint,
      args.searxng?.engines,
      args.searxng?.categories,
      args.ai?.baseUrl,
      args.ai?.modelName,
      args.ai?.embeddingModelName,
    ]).apply(([
      searxngEndpoint,
      searxngEngines,
      searxngCategories,
      aiBaseUrl,
      modelName,
      embeddingModelName,
    ]) => {
      const envVars: k8s.types.input.core.v1.EnvVar[] = [
        { name: "HOST", value: "0.0.0.0" },
        { name: "PORT", value: "3002" },
        { name: "USE_DB_AUTHENTICATION", value: "false" },
        { name: "IS_KUBERNETES", value: "true" },
        {
          name: "REDIS_URL",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "REDIS_URL",
            },
          },
        },
        {
          name: "REDIS_RATE_LIMIT_URL",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "REDIS_URL",
            },
          },
        },
        {
          name: "NUQ_DATABASE_URL",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "NUQ_DATABASE_URL",
            },
          },
        },
        {
          name: "PLAYWRIGHT_MICROSERVICE_URL",
          value: pulumi.interpolate`http://${name}-playwright:3000/scrape`,
        },
      ];

      if (searxngEndpoint) {
        envVars.push({ name: "SEARXNG_ENDPOINT", value: searxngEndpoint as string });
      }
      if (searxngEngines) {
        envVars.push({ name: "SEARXNG_ENGINES", value: searxngEngines as string });
      }
      if (searxngCategories) {
        envVars.push({ name: "SEARXNG_CATEGORIES", value: searxngCategories as string });
      }

      if (aiBaseUrl) {
        envVars.push({ name: "OPENAI_BASE_URL", value: aiBaseUrl as string });
        envVars.push({
          name: "OPENAI_API_KEY",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "OPENAI_API_KEY",
            },
          },
        });
      }
      if (modelName) {
        envVars.push({ name: "MODEL_NAME", value: modelName as string });
      }
      if (embeddingModelName) {
        envVars.push({ name: "MODEL_EMBEDDING_NAME", value: embeddingModelName as string });
      }

      return envVars;
    });

    const deployment = new k8s.apps.v1.Deployment(`${name}-api-deployment`, {
      metadata: {
        name: `${name}-api`,
        namespace: args.namespace,
        labels: apiLabels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: apiLabels,
        },
        template: {
          metadata: {
            labels: apiLabels,
          },
          spec: {
            tolerations: args.tolerations,
            nodeSelector: args.nodeSelector,
            containers: [{
              name: "api",
              image: args.image?.api || DOCKER_IMAGES.FIRECRAWL.image,
              ports: [{
                containerPort: 3002,
                name: "http",
              }],
              env,
              resources: {
                requests: {
                  memory: args.resources?.api?.requests?.memory || "512Mi",
                  cpu: args.resources?.api?.requests?.cpu || "200m",
                },
                limits: {
                  memory: args.resources?.api?.limits?.memory || "2Gi",
                  cpu: args.resources?.api?.limits?.cpu || "1000m",
                },
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 3002,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: "/",
                  port: 3002,
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
              },
            }],
          },
        },
      },
    }, { ...resourceOptions, dependsOn: [this.playwrightService] });

    const service = new k8s.core.v1.Service(`${name}-api-service`, {
      metadata: {
        name: `${name}-api`,
        namespace: args.namespace,
        labels: apiLabels,
      },
      spec: {
        type: "ClusterIP",
        selector: apiLabels,
        ports: [{
          port: 3002,
          targetPort: 3002,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, resourceOptions);

    return { deployment, service };
  }

  private createHttpRoute(
    name: string,
    args: FirecrawlArgs,
    labels: { app: string; component: string },
    resourceOptions: pulumi.ResourceOptions
  ): k8s.apiextensions.CustomResource {
    const timeouts: Record<string, pulumi.Input<string>> = {};
    if (args.httpRoute?.requestTimeout) {
      timeouts.request = args.httpRoute.requestTimeout;
    }

    return new k8s.apiextensions.CustomResource(`${name}-httproute`, {
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      metadata: {
        name: `${name}-route`,
        namespace: args.namespace,
        labels,
      },
      spec: {
        parentRefs: [{
          group: "gateway.networking.k8s.io",
          kind: "Gateway",
          name: args.httpRoute!.gatewayRef.name,
          namespace: args.httpRoute!.gatewayRef.namespace,
        }],
        hostnames: [args.httpRoute!.hostname],
        rules: [{
          backendRefs: [{
            name: `${name}-api`,
            kind: "Service",
            port: 3002,
          }],
          matches: [{
            path: {
              type: "PathPrefix",
              value: "/",
            },
          }],
          ...(Object.keys(timeouts).length > 0 && { timeouts }),
        }],
      },
    }, { ...resourceOptions, dependsOn: [this.apiService] });
  }

  public getApiUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.apiService.metadata.name}.${this.apiService.metadata.namespace}.svc.cluster.local:3002`;
  }

  public getApiServiceName(): pulumi.Output<string> {
    return this.apiService.metadata.name;
  }
}

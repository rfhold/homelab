import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import { DOCKER_IMAGES } from "../docker-images";
import { getIngressUrl } from "../utils/kubernetes";

export enum FirecrawlProvider {
  OPENAI = "openai",
}

/**
 * Configuration for the Firecrawl component
 */
export interface FirecrawlArgs {
  /** Kubernetes namespace to deploy Firecrawl into */
  namespace: pulumi.Input<string>;

  /** Redis/Valkey connection string for job queue and rate limiting */
  redisUrl: pulumi.Input<string>;

  /** Number of replicas for API and Worker services (defaults to 1) */
  replicas?: pulumi.Input<number>;

  /** LLM provider configuration for AI features */
  provider: {
    /** Provider type (currently only OpenAI supported) */
    type: pulumi.Input<FirecrawlProvider>;
    /** API key for the provider (optional if using module-level config) */
    apiKey?: pulumi.Input<string>;
    /** Model for content extraction and processing */
    model?: pulumi.Input<string>;
    /** Model for generating embeddings */
    embeddingModel?: pulumi.Input<string>;
  };

  resources?: {
    api?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
    worker?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
    playwright?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
  };

  proxy?: {
    server?: pulumi.Input<string>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
  };

  searxng?: {
    endpoint?: pulumi.Input<string>;
    engines?: pulumi.Input<string>;
    categories?: pulumi.Input<string>;
  };

  llamaparse?: {
    apiKey?: pulumi.Input<string>;
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
}

/**
 * Firecrawl component - provides web scraping and crawling service with LLM-ready output
 * 
 * This component deploys:
 * - API service for handling scraping requests
 * - Worker service for processing crawl jobs
 * - Playwright service for JavaScript rendering
 * 
 * @example
 * ```typescript
 * import { Firecrawl, FirecrawlProvider } from "../components/firecrawl";
 * import { createRedisConnectionString } from "../adapters/redis";
 * 
 * const firecrawl = new Firecrawl("scraper", {
 *   namespace: "ai-workspace",
 *   redisUrl: createRedisConnectionString(redisConfig),
 *   provider: {
 *     type: FirecrawlProvider.OPENAI,
 *     apiKey: "sk-...",
 *     model: "gpt-4o-mini",
 *     embeddingModel: "text-embedding-3-small",
 *   },
 *   replicas: 2,
 * });
 * 
 * // Access the API endpoint
 * const apiEndpoint = firecrawl.getApiEndpoint();
 * ```
 * 
 * @see https://github.com/mendableai/firecrawl
 * @see https://docs.firecrawl.dev/
 */
export class Firecrawl extends pulumi.ComponentResource {
  public readonly apiDeployment: k8s.apps.v1.Deployment;
  public readonly workerDeployment: k8s.apps.v1.Deployment;
  public readonly playwrightDeployment: k8s.apps.v1.Deployment;
  public readonly apiService: k8s.core.v1.Service;
  public readonly playwrightService: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: FirecrawlArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Firecrawl", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const bullAuthKey = new random.RandomPassword(`${name}-bull-auth-key`, {
      length: 32,
      special: false,
    }, defaultResourceOptions);

    const commonEnv = pulumi.all([
      args.provider.type,
      args.provider.apiKey,
      args.provider.model,
      args.provider.embeddingModel,
      args.proxy?.server,
      args.proxy?.username,
      args.proxy?.password,
      args.searxng?.endpoint,
      args.searxng?.engines,
      args.searxng?.categories,
      args.llamaparse?.apiKey,
    ]).apply(([
      providerType,
      apiKey,
      model,
      embeddingModel,
      proxyServer,
      proxyUsername,
      proxyPassword,
      searxngEndpoint,
      searxngEngines,
      searxngCategories,
      llamaparseKey,
    ]) => {
      const env: k8s.types.input.core.v1.EnvVar[] = [
        { name: "PORT", value: "3002" },
        { name: "HOST", value: "0.0.0.0" },
        { name: "IS_KUBERNETES", value: "true" },
        { name: "USE_DB_AUTHENTICATION", value: "false" },
        { name: "PLAYWRIGHT_MICROSERVICE_URL", value: `http://${name}-playwright:3000` },
      ];

      // Non-secret environment variables
      if (model) env.push({ name: "MODEL_NAME", value: model as string });
      if (embeddingModel) env.push({ name: "MODEL_EMBEDDING_NAME", value: embeddingModel as string });
      if (proxyServer) env.push({ name: "PROXY_SERVER", value: proxyServer as string });
      if (searxngEndpoint) env.push({ name: "SEARXNG_ENDPOINT", value: searxngEndpoint as string });
      if (searxngEngines) env.push({ name: "SEARXNG_ENGINES", value: searxngEngines as string });
      if (searxngCategories) env.push({ name: "SEARXNG_CATEGORIES", value: searxngCategories as string });

      // Secret environment variables - these will be added via valueFrom
      const secretEnv: k8s.types.input.core.v1.EnvVar[] = [
        {
          name: "REDIS_URL",
          valueFrom: {
            secretKeyRef: {
              name: name,
              key: "REDIS_URL",
            },
          },
        },
        {
          name: "REDIS_RATE_LIMIT_URL",
          valueFrom: {
            secretKeyRef: {
              name: name,
              key: "REDIS_URL",
            },
          },
        },
        {
          name: "BULL_AUTH_KEY",
          valueFrom: {
            secretKeyRef: {
              name: name,
              key: "BULL_AUTH_KEY",
            },
          },
        },
      ];

      if (providerType === FirecrawlProvider.OPENAI && apiKey) {
        secretEnv.push({
          name: "OPENAI_API_KEY",
          valueFrom: {
            secretKeyRef: {
              name: name,
              key: "OPENAI_API_KEY",
            },
          },
        });
      }

      if (proxyUsername) {
        secretEnv.push({
          name: "PROXY_USERNAME",
          valueFrom: {
            secretKeyRef: {
              name: name,
              key: "PROXY_USERNAME",
            },
          },
        });
      }
      if (proxyPassword) {
        secretEnv.push({
          name: "PROXY_PASSWORD",
          valueFrom: {
            secretKeyRef: {
              name: name,
              key: "PROXY_PASSWORD",
            },
          },
        });
      }

      if (llamaparseKey) {
        secretEnv.push({
          name: "LLAMAPARSE_API_KEY",
          valueFrom: {
            secretKeyRef: {
              name: name,
              key: "LLAMAPARSE_API_KEY",
            },
          },
        });
      }

      return { env, secretEnv };
    });

    const secretData = pulumi.all([
      bullAuthKey.result,
      args.redisUrl,
      args.provider.apiKey,
      args.proxy?.username,
      args.proxy?.password,
      args.llamaparse?.apiKey,
    ]).apply(([
      bullAuthKeyValue,
      redisUrlValue,
      apiKeyValue,
      proxyUsernameValue,
      proxyPasswordValue,
      llamaparseKeyValue,
    ]) => {
      const data: { [key: string]: string } = {
        BULL_AUTH_KEY: bullAuthKeyValue,
        REDIS_URL: redisUrlValue as string,
      };

      if (apiKeyValue) {
        data.OPENAI_API_KEY = apiKeyValue as string;
      }
      if (proxyUsernameValue) {
        data.PROXY_USERNAME = proxyUsernameValue as string;
      }
      if (proxyPasswordValue) {
        data.PROXY_PASSWORD = proxyPasswordValue as string;
      }
      if (llamaparseKeyValue) {
        data.LLAMAPARSE_API_KEY = llamaparseKeyValue as string;
      }

      return data;
    });

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      stringData: secretData,
    }, defaultResourceOptions);

    const labels = { app: "firecrawl", component: name };
    const apiLabels = { ...labels, service: "api" };
    const workerLabels = { ...labels, service: "worker" };
    const playwrightLabels = { ...labels, service: "playwright" };

    this.playwrightDeployment = new k8s.apps.v1.Deployment(`${name}-playwright`, {
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
            containers: [{
              name: "playwright",
              image: DOCKER_IMAGES.PLAYWRIGHT_SERVICE.image,
              ports: [{
                containerPort: 3000,
                name: "http",
              }],
              env: [
                { name: "PORT", value: "3000" },
                ...(args.proxy?.server ? [
                  { name: "PROXY_SERVER", value: args.proxy.server },
                  ...(args.proxy.username ? [{ name: "PROXY_USERNAME", value: args.proxy.username }] : []),
                  ...(args.proxy.password ? [{ name: "PROXY_PASSWORD", value: args.proxy.password }] : []),
                ] : []),
              ],
              resources: {
                requests: {
                  memory: args.resources?.playwright?.requests?.memory || "512Mi",
                  cpu: args.resources?.playwright?.requests?.cpu || "250m",
                },
                limits: {
                  memory: args.resources?.playwright?.limits?.memory || "2Gi",
                  cpu: args.resources?.playwright?.limits?.cpu || "1000m",
                },
              },
            }],
          },
        },
      },
    }, defaultResourceOptions);

    this.playwrightService = new k8s.core.v1.Service(`${name}-playwright-service`, {
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
    }, defaultResourceOptions);

    const apiEnv = commonEnv.apply(({ env, secretEnv }) => [
      ...env,
      ...secretEnv,
      { name: "FLY_PROCESS_GROUP", value: "app" },
      { name: "ENV", value: "production" },
    ]);

    this.apiDeployment = new k8s.apps.v1.Deployment(`${name}-api`, {
      metadata: {
        name: `${name}-api`,
        namespace: args.namespace,
        labels: apiLabels,
      },
      spec: {
        replicas: args.replicas || 1,
        selector: {
          matchLabels: apiLabels,
        },
        template: {
          metadata: {
            labels: apiLabels,
          },
          spec: {
            containers: [{
              name: "api",
              image: DOCKER_IMAGES.FIRECRAWL.image,
              ports: [{
                containerPort: 3002,
                name: "http",
              }],
              env: apiEnv,
              resources: {
                requests: {
                  memory: args.resources?.api?.requests?.memory || "256Mi",
                  cpu: args.resources?.api?.requests?.cpu || "100m",
                },
                limits: {
                  memory: args.resources?.api?.limits?.memory || "512Mi",
                  cpu: args.resources?.api?.limits?.cpu || "500m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/v0/health/liveness",
                  port: 3002,
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: "/v0/health/readiness",
                  port: 3002,
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            }],
          },
        },
      },
    }, {
      dependsOn: [this.playwrightService],
      ...defaultResourceOptions,
    });

    this.apiService = new k8s.core.v1.Service(`${name}-api-service`, {
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
    }, defaultResourceOptions);

    const workerEnv = commonEnv.apply(({ env, secretEnv }) => [
      ...env,
      ...secretEnv,
      { name: "FLY_PROCESS_GROUP", value: "worker" },
      { name: "ENV", value: "production" },
    ]);

    this.workerDeployment = new k8s.apps.v1.Deployment(`${name}-worker`, {
      metadata: {
        name: `${name}-worker`,
        namespace: args.namespace,
        labels: workerLabels,
      },
      spec: {
        replicas: args.replicas || 1,
        selector: {
          matchLabels: workerLabels,
        },
        template: {
          metadata: {
            labels: workerLabels,
          },
          spec: {
            containers: [{
              name: "worker",
              image: DOCKER_IMAGES.FIRECRAWL.image,
              env: workerEnv,
              resources: {
                requests: {
                  memory: args.resources?.worker?.requests?.memory || "2Gi",
                  cpu: args.resources?.worker?.requests?.cpu || "500m",
                },
                limits: {
                  memory: args.resources?.worker?.limits?.memory || "4Gi",
                  cpu: args.resources?.worker?.limits?.cpu || "1000m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/liveness",
                  port: 3002,
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
            }],
          },
        },
      },
    }, {
      dependsOn: [this.playwrightService, this.apiService],
      ...defaultResourceOptions,
    });

    if (args.ingress?.enabled) {
      const ingressRules = [{
        host: args.ingress.host,
        http: {
          paths: [{
            path: "/",
            pathType: "Prefix" as const,
            backend: {
              service: {
                name: this.apiService.metadata.name,
                port: {
                  number: 3002,
                },
              },
            },
          }],
        },
      }];

      const ingressTls = args.ingress.tls?.enabled ? [{
        hosts: [args.ingress.host],
        secretName: args.ingress.tls.secretName,
      }] : undefined;

      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.className,
          rules: ingressRules,
          tls: ingressTls,
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      apiDeployment: this.apiDeployment,
      workerDeployment: this.workerDeployment,
      playwrightDeployment: this.playwrightDeployment,
      apiService: this.apiService,
      playwrightService: this.playwrightService,
      secret: this.secret,
      ingress: this.ingress,
    });
  }

  public getApiEndpoint(): pulumi.Output<string> {
    if (this.ingress) {
      return getIngressUrl(this.ingress);
    }
    return pulumi.interpolate`http://${this.apiService.metadata.name}:3002`;
  }
}

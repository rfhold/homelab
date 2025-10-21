import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createYAMLDocumentOutput } from "../utils/yaml";
import { DOCKER_IMAGES } from "../docker-images";

/**
 * Configuration for the LibreChat component
 */
export interface CustomProvider {
  name: string;
  baseURL: string;
  apiKey?: string;
  models: string[];
  titleModel?: string;
  additionalConfig?: Record<string, any>;
}

export interface LibreChatArgs {
  /** Kubernetes namespace to deploy LibreChat into */
  namespace: pulumi.Input<string>;
  
  /** Custom name for the component (defaults to resource name) */
  name?: pulumi.Input<string>;
  
  /** Domain name for LibreChat (used for ingress) */
  domain: pulumi.Input<string>;
  
  /** Number of replicas (defaults to 1) */
  replicas?: pulumi.Input<number>;
  
  /** Docker image configuration */
  image?: {
    /** Docker image to use (defaults to DOCKER_IMAGES.LIBRECHAT.image) */
    repository?: pulumi.Input<string>;
    /** Image pull policy */
    pullPolicy?: pulumi.Input<string>;
  };
  
  /** Database connection configuration */
  database: {
    /** Database URL (MongoDB connection string) */
    url: pulumi.Input<string>;
  };
  
  /** Search engine configuration */
  meilisearch: {
    /** Meilisearch URL */
    url: pulumi.Input<string>;
    /** Meilisearch master key */
    masterKey: pulumi.Input<string>;
    /** Disable sync for multi-node setups (optional) */
    noSync?: pulumi.Input<boolean>;
  };
  
  /** RAG API configuration */
  ragApi?: {
    /** RAG API URL */
    url: pulumi.Input<string>;
    /** RAG API key (if required) */
    apiKey?: pulumi.Input<string>;
  };
  
  /** Storage configuration */
  storage?: {
    /** Storage type (defaults to "local") */
    type?: pulumi.Input<"local" | "s3">;
    /** Local storage configuration */
    local?: {
      /** Storage size (defaults to "10Gi") */
      size?: pulumi.Input<string>;
      /** Storage class */
      storageClass?: pulumi.Input<string>;
    };
    /** S3 storage configuration */
    s3?: {
      /** S3 endpoint */
      endpoint: pulumi.Input<string>;
      /** S3 bucket name */
      bucket: pulumi.Input<string>;
      /** S3 access key */
      accessKey: pulumi.Input<string>;
      /** S3 secret key */
      secretKey: pulumi.Input<string>;
    };
  };
  
  /** Security keys */
  security: {
    /** Credentials encryption key (32-byte hex) */
    credsKey: pulumi.Input<string>;
    /** Credentials encryption IV (16-byte hex) */
    credsIV: pulumi.Input<string>;
    /** JWT signing secret */
    jwtSecret: pulumi.Input<string>;
    /** JWT refresh token secret */
    jwtRefreshSecret: pulumi.Input<string>;
  };
  
  /** Provider configuration */
  providers?: {
    /** OpenAI configuration */
    openai?: {
      /** API key */
      apiKey: pulumi.Input<string>;
      /** Available models */
      models?: pulumi.Input<string[]>;
      /** STT configuration */
      stt?: {
        /** STT model */
        model: pulumi.Input<string>;
      };
      /** TTS configuration */
      tts?: {
        /** TTS model */
        model: pulumi.Input<string>;
        /** TTS voice */
        voice: pulumi.Input<string>;
      };
    };
    /** Anthropic configuration */
    anthropic?: {
      /** API key */
      apiKey: pulumi.Input<string>;
      /** Available models */
      models?: pulumi.Input<string[]>;
    };
    /** OpenRouter configuration */
    openrouter?: {
      /** API key */
      apiKey: pulumi.Input<string>;
      /** Available models */
      models?: pulumi.Input<string[]>;
    };
    /** Jina AI configuration */
    jinaai?: {
      /** API key */
      apiKey: pulumi.Input<string>;
    };
    /** Custom providers */
    customProviders?: CustomProvider[];
  };
  
  /** Service URLs */
  services?: {
    /** SearXNG URL */
    searxng?: pulumi.Input<string>;
    /** SearXNG API key */
    searxngApiKey?: pulumi.Input<string>;
    /** Firecrawl URL */
    firecrawl?: pulumi.Input<string>;
    /** Firecrawl API key */
    firecrawlApiKey?: pulumi.Input<string>;
  };
  
  /** LibreChat YAML configuration */
  config?: any;
  
  /** Resource limits and requests */
  resources?: {
    /** Resource requests */
    requests?: {
      /** Memory request (defaults to "1Gi") */
      memory?: pulumi.Input<string>;
      /** CPU request (defaults to "500m") */
      cpu?: pulumi.Input<string>;
    };
    /** Resource limits */
    limits?: {
      /** Memory limit (defaults to "4Gi") */
      memory?: pulumi.Input<string>;
      /** CPU limit (defaults to "2000m") */
      cpu?: pulumi.Input<string>;
    };
  };
  
  /** Ingress configuration */
  ingress?: {
    /** Enable ingress */
    enabled?: pulumi.Input<boolean>;
    /** Ingress class name */
    className?: pulumi.Input<string>;
    /** Ingress annotations */
    annotations?: pulumi.Input<{ [key: string]: string }>;
    /** TLS configuration */
    tls?: {
      /** Enable TLS */
      enabled?: pulumi.Input<boolean>;
      /** TLS secret name */
      secretName?: pulumi.Input<string>;
    };
  };
  
  /** Additional environment variables */
  extraEnv?: pulumi.Input<k8s.types.input.core.v1.EnvVar[]>;
}

/**
 * LibreChat component - Open-source AI chat platform
 * 
 * This component deploys LibreChat with:
 * - Multi-model AI support (OpenAI, Anthropic, OpenRouter, etc.)
 * - Speech-to-text and text-to-speech capabilities
 * - Web search integration (SearXNG + Firecrawl)
 * - RAG (Retrieval-Augmented Generation) support
 * - File upload and storage
 * - User authentication and management
 * 
 * @example
 * ```typescript
 * import { LibreChat } from "../components/librechat";
 * 
 * const librechat = new LibreChat("librechat", {
 *   namespace: "ai-workspace",
 *   domain: "chat.example.com",
 *   database: {
 *     url: mongodbUrl,
 *   },
 *   meilisearch: {
 *     url: meilisearchUrl,
 *     masterKey: pulumi.secret("master-key"),
 *   },
 *   security: {
 *     credsKey: pulumi.secret("32-byte-hex-key"),
 *     credsIV: pulumi.secret("16-byte-hex-iv"),
 *     jwtSecret: pulumi.secret("jwt-secret"),
 *     jwtRefreshSecret: pulumi.secret("jwt-refresh-secret"),
 *   },
 *   providers: {
 *     openai: {
 *       apiKey: config.requireSecret("openai-api-key"),
 *       models: ["gpt-4o", "gpt-4o-mini"],
 *     },
 *   },
 * });
 * ```
 * 
 * @see https://github.com/danny-avila/LibreChat
 * @see https://docs.librechat.ai/
 */
export class LibreChat extends pulumi.ComponentResource {
  /** The Kubernetes deployment */
  public readonly deployment: k8s.apps.v1.Deployment;
  
  /** The Kubernetes service */
  public readonly service: k8s.core.v1.Service;
  
  /** The Kubernetes secret containing sensitive configuration */
  public readonly secret: k8s.core.v1.Secret;
  
  /** The Kubernetes ConfigMap containing librechat.yaml */
  public readonly configMap: k8s.core.v1.ConfigMap;
  
  /** The PersistentVolumeClaim for file storage (if using local storage) */
  public readonly pvc?: k8s.core.v1.PersistentVolumeClaim;
  
  /** The Kubernetes ingress (if enabled) */
  public readonly ingress?: k8s.networking.v1.Ingress;
  
  constructor(name: string, args: LibreChatArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:LibreChat", name, {}, opts);
    
    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };
    
    const labels = { 
      app: "librechat",
      component: args.name || name,
    };
    
    // Create secret for sensitive data
    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: args.name || name,
        namespace: args.namespace,
        labels,
      },
      stringData: pulumi.all([
        args.security.credsKey,
        args.security.credsIV,
        args.security.jwtSecret,
        args.security.jwtRefreshSecret,
        args.meilisearch.masterKey,
        args.providers?.openai?.apiKey,
        args.providers?.anthropic?.apiKey,
        args.providers?.openrouter?.apiKey,
        args.providers?.jinaai?.apiKey,
        args.ragApi?.apiKey,
        args.storage?.s3?.secretKey,
        args.services?.searxngApiKey,
        args.services?.firecrawlApiKey,
        args.providers?.customProviders,
      ]).apply(([
        credsKey,
        credsIV,
        jwtSecret,
        jwtRefreshSecret,
        meiliMasterKey,
        openaiApiKey,
        anthropicApiKey,
        openrouterApiKey,
        jinaaiApiKey,
        ragApiKey,
        s3SecretKey,
        searxngApiKey,
        firecrawlApiKey,
        customProviders,
      ]) => {
        const data: { [key: string]: string } = {
          CREDS_KEY: credsKey as string,
          CREDS_IV: credsIV as string,
          JWT_SECRET: jwtSecret as string,
          JWT_REFRESH_SECRET: jwtRefreshSecret as string,
          MEILI_MASTER_KEY: meiliMasterKey as string,
        };
        
        if (openaiApiKey) data.OPENAI_API_KEY = openaiApiKey as string;
        if (anthropicApiKey) data.ANTHROPIC_API_KEY = anthropicApiKey as string;
        if (openrouterApiKey) data.OPENROUTER_API_KEY = openrouterApiKey as string;
        if (jinaaiApiKey) data.JINAAI_API_KEY = jinaaiApiKey as string;
        if (ragApiKey) data.RAG_API_KEY = ragApiKey as string;
        if (s3SecretKey) data.S3_SECRET_KEY = s3SecretKey as string;
        if (searxngApiKey) data.SEARXNG_API_KEY = searxngApiKey as string;
        if (firecrawlApiKey) data.FIRECRAWL_API_KEY = firecrawlApiKey as string;
        
        if (customProviders) {
          (customProviders as CustomProvider[]).forEach((provider, index) => {
            if (provider.apiKey) {
              data[`CUSTOM_PROVIDER_${index}_API_KEY`] = provider.apiKey;
            }
          });
        }
        
        return data;
      }),
    }, defaultResourceOptions);
    
    // Create ConfigMap with librechat.yaml
    const librechatConfig = args.config || this.generateDefaultConfig(args);
    const yamlConfig = createYAMLDocumentOutput(
      librechatConfig,
      "LibreChat Configuration\nManaged by Pulumi"
    );
    
    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${args.name || name}-config`,
        namespace: args.namespace,
        labels,
      },
      data: {
        "librechat.yaml": yamlConfig,
      },
    }, defaultResourceOptions);
    
    // Create PVC for local file storage if needed
    if (pulumi.output(args.storage?.type).apply(t => t !== "s3")) {
      this.pvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-uploads`, {
        metadata: {
          namespace: args.namespace,
          labels,
        },
        spec: {
          accessModes: ["ReadWriteOnce"],
          storageClassName: args.storage?.local?.storageClass,
          resources: {
            requests: {
              storage: args.storage?.local?.size || "10Gi",
            },
          },
        },
      }, defaultResourceOptions);
    }
    
    // Environment variables
    const env = pulumi.all([
      args.database.url,
      args.meilisearch.url,
      args.meilisearch.noSync,
      args.ragApi?.url,
      args.services?.searxng,
      args.services?.firecrawl,
      args.storage?.type,
      args.storage?.s3,
      args.extraEnv,
      args.providers?.customProviders,
    ]).apply(([
      databaseUrl,
      meiliUrl,
      meiliNoSync,
      ragApiUrl,
      searxngUrl,
      firecrawlUrl,
      storageType,
      s3Config,
      extraEnv,
      customProviders,
    ]) => {
      const envVars: k8s.types.input.core.v1.EnvVar[] = [
        // Core configuration
        { name: "NODE_ENV", value: "production" },
        { name: "HOST", value: "0.0.0.0" },
        { name: "PORT", value: "3080" },
        
        // Enable search
        { name: "SEARCH", value: "true" },
        
        // Database
        { name: "MONGO_URI", value: databaseUrl as string },
        
        // Search
        { name: "MEILI_HOST", value: meiliUrl as string },
        { name: "MEILI_NO_ANALYTICS", value: "true" },
        {
          name: "MEILI_MASTER_KEY",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "MEILI_MASTER_KEY",
            },
          },
        },
        
        // Security
        {
          name: "CREDS_KEY",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "CREDS_KEY",
            },
          },
        },
        {
          name: "CREDS_IV",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "CREDS_IV",
            },
          },
        },
        {
          name: "JWT_SECRET",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "JWT_SECRET",
            },
          },
        },
        {
          name: "JWT_REFRESH_SECRET",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "JWT_REFRESH_SECRET",
            },
          },
        },
        
        // Storage
        { name: "FILE_STRATEGY", value: (storageType as string) || "local" },
      ];
      
      // Add provider API keys
      if (args.providers?.openai) {
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
      
      if (args.providers?.anthropic) {
        envVars.push({
          name: "ANTHROPIC_API_KEY",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "ANTHROPIC_API_KEY",
            },
          },
        });
      }
      
      if (args.providers?.openrouter) {
        envVars.push({
          name: "OPENROUTER_API_KEY",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "OPENROUTER_API_KEY",
            },
          },
        });
      }
      
      if (args.providers?.jinaai) {
        envVars.push({
          name: "JINAAI_API_KEY",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "JINAAI_API_KEY",
            },
          },
        });
      }
      
      // RAG API
      if (ragApiUrl) {
        envVars.push({ name: "RAG_API_URL", value: ragApiUrl as string });
        if (args.ragApi?.apiKey) {
          envVars.push({
            name: "RAG_API_KEY",
            valueFrom: {
              secretKeyRef: {
                name: this.secret.metadata.name,
                key: "RAG_API_KEY",
              },
            },
          });
        }
      }
      
      // Service URLs
      if (searxngUrl) {
        envVars.push({ name: "SEARXNG_URL", value: searxngUrl as string });
        if (args.services?.searxngApiKey) {
          envVars.push({
            name: "SEARXNG_API_KEY",
            valueFrom: {
              secretKeyRef: {
                name: this.secret.metadata.name,
                key: "SEARXNG_API_KEY",
              },
            },
          });
        }
      }
      if (firecrawlUrl) {
        envVars.push({ name: "FIRECRAWL_URL", value: firecrawlUrl as string });
        if (args.services?.firecrawlApiKey) {
          envVars.push({
            name: "FIRECRAWL_API_KEY",
            valueFrom: {
              secretKeyRef: {
                name: this.secret.metadata.name,
                key: "FIRECRAWL_API_KEY",
              },
            },
          });
        }
      }
      
      // S3 configuration
      if (storageType === "s3" && s3Config) {
        envVars.push(
          { name: "S3_ENDPOINT", value: (s3Config as any).endpoint },
          { name: "S3_BUCKET", value: (s3Config as any).bucket },
          { name: "S3_ACCESS_KEY", value: (s3Config as any).accessKey },
          {
            name: "S3_SECRET_KEY",
            valueFrom: {
              secretKeyRef: {
                name: this.secret.metadata.name,
                key: "S3_SECRET_KEY",
              },
            },
          }
        );
      } else {
        envVars.push({ name: "STORAGE_DIR", value: "/app/uploads" });
      }
      
      // Add optional Meilisearch sync configuration
      if (meiliNoSync) {
        envVars.push({ name: "MEILI_NO_SYNC", value: "true" });
      }
      
      if (customProviders) {
        (customProviders as CustomProvider[]).forEach((provider, index) => {
          if (provider.apiKey) {
            envVars.push({
              name: `CUSTOM_PROVIDER_${index}_API_KEY`,
              valueFrom: {
                secretKeyRef: {
                  name: this.secret.metadata.name,
                  key: `CUSTOM_PROVIDER_${index}_API_KEY`,
                },
              },
            });
          }
        });
      }
      
      // Add any extra environment variables
      if (extraEnv) {
        envVars.push(...(extraEnv as k8s.types.input.core.v1.EnvVar[]));
      }
      
      return envVars;
    });
    
    // Create deployment
    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: args.name || name,
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
            initContainers: this.pvc ? [{
              name: "fix-permissions",
              image: "busybox:latest",
              command: ["sh", "-c"],
              args: ["chown -R 1000:1000 /app/uploads"],
              volumeMounts: [{
                name: "uploads",
                mountPath: "/app/uploads",
              }],
              securityContext: {
                runAsUser: 0,
                runAsGroup: 0,
              },
            }] : [],
            containers: [{
              name: "librechat",
              image: args.image?.repository || DOCKER_IMAGES.LIBRECHAT.image,
              imagePullPolicy: args.image?.pullPolicy || "IfNotPresent",
              ports: [{
                containerPort: 3080,
                name: "http",
              }],
              env,
              volumeMounts: [
                {
                  name: "config",
                  mountPath: "/app/librechat.yaml",
                  subPath: "librechat.yaml",
                },
                ...(this.pvc ? [{
                  name: "uploads",
                  mountPath: "/app/uploads",
                }] : []),
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
                  path: "/health",
                  port: 3080,
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/health",
                  port: 3080,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
            }],
            volumes: [
              {
                name: "config",
                configMap: {
                  name: this.configMap.metadata.name,
                },
              },
              ...(this.pvc ? [{
                name: "uploads",
                persistentVolumeClaim: {
                  claimName: this.pvc.metadata.name,
                },
              }] : []),
            ],
          },
        },
      },
    }, defaultResourceOptions);
    
    // Create service
    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: args.name || name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 80,
          targetPort: 3080,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);
    
    // Create ingress if enabled
    if (args.ingress?.enabled) {
      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: args.name || name,
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
                pathType: "Prefix",
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
      configMap: this.configMap,
      pvc: this.pvc,
      ingress: this.ingress,
    });
  }
  
  /**
   * Generate default LibreChat configuration
   */
  private generateDefaultConfig(args: LibreChatArgs): any {
    return pulumi.all([
      args.providers,
      args.services,
      args.ragApi,
      args.providers?.customProviders,
    ]).apply(([providers, services, ragApi, customProviders]) => {
      const config: any = {
        version: "1.2.8",
        cache: true,
        fileStrategy: args.storage?.type || "local",
        
        fileConfig: {
          serverFileSizeLimit: 100,
          avatarSizeLimit: 5,
          clientImageResize: {
            enabled: true,
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.8,
            compressFormat: "jpeg",
          },
        },
        
        rateLimits: {
          fileUploads: {
            userMax: 50,
            userWindowInMinutes: 60,
          },
          stt: {
            userMax: 100,
            userWindowInMinutes: 1,
          },
          tts: {
            userMax: 100,
            userWindowInMinutes: 1,
          },
        },
        
        interface: {
          modelSelect: true,
          parameters: true,
          sidePanel: true,
          presets: true,
          prompts: true,
          bookmarks: true,
          multiConvo: true,
          agents: true,
          webSearch: !!(services?.searxng),
          fileSearch: !!ragApi,
          temporaryChatRetention: 720,
        },
        
        endpoints: {},
      };
      
      // Configure speech if OpenAI is available
      if (providers?.openai) {
        config.speech = {
          stt: {
            openai: {
              url: "/v1/audio/transcriptions",
              model: providers.openai.stt?.model || "whisper-1",
              apiKey: "${OPENAI_API_KEY}",
            },
          },
          tts: {
            openai: {
              url: "/v1/audio/speech",
              model: providers.openai.tts?.model || "tts-1-hd",
              voices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
              apiKey: "${OPENAI_API_KEY}",
            },
          },
        };
        
        config.endpoints.openAI = {
          models: {
            default: providers.openai.models || ["gpt-4o", "gpt-4o-mini"],
          },
          titleModel: "gpt-4o-mini",
          streamRate: 25,
        };
      }
      
      // Configure Anthropic
      if (providers?.anthropic) {
        config.endpoints.anthropic = {
          models: {
            default: providers.anthropic.models || ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
          },
          titleModel: "claude-3-5-haiku-20241022",
        };
      }
      
      // Configure OpenRouter
      if (providers?.openrouter) {
        config.endpoints.custom = config.endpoints.custom || [];
        config.endpoints.custom.push({
          name: "OpenRouter",
          apiKey: "${OPENROUTER_API_KEY}",
          baseURL: "https://openrouter.ai/api/v1",
          models: {
            default: providers.openrouter.models || [],
          },
          titleModel: "openai/gpt-4o-mini",
        });
      }
      
      if (customProviders) {
        config.endpoints.custom = config.endpoints.custom || [];
        (customProviders as CustomProvider[]).forEach((provider, index) => {
          const customEndpoint: any = {
            name: provider.name,
            baseURL: provider.baseURL,
            models: {
              default: provider.models,
            },
          };
          
          if (provider.apiKey) {
            customEndpoint.apiKey = `\${CUSTOM_PROVIDER_${index}_API_KEY}`;
          }
          
          if (provider.titleModel) {
            customEndpoint.titleModel = provider.titleModel;
          }
          
          if (provider.additionalConfig) {
            Object.assign(customEndpoint, provider.additionalConfig);
          }
          
          config.endpoints.custom.push(customEndpoint);
        });
      }
      
      // Configure web search
      if (services?.searxng) {
        config.webSearch = {
          searchProvider: "searxng",
          searxngInstanceUrl: "${SEARXNG_URL}",
        };
        
        if (services.firecrawl) {
          config.webSearch.scraperType = "firecrawl";
          config.webSearch.firecrawlApiUrl = "${FIRECRAWL_URL}";
          config.webSearch.firecrawlApiKey = "${FIRECRAWL_API_KEY}";
        }
        
        if (providers?.jinaai) {
          config.webSearch.rerankerType = "jina";
          config.webSearch.jinaApiKey = "${JINAAI_API_KEY}";
        }
      }
      
      return config;
    });
  }
  
  /**
   * Get the URL for accessing LibreChat
   * @returns The internal cluster URL for LibreChat
   */
  public getUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}`;
  }
}
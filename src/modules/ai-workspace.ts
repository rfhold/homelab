import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { Valkey } from "../components/bitnami-valkey";
import { SearXNG } from "../components/searxng";
import { Firecrawl, FirecrawlProvider } from "../components/firecrawl";
import { MeilisearchComponent } from "../components/meilisearch";
import { LibreChatRag } from "../components/librechat-rag";
import { LibreChat } from "../components/librechat";
import { createValkeyConnectionString, createRedisConnectionString } from "../adapters/redis";
import { generateConnectionString } from "../adapters/mongodb";
import { PostgreSQLModule, PostgreSQLImplementation } from "./postgres";
import { MongoDBModule, MongoDBImplementation } from "./mongodb";
import { DOCKER_IMAGES } from "../docker-images";

export { FirecrawlProvider } from "../components/firecrawl";

export enum STTImplementation {
  SPEACHES = "speaches",
  OPENAI = "openai",
}

export enum TTSImplementation {
  SPEACHES = "speaches",
  OPENAI = "openai",
}

export interface AIWorkspaceModuleArgs {
  namespace: pulumi.Input<string>;

  searxng?: {
    enabled?: pulumi.Input<boolean>;
    replicas?: pulumi.Input<number>;
    baseUrl?: pulumi.Input<string>;
    instanceName?: pulumi.Input<string>;

    limiter?: {
      enabled?: pulumi.Input<boolean>;
    };

    search?: {
      safeSearch?: pulumi.Input<number>;
      autocomplete?: pulumi.Input<string>;
      favicon?: pulumi.Input<string>;
      formats?: pulumi.Input<string[]>;
    };

    ui?: {
      infiniteScroll?: pulumi.Input<boolean>;
      theme?: pulumi.Input<string>;
      style?: pulumi.Input<string>;
      hotkeys?: pulumi.Input<string>;
    };

    engines?: pulumi.Input<string[]>;

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
  };

  openai?: {
    enabled?: pulumi.Input<boolean>;
    apiKey: pulumi.Input<string>;
    models?: pulumi.Input<string[]>;
    stt?: {
      model?: pulumi.Input<string>;
    };
    tts?: {
      model?: pulumi.Input<string>;
      voice?: pulumi.Input<string>;
    };
  };

  openrouter?: {
    enabled?: pulumi.Input<boolean>;
    apiKey: pulumi.Input<string>;
    models?: pulumi.Input<string[]>;
  };

  jinaai?: {
    enabled?: pulumi.Input<boolean>;
    apiKey: pulumi.Input<string>;
  };

  anthropic?: {
    enabled?: pulumi.Input<boolean>;
    apiKey: pulumi.Input<string>;
    models?: pulumi.Input<string[]>;
  };

  firecrawl?: {
    enabled?: pulumi.Input<boolean>;
    replicas?: pulumi.Input<number>;
    provider: {
      type: pulumi.Input<FirecrawlProvider>;
      apiKey?: pulumi.Input<string>;
      model?: pulumi.Input<string>;
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
  };

  librechat?: {
    enabled?: pulumi.Input<boolean>;
    domain: pulumi.Input<string>;
    replicas?: pulumi.Input<number>;

    // STT/TTS configuration
    stt?: {
      implementation?: pulumi.Input<STTImplementation>;
    };
    tts?: {
      implementation?: pulumi.Input<TTSImplementation>;
    };

    // Storage configuration
    storage?: {
      type?: pulumi.Input<"local" | "s3">;
      size?: pulumi.Input<string>;  // For local storage
      s3?: {
        endpoint: pulumi.Input<string>;
        bucket: pulumi.Input<string>;
        accessKey: pulumi.Input<string>;
        secretKey: pulumi.Input<string>;
      };
    };

    // Meilisearch configuration
    meilisearch?: {
      /** Disable sync for multi-node setups */
      noSync?: pulumi.Input<boolean>;
    };

    // Resource limits
    resources?: {
      librechat?: {
        requests?: {
          memory?: pulumi.Input<string>;
          cpu?: pulumi.Input<string>;
        };
        limits?: {
          memory?: pulumi.Input<string>;
          cpu?: pulumi.Input<string>;
        };
      };
      rag?: {
        requests?: {
          memory?: pulumi.Input<string>;
          cpu?: pulumi.Input<string>;
        };
        limits?: {
          memory?: pulumi.Input<string>;
          cpu?: pulumi.Input<string>;
        };
      };
      meilisearch?: {
        requests?: {
          memory?: pulumi.Input<string>;
          cpu?: pulumi.Input<string>;
        };
        limits?: {
          memory?: pulumi.Input<string>;
          cpu?: pulumi.Input<string>;
        };
      };
      mongodbLibrechat?: {
        requests?: {
          memory?: pulumi.Input<string>;
          cpu?: pulumi.Input<string>;
        };
        limits?: {
          memory?: pulumi.Input<string>;
          cpu?: pulumi.Input<string>;
        };
      };
      postgresRagPgvector?: {
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

    // Ingress configuration
    ingress?: {
      enabled?: pulumi.Input<boolean>;
      className?: pulumi.Input<string>;
      annotations?: pulumi.Input<{ [key: string]: string }>;
      tls?: {
        enabled?: pulumi.Input<boolean>;
        secretName?: pulumi.Input<string>;
      };
    };
  };
}

export class AIWorkspaceModule extends pulumi.ComponentResource {
  private readonly valkey?: Valkey;
  private readonly firecrawlValkey?: Valkey;
  public readonly meilisearch?: MeilisearchComponent;
  public readonly searxng?: SearXNG;
  public readonly firecrawl?: Firecrawl;
  public readonly librechatMongodb?: MongoDBModule;
  public readonly ragPgvectorPostgres?: PostgreSQLModule;
  public readonly librechatRag?: LibreChatRag;
  public readonly librechat?: LibreChat;
  public readonly openaiConfig?: {
    apiKey: pulumi.Output<string>;
    models: pulumi.Output<string[]>;
    stt: {
      model: pulumi.Output<string>;
    };
    tts: {
      model: pulumi.Output<string>;
      voice: pulumi.Output<string>;
    };
  };
  public readonly openrouterConfig?: {
    apiKey: pulumi.Output<string>;
    models: pulumi.Output<string[]>;
  };
  public readonly jinaaiConfig?: {
    apiKey: pulumi.Output<string>;
  };
  public readonly anthropicConfig?: {
    apiKey: pulumi.Output<string>;
    models: pulumi.Output<string[]>;
  };

  constructor(name: string, args: AIWorkspaceModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:AIWorkspace", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    if (args.searxng?.enabled) {
      this.valkey = new Valkey(`${name}-searxng-cache`, {
        namespace: args.namespace,
        storage: {
          size: "2Gi",
        },
        memoryLimit: "256Mi",
        cpuLimit: "100m",
      }, defaultResourceOptions);

      const valkeyConfig = this.valkey.getConnectionConfig();
      const valkeyUrl = createValkeyConnectionString(valkeyConfig);

      this.searxng = new SearXNG(`${name}-searxng`, {
        namespace: args.namespace,
        baseUrl: args.searxng.baseUrl,
        instanceName: args.searxng.instanceName,
        limiter: args.searxng.limiter,
        search: args.searxng.search,
        ui: args.searxng.ui,
        valkey: {
          url: valkeyUrl,
        },
        engines: args.searxng.engines,
        resources: args.searxng.resources,
        ingress: args.searxng.ingress,
      }, {
        dependsOn: [this.valkey],
        ...defaultResourceOptions,
      });
    }

    if (args.openai?.enabled) {
      this.openaiConfig = {
        apiKey: pulumi.output(args.openai.apiKey),
        models: pulumi.output(args.openai.models ?? [
          "gpt-4o",
          "gpt-4o-mini",
          "o1",
          "o1-mini",
          "gpt-4-turbo"
        ]),
        stt: {
          model: pulumi.output(args.openai.stt?.model ?? "whisper-1"),
        },
        tts: {
          model: pulumi.output(args.openai.tts?.model ?? "tts-1-hd"),
          voice: pulumi.output(args.openai.tts?.voice ?? "alloy"),
        },
      };
    }

    if (args.openrouter?.enabled) {
      this.openrouterConfig = {
        apiKey: pulumi.output(args.openrouter.apiKey),
        models: pulumi.output(args.openrouter.models ?? [
          "openai/gpt-4o",
          "openai/gpt-4o-mini",
          "anthropic/claude-3.5-sonnet",
          "anthropic/claude-3.5-haiku",
          "google/gemini-pro-1.5",
          "meta-llama/llama-3.1-405b-instruct"
        ]),
      };
    }

    if (args.jinaai?.enabled) {
      this.jinaaiConfig = {
        apiKey: pulumi.output(args.jinaai.apiKey),
      };
    }

    if (args.anthropic?.enabled) {
      this.anthropicConfig = {
        apiKey: pulumi.output(args.anthropic.apiKey),
        models: pulumi.output(args.anthropic.models ?? [
          "claude-3-5-sonnet-20241022",
          "claude-3-5-haiku-20241022",
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-haiku-20240307"
        ]),
      };
    }

    if (args.firecrawl?.enabled) {
      this.firecrawlValkey = new Valkey(`${name}-firecrawl-cache`, {
        namespace: args.namespace,
        storage: {
          size: "4Gi",
        },
        memoryLimit: "512Mi",
        cpuLimit: "250m",
      }, defaultResourceOptions);

      const firecrawlValkeyConfig = this.firecrawlValkey.getConnectionConfig();
      const firecrawlRedisUrl = createRedisConnectionString(firecrawlValkeyConfig);

      const providerConfig = args.firecrawl.provider;

      const searxngEndpoint = this.searxng ?
        pulumi.interpolate`http://${this.searxng.service.metadata.name}:8080` :
        undefined;

      this.firecrawl = new Firecrawl(`${name}-firecrawl`, {
        namespace: args.namespace,
        redisUrl: firecrawlRedisUrl,
        replicas: args.firecrawl.replicas,
        provider: {
          type: providerConfig.type,
          apiKey: providerConfig.apiKey || (providerConfig.type === FirecrawlProvider.OPENAI && this.openaiConfig ? this.openaiConfig.apiKey : undefined),
          model: providerConfig.model,
          embeddingModel: providerConfig.embeddingModel,
        },
        resources: args.firecrawl.resources,
        proxy: args.firecrawl.proxy,
        searxng: searxngEndpoint ? {
          endpoint: searxngEndpoint,
        } : undefined,
        llamaparse: args.firecrawl.llamaparse,
        ingress: args.firecrawl.ingress,
      }, {
        dependsOn: [this.firecrawlValkey, ...(this.searxng ? [this.searxng] : [])],
        ...defaultResourceOptions,
      });
    }

    // LibreChat deployment
    if (args.librechat?.enabled) {
      // Generate security keys
      const meiliMasterKey = new random.RandomPassword(`${name}-meili-master-key`, {
        length: 32,
        special: true,
      }, defaultResourceOptions);

      // Deploy Meilisearch
      // For now, we'll assume namespace is always provided as a string from the stack
      // This is a temporary workaround until we update MeilisearchComponent to accept pulumi.Input<string>
      const namespaceStr = pulumi.output(args.namespace).apply(ns => ns as string);

      // Apply resource configuration if provided
      const meilisearchResources = args.librechat.resources?.meilisearch ? 
        pulumi.all([
          args.librechat.resources.meilisearch.requests?.memory,
          args.librechat.resources.meilisearch.requests?.cpu,
          args.librechat.resources.meilisearch.limits?.memory,
          args.librechat.resources.meilisearch.limits?.cpu,
        ]).apply(([reqMem, reqCpu, limMem, limCpu]) => ({
          requests: {
            memory: reqMem as string | undefined,
            cpu: reqCpu as string | undefined,
          },
          limits: {
            memory: limMem as string | undefined,
            cpu: limCpu as string | undefined,
          },
        })) : undefined;

      this.meilisearch = new MeilisearchComponent(`${name}-meilisearch`, {
        namespace: namespaceStr as any, // Type assertion needed due to interface mismatch
        masterKey: meiliMasterKey.result,
        environment: "production",
        storage: {
          size: "10Gi",
        },
        config: {
          logLevel: "INFO",
          noAnalytics: true,
          scheduleSnapshot: 86400, // Daily snapshots
        },
        resources: meilisearchResources as any,
      }, defaultResourceOptions);

      // MongoDB for LibreChat API
      this.librechatMongodb = new MongoDBModule(`${name}-librechat-mongodb`, {
        namespace: args.namespace,
        implementation: MongoDBImplementation.BASIC_MONGODB,
        auth: {
          database: "librechat",
          username: "librechat",
        },
        storage: {
          size: "10Gi",
        },
        resources: args.librechat.resources?.mongodbLibrechat ? {
          requests: {
            memory: args.librechat.resources.mongodbLibrechat.requests?.memory,
            cpu: args.librechat.resources.mongodbLibrechat.requests?.cpu,
          },
          limits: {
            memory: args.librechat.resources.mongodbLibrechat.limits?.memory,
            cpu: args.librechat.resources.mongodbLibrechat.limits?.cpu,
          },
        } : undefined,
      }, defaultResourceOptions);

      // PostgreSQL for RAG API (pgvector)
      this.ragPgvectorPostgres = new PostgreSQLModule(`${name}-rag-pgvector`, {
        namespace: args.namespace,
        implementation: PostgreSQLImplementation.BITNAMI_POSTGRESQL,
        image: DOCKER_IMAGES.BITNAMI_POSTGRES_PGVECTOR.image,
        auth: {
          database: "rag",
          username: "rag",
        },
        storage: {
          size: "20Gi",
        },
        resources: args.librechat.resources?.postgresRagPgvector ? {
          requests: {
            memory: args.librechat.resources.postgresRagPgvector.requests?.memory,
            cpu: args.librechat.resources.postgresRagPgvector.requests?.cpu,
          },
          limits: {
            memory: args.librechat.resources.postgresRagPgvector.limits?.memory,
            cpu: args.librechat.resources.postgresRagPgvector.limits?.cpu,
          },
        } : undefined,
      }, defaultResourceOptions);

      // Deploy LibreChat RAG API if OpenAI is configured
      if (this.openaiConfig) {
        const postgresConfig = this.ragPgvectorPostgres.getConnectionConfig();

        this.librechatRag = new LibreChatRag(`${name}-librechat-rag`, {
          namespace: args.namespace,
          database: {
            host: postgresConfig.host,
            port: postgresConfig.port,
            name: postgresConfig.database,
            adminPassword: postgresConfig.password,
          },
          openai: {
            apiKey: this.openaiConfig.apiKey,
          },
          vectorStore: {
            embeddingModel: "text-embedding-3-small",
            chunkSize: 1000,
            chunkOverlap: 200,
          },
          resources: args.librechat.resources?.rag,
        }, {
          dependsOn: [this.ragPgvectorPostgres],
          ...defaultResourceOptions,
        });
      }

      // Generate security keys for LibreChat
      const credsKey = new random.RandomPassword(`${name}-creds-key`, {
        length: 64,  // 32 bytes in hex
        special: false,
        upper: false,
      }, defaultResourceOptions);

      const credsIV = new random.RandomPassword(`${name}-creds-iv`, {
        length: 32,  // 16 bytes in hex
        special: false,
        upper: false,
      }, defaultResourceOptions);

      const jwtSecret = new random.RandomPassword(`${name}-jwt-secret`, {
        length: 32,
        special: true,
      }, defaultResourceOptions);

      const jwtRefreshSecret = new random.RandomPassword(`${name}-jwt-refresh-secret`, {
        length: 32,
        special: true,
      }, defaultResourceOptions);

      // Deploy LibreChat
      const mongodbConfig = this.librechatMongodb.getConnectionConfig();
      const mongodbUrl = generateConnectionString(mongodbConfig);

      this.librechat = new LibreChat(`${name}-librechat`, {
        namespace: args.namespace,
        domain: args.librechat.domain,
        replicas: args.librechat.replicas,
        database: {
          url: mongodbUrl,
        },
        meilisearch: {
          url: pulumi.interpolate`http://${this.meilisearch.service.metadata.name}:7700`,
          masterKey: meiliMasterKey.result,
          noSync: args.librechat.meilisearch?.noSync,
        },
        ragApi: this.librechatRag ? {
          url: this.librechatRag.getApiEndpoint(),
        } : undefined,
        storage: args.librechat.storage,
        security: {
          credsKey: credsKey.result,
          credsIV: credsIV.result,
          jwtSecret: jwtSecret.result,
          jwtRefreshSecret: jwtRefreshSecret.result,
        },
        providers: {
          openai: this.openaiConfig ? {
            apiKey: this.openaiConfig.apiKey,
            models: this.openaiConfig.models,
            stt: {
              model: this.openaiConfig.stt.model,
            },
            tts: {
              model: this.openaiConfig.tts.model,
              voice: this.openaiConfig.tts.voice,
            },
          } : undefined,
          anthropic: this.anthropicConfig ? {
            apiKey: this.anthropicConfig.apiKey,
            models: this.anthropicConfig.models,
          } : undefined,
          openrouter: this.openrouterConfig ? {
            apiKey: this.openrouterConfig.apiKey,
            models: this.openrouterConfig.models,
          } : undefined,
          jinaai: this.jinaaiConfig ? {
            apiKey: this.jinaaiConfig.apiKey,
          } : undefined,
        },
        services: {
          searxng: this.searxng ? pulumi.interpolate`http://${this.searxng.service.metadata.name}:8080` : undefined,
          searxngApiKey: pulumi.secret("placeholder-searxng-api-key"),
          firecrawl: this.firecrawl ? pulumi.interpolate`http://${this.firecrawl.apiService.metadata.name}:3002` : undefined,
          firecrawlApiKey: pulumi.secret("placeholder-firecrawl-api-key"),
        },
        resources: args.librechat.resources?.librechat,
        ingress: args.librechat.ingress,
        config: this.generateLibreChatConfig(args),
      }, {
        dependsOn: [
          this.meilisearch,
          this.librechatMongodb,
          ...(this.librechatRag ? [this.librechatRag] : []),
          ...(this.searxng ? [this.searxng] : []),
          ...(this.firecrawl ? [this.firecrawl] : []),
        ],
        ...defaultResourceOptions,
      });
    }

    this.registerOutputs({
      searxng: this.searxng,
      firecrawl: this.firecrawl,
      openaiConfig: this.openaiConfig,
      openrouterConfig: this.openrouterConfig,
      jinaaiConfig: this.jinaaiConfig,
      anthropicConfig: this.anthropicConfig,
      meilisearch: this.meilisearch,
      librechatMongodb: this.librechatMongodb,
      ragPgvectorPostgres: this.ragPgvectorPostgres,
      librechatRag: this.librechatRag,
      librechat: this.librechat,
    });
  }

  /**
   * Generate LibreChat configuration based on enabled services
   */
  private generateLibreChatConfig(args: AIWorkspaceModuleArgs): any {
    const config: any = {
      version: "1.2.8",
      cache: true,
      fileStrategy: args.librechat?.storage?.type || "local",

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
        webSearch: !!this.searxng,
        fileSearch: !!this.librechatRag,
        temporaryChatRetention: 720,
      },

      endpoints: {},

      speech: {
        speechTab: {
          speechToText: {
            engineSTT: "external",
            languageSTT: "English (US)",
          },
          textToSpeech: {
            engineTTS: "external",
            languageTTS: "en",
          },
        },
      },
    };

    // Configure speech based on implementation selection
    const sttImpl = args.librechat?.stt?.implementation || STTImplementation.OPENAI;
    const ttsImpl = args.librechat?.tts?.implementation || TTSImplementation.OPENAI;

    if (sttImpl === STTImplementation.OPENAI && this.openaiConfig) {
      config.speech = config.speech || {};
      config.speech.stt = {
        openai: {
          model: this.openaiConfig.stt.model,
          apiKey: "${OPENAI_API_KEY}",
        },
      };
    }

    if (ttsImpl === TTSImplementation.OPENAI && this.openaiConfig) {
      config.speech = config.speech || {};
      config.speech.tts = {
        openai: {
          model: this.openaiConfig.tts.model,
          voices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
          apiKey: "${OPENAI_API_KEY}",
        },
      };
    }

    // Configure model endpoints
    if (this.openaiConfig) {
      config.endpoints.openAI = {
        models: {
          default: this.openaiConfig.models,
        },
        titleModel: "gpt-4o-mini",
        streamRate: 25,
      };
    }

    if (this.anthropicConfig) {
      config.endpoints.anthropic = {
        models: {
          default: this.anthropicConfig.models,
        },
        titleModel: "claude-3-5-haiku-20241022",
      };
    }

    if (this.openrouterConfig) {
      config.endpoints.custom = config.endpoints.custom || [];
      config.endpoints.custom.push({
        name: "OpenRouter",
        apiKey: "${OPENROUTER_API_KEY}",
        baseURL: "https://openrouter.ai/api/v1",
        models: {
          default: this.openrouterConfig.models,
        },
        titleModel: "openai/gpt-4o-mini",
      });
    }

    // Configure web search if enabled
    if (this.searxng) {
      config.webSearch = {
        searchProvider: "searxng",
        searxngInstanceUrl: "${SEARXNG_URL}",
      };
    }

    if (this.firecrawl) {
      config.webSearch = config.webSearch || {};
      config.webSearch.scraperType = "firecrawl";
      config.webSearch.firecrawlApiUrl = "${FIRECRAWL_URL}";
      config.webSearch.firecrawlApiKey = "${FIRECRAWL_API_KEY}";
    }

    if (this.jinaaiConfig) {
      config.webSearch = config.webSearch || {};
      config.webSearch.rerankerType = "jina";
      config.webSearch.jinaApiKey = "${JINAAI_API_KEY}";
    }

    return config;
  }
}

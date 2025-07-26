import * as pulumi from "@pulumi/pulumi";
import { Valkey } from "../components/bitnami-valkey";
import { SearXNG } from "../components/searxng";
import { Firecrawl, FirecrawlProvider } from "../components/firecrawl";
import { createValkeyConnectionString, createRedisConnectionString } from "../adapters/redis";

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
    systemLimits?: {
      maxCpu?: pulumi.Input<number>;
      maxRam?: pulumi.Input<number>;
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
}

export class AIWorkspaceModule extends pulumi.ComponentResource {
  private readonly valkey?: Valkey;
  private readonly firecrawlValkey?: Valkey;
  public readonly searxng?: SearXNG;
  public readonly firecrawl?: Firecrawl;
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
        systemLimits: args.firecrawl.systemLimits,
        ingress: args.firecrawl.ingress,
      }, {
        dependsOn: [this.firecrawlValkey, ...(this.searxng ? [this.searxng] : [])],
        ...defaultResourceOptions,
      });
    }

    this.registerOutputs({
      searxng: this.searxng,
      firecrawl: this.firecrawl,
      openaiConfig: this.openaiConfig,
      openrouterConfig: this.openrouterConfig,
    });
  }
}

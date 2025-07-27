import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { AIWorkspaceModule, FirecrawlProvider } from "../../src/modules/ai-workspace";
import { getEnvironmentVariable } from "../../src/adapters/environment";

const config = new pulumi.Config();

const namespace = new k8s.core.v1.Namespace("ai-workspace", {
  metadata: {
    name: "ai-workspace",
  },
});

const openaiApiKey = config.getBoolean("openai.enabled") 
  ? getEnvironmentVariable(config.get("openai.apiKeyEnvVar") ?? "OPENAI_API_KEY")
  : pulumi.output("");

const openrouterApiKey = config.getBoolean("openrouter.enabled")
  ? getEnvironmentVariable(config.get("openrouter.apiKeyEnvVar") ?? "OPENROUTER_API_KEY")
  : pulumi.output("");

const jinaaiApiKey = config.getBoolean("jinaai.enabled")
  ? getEnvironmentVariable(config.get("jinaai.apiKeyEnvVar") ?? "JINA_AI_API_KEY")
  : pulumi.output("");

const anthropicApiKey = config.getBoolean("anthropic.enabled")
  ? getEnvironmentVariable(config.get("anthropic.apiKeyEnvVar") ?? "ANTHROPIC_API_KEY")
  : pulumi.output("");

const aiWorkspace = new AIWorkspaceModule("ai-workspace", {
  namespace: namespace.metadata.name,
  openai: config.getBoolean("openai.enabled") ? {
    enabled: true,
    apiKey: openaiApiKey,
    models: config.getObject<string[]>("openai.models"),
    stt: {
      model: config.get("openai.stt.model"),
    },
    tts: {
      model: config.get("openai.tts.model"),
      voice: config.get("openai.tts.voice"),
    },
  } : undefined,
  openrouter: config.getBoolean("openrouter.enabled") ? {
    enabled: true,
    apiKey: openrouterApiKey,
    models: config.getObject<string[]>("openrouter.models"),
  } : undefined,
  jinaai: config.getBoolean("jinaai.enabled") ? {
    enabled: true,
    apiKey: jinaaiApiKey,
  } : undefined,
  anthropic: config.getBoolean("anthropic.enabled") ? {
    enabled: true,
    apiKey: anthropicApiKey,
    models: config.getObject<string[]>("anthropic.models"),
  } : undefined,
  searxng: {
    enabled: config.getBoolean("searxng.enabled") ?? true,
    baseUrl: config.get("searxng.baseUrl"),
    instanceName: config.get("searxng.instanceName") ?? "SearXNG",
    limiter: {
      enabled: config.getBoolean("searxng.limiter.enabled") ?? false,
    },
    search: {
      safeSearch: config.getNumber("searxng.search.safeSearch") ?? 0,
      autocomplete: config.get("searxng.search.autocomplete") ?? "duckduckgo",
      favicon: config.get("searxng.search.favicon") ?? "duckduckgo",
      formats: config.getObject<string[]>("searxng.search.formats") ?? ["html", "csv", "json", "rss"],
    },
    ui: {
      infiniteScroll: config.getBoolean("searxng.ui.infiniteScroll") ?? true,
      theme: config.get("searxng.ui.theme") ?? "simple",
      style: config.get("searxng.ui.style") ?? "dark",
      hotkeys: config.get("searxng.ui.hotkeys") ?? "vim",
    },
    engines: config.getObject<string[]>("searxng.engines"),
    resources: {
      requests: {
        memory: config.get("searxng.resources.requests.memory") ?? "256Mi",
        cpu: config.get("searxng.resources.requests.cpu") ?? "100m",
      },
      limits: {
        memory: config.get("searxng.resources.limits.memory") ?? "512Mi",
        cpu: config.get("searxng.resources.limits.cpu") ?? "500m",
      },
    },
    ingress: {
      enabled: config.getBoolean("searxng.ingress.enabled") ?? false,
      className: config.get("searxng.ingress.className"),
      host: config.require("searxng.ingress.host"),
      annotations: config.getObject<{[key: string]: string}>("searxng.ingress.annotations"),
      tls: {
        enabled: config.getBoolean("searxng.ingress.tls.enabled") ?? false,
        secretName: config.get("searxng.ingress.tls.secretName"),
      },
    },
  },
  firecrawl: config.getBoolean("firecrawl.enabled") ? {
    enabled: true,
    replicas: config.getNumber("firecrawl.replicas") ?? 1,
    provider: {
      type: config.get("firecrawl.provider.type") as FirecrawlProvider ?? FirecrawlProvider.OPENAI,
      apiKey: config.get("firecrawl.provider.apiKey"),
      model: config.get("firecrawl.provider.model") ?? "gpt-4o-mini",
      embeddingModel: config.get("firecrawl.provider.embeddingModel") ?? "text-embedding-3-small",
    },
    resources: {
      api: {
        requests: {
          memory: config.get("firecrawl.resources.api.requests.memory") ?? "256Mi",
          cpu: config.get("firecrawl.resources.api.requests.cpu") ?? "100m",
        },
        limits: {
          memory: config.get("firecrawl.resources.api.limits.memory") ?? "512Mi",
          cpu: config.get("firecrawl.resources.api.limits.cpu") ?? "500m",
        },
      },
      worker: {
        requests: {
          memory: config.get("firecrawl.resources.worker.requests.memory") ?? "2Gi",
          cpu: config.get("firecrawl.resources.worker.requests.cpu") ?? "500m",
        },
        limits: {
          memory: config.get("firecrawl.resources.worker.limits.memory") ?? "4Gi",
          cpu: config.get("firecrawl.resources.worker.limits.cpu") ?? "1000m",
        },
      },
      playwright: {
        requests: {
          memory: config.get("firecrawl.resources.playwright.requests.memory") ?? "512Mi",
          cpu: config.get("firecrawl.resources.playwright.requests.cpu") ?? "250m",
        },
        limits: {
          memory: config.get("firecrawl.resources.playwright.limits.memory") ?? "2Gi",
          cpu: config.get("firecrawl.resources.playwright.limits.cpu") ?? "1000m",
        },
      },
    },
    proxy: config.getObject("firecrawl.proxy"),
    llamaparse: config.getObject("firecrawl.llamaparse"),
    ingress: {
      enabled: config.getBoolean("firecrawl.ingress.enabled") ?? false,
      className: config.get("firecrawl.ingress.className"),
      host: config.get("firecrawl.ingress.host") ?? "",
      annotations: config.getObject<{[key: string]: string}>("firecrawl.ingress.annotations"),
      tls: {
        enabled: config.getBoolean("firecrawl.ingress.tls.enabled") ?? false,
        secretName: config.get("firecrawl.ingress.tls.secretName"),
      },
    },
  } : undefined,
  librechat: config.getBoolean("librechat.enabled") ? {
    enabled: true,
    domain: config.require("librechat.domain"),
    replicas: config.getNumber("librechat.replicas") ?? 1,
    resources: {
      meilisearch: {
        requests: {
          memory: config.get("librechat.resources.meilisearch.requests.memory") ?? "512Mi",
          cpu: config.get("librechat.resources.meilisearch.requests.cpu") ?? "100m",
        },
        limits: {
          memory: config.get("librechat.resources.meilisearch.limits.memory") ?? "2Gi",
          cpu: config.get("librechat.resources.meilisearch.limits.cpu") ?? "1000m",
        },
      },
      mongodbLibrechat: {
        requests: {
          memory: config.get("librechat.resources.mongodbLibrechat.requests.memory") ?? "256Mi",
          cpu: config.get("librechat.resources.mongodbLibrechat.requests.cpu") ?? "100m",
        },
        limits: {
          memory: config.get("librechat.resources.mongodbLibrechat.limits.memory") ?? "512Mi",
          cpu: config.get("librechat.resources.mongodbLibrechat.limits.cpu") ?? "500m",
        },
      },
      postgresRagPgvector: {
        requests: {
          memory: config.get("librechat.resources.postgresRagPgvector.requests.memory") ?? "512Mi",
          cpu: config.get("librechat.resources.postgresRagPgvector.requests.cpu") ?? "200m",
        },
        limits: {
          memory: config.get("librechat.resources.postgresRagPgvector.limits.memory") ?? "1Gi",
          cpu: config.get("librechat.resources.postgresRagPgvector.limits.cpu") ?? "1000m",
        },
      },
      rag: {
        requests: {
          memory: config.get("librechat.resources.rag.requests.memory") ?? "512Mi",
          cpu: config.get("librechat.resources.rag.requests.cpu") ?? "250m",
        },
        limits: {
          memory: config.get("librechat.resources.rag.limits.memory") ?? "2Gi",
          cpu: config.get("librechat.resources.rag.limits.cpu") ?? "1000m",
        },
      },
    },
  } : undefined,
});

export const namespaceName = namespace.metadata.name;
export const searxngService = aiWorkspace.searxng?.service.metadata.name;
export const firecrawlApiService = aiWorkspace.firecrawl?.apiService.metadata.name;
export const firecrawlApiEndpoint = aiWorkspace.firecrawl?.getApiEndpoint();
export const openaiEnabled = aiWorkspace.openaiConfig !== undefined;
export const openaiModels = aiWorkspace.openaiConfig?.models;
export const openaiKey = openaiApiKey;
export const openrouterEnabled = aiWorkspace.openrouterConfig !== undefined;
export const openrouterModels = aiWorkspace.openrouterConfig?.models;
export const openrouterKey = openrouterApiKey;
export const jinaaiEnabled = aiWorkspace.jinaaiConfig !== undefined;
export const jinaaiKey = jinaaiApiKey;
export const anthropicEnabled = aiWorkspace.anthropicConfig !== undefined;
export const anthropicModels = aiWorkspace.anthropicConfig?.models;
export const anthropicKey = anthropicApiKey;
export const meilisearchService = aiWorkspace.meilisearch?.service.metadata.name;
export const meilisearchUrl = aiWorkspace.meilisearch?.url;
export const librechatMongodbConfig = aiWorkspace.librechatMongodb?.getConnectionConfig();
export const librechatMongodbPassword = aiWorkspace.librechatMongodb?.getPassword();
export const ragPgvectorPostgresConfig = aiWorkspace.ragPgvectorPostgres?.getConnectionConfig();
export const ragPgvectorPostgresPassword = aiWorkspace.ragPgvectorPostgres?.getPassword();
export const librechatRagService = aiWorkspace.librechatRag?.service.metadata.name;
export const librechatRagEndpoint = aiWorkspace.librechatRag?.getApiEndpoint();
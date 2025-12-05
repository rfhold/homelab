import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { FirecrawlModule } from "../../src/modules/firecrawl";

interface ResourceConfig {
  requests?: {
    memory?: string;
    cpu?: string;
  };
  limits?: {
    memory?: string;
    cpu?: string;
  };
}

interface RedisConfig {
  storageSize?: string;
  storageClass?: string;
  resources?: ResourceConfig;
  tolerations?: TolerationConfig[];
  nodeSelector?: { [key: string]: string };
}

interface PostgresConfig {
  resources?: ResourceConfig;
}

interface AppConfig {
  resources?: {
    api?: ResourceConfig;
    playwright?: ResourceConfig;
    nuq?: ResourceConfig;
  };
  httpRoute?: {
    enabled: boolean;
    hostname: string;
    gatewayRef: {
      name: string;
      namespace: string;
    };
    requestTimeout?: string;
  };
  tolerations?: TolerationConfig[];
  nodeSelector?: { [key: string]: string };
}

interface SearxngConfig {
  endpoint: string;
  engines?: string;
  categories?: string;
}

interface TolerationConfig {
  key: string;
  operator: string;
  value?: string;
  effect: string;
}

interface AIConfig {
  baseUrl: string;
  modelName?: string;
  embeddingModelName?: string;
}

const config = new pulumi.Config();

export const namespaceName = config.get("namespace") ?? "firecrawl";
const domain = config.get("domain");

const redisConfig = config.getObject<RedisConfig>("redis");
const postgresConfig = config.getObject<PostgresConfig>("postgres");
const appConfig = config.getObject<AppConfig>("app");
const searxngConfig = config.getObject<SearxngConfig>("searxng");
const aiConfig = config.getObject<AIConfig>("ai");
const aiApiKey = config.getSecret("aiApiKey");

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const firecrawl = new FirecrawlModule("firecrawl", {
  namespace: namespace.metadata.name,
  redis: {
    storage: {
      size: redisConfig?.storageSize ?? "4Gi",
      storageClass: redisConfig?.storageClass,
    },
    resources: redisConfig?.resources,
    tolerations: redisConfig?.tolerations,
    nodeSelector: redisConfig?.nodeSelector,
  },
  postgres: {
    resources: postgresConfig?.resources,
  },
  app: {
    resources: appConfig?.resources,
    searxng: searxngConfig ? {
      endpoint: searxngConfig.endpoint,
      engines: searxngConfig.engines,
      categories: searxngConfig.categories,
    } : undefined,
    ai: aiConfig && aiApiKey ? {
      baseUrl: aiConfig.baseUrl,
      apiKey: aiApiKey,
      modelName: aiConfig.modelName,
      embeddingModelName: aiConfig.embeddingModelName,
    } : undefined,
    httpRoute: appConfig?.httpRoute && domain ? {
      enabled: appConfig.httpRoute.enabled,
      hostname: domain,
      gatewayRef: appConfig.httpRoute.gatewayRef,
      requestTimeout: appConfig.httpRoute.requestTimeout,
    } : undefined,
    tolerations: appConfig?.tolerations,
    nodeSelector: appConfig?.nodeSelector,
  },
}, { dependsOn: [namespace] });

export const apiUrl = firecrawl.getApiUrl();
export const apiServiceName = firecrawl.getApiServiceName();

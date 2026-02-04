import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { SearXNG, SearXNGArgs } from "../../src/components/searxng";
import { RedisModule, RedisImplementation } from "../../src/modules/redis-cache";
import { createRedisConnectionString } from "../../src/adapters/redis";

const config = new pulumi.Config();
const searxngConfig = config.requireObject<{
  enabled: boolean;
  instanceName?: string;
  baseUrl?: string;
  limiter?: {
    enabled: boolean;
  };
  search?: {
    safeSearch?: number;
    autocomplete?: string;
    formats?: string[];
  };
  ui?: {
    infiniteScroll?: boolean;
    theme?: string;
    style?: string;
    hotkeys?: string;
  };
  engines?: string[];
  customEngines?: {
    name: string;
    engine: string;
    shortcut: string;
    base_url?: string;
    search_url?: string;
    results_xpath?: string;
    url_xpath?: string;
    title_xpath?: string;
    content_xpath?: string;
    url_prefix?: string;
    timeout?: number;
    disabled?: boolean;
    categories?: string;
    soft_max_redirects?: number;
  }[];
  resources?: {
    requests?: {
      memory?: string;
      cpu?: string;
    };
    limits?: {
      memory?: string;
      cpu?: string;
    };
  };
  ingress?: {
    enabled?: boolean;
    className?: string;
    tls?: {
      enabled?: boolean;
      secretName?: string;
    };
  };
}>("searxng");

const namespace = new k8s.core.v1.Namespace("searxng", {
  metadata: {
    name: "searxng",
  },
});

let searxngService: SearXNG | undefined;

if (searxngConfig.enabled) {
  const cache = new RedisModule("searxng-cache", {
    namespace: "searxng",
    implementation: RedisImplementation.VALKEY,
    storage: {
      size: "1Gi",
      storageClass: "shared-fs",
    },
    resources: {
      requests: { memory: "128Mi", cpu: "100m" },
      limits: { memory: "256Mi", cpu: "500m" },
    },
  });

  const cacheConfig = cache.getConnectionConfig();
  const valkeyUrl = createRedisConnectionString(cacheConfig);

  const searxngArgs: SearXNGArgs = {
    namespace: namespace.metadata.name,
    instanceName: searxngConfig.instanceName,
    baseUrl: searxngConfig.baseUrl
      ? `https://${searxngConfig.baseUrl}`
      : undefined,
    limiter: searxngConfig.limiter,
    search: searxngConfig.search,
    ui: searxngConfig.ui,
    valkey: {
      url: valkeyUrl,
    },
    engines: searxngConfig.engines,
    customEngines: searxngConfig.customEngines,
    resources: searxngConfig.resources,
  };

  if (searxngConfig.ingress?.enabled && searxngConfig.baseUrl) {
    searxngArgs.ingress = {
      enabled: true,
      className: searxngConfig.ingress.className,
      host: searxngConfig.baseUrl,
      tls: searxngConfig.ingress.tls?.enabled
        ? {
            enabled: true,
            secretName: searxngConfig.ingress.tls.secretName,
          }
        : undefined,
    };
  }

  searxngService = new SearXNG("searxng", searxngArgs);
}

export const searxngInternalUrl = searxngService
  ? pulumi.interpolate`http://${searxngService.service.metadata.name}.${namespace.metadata.name}.svc.cluster.local:8080`
  : undefined;

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { MeilisearchComponent } from "../../src/components/meilisearch";

type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE" | "OFF";

const config = new pulumi.Config();
const meilisearchConfig = config.requireObject<{
  enabled: boolean;
  environment?: "production" | "development";
  storage?: {
    size?: string;
    storageClass?: string;
  };
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
  config?: {
    maxIndexingMemory?: string;
    maxIndexingThreads?: number;
    logLevel?: LogLevel;
  };
  ingress?: {
    enabled?: boolean;
    className?: string;
    host?: string;
    tls?: {
      enabled?: boolean;
      secretName?: string;
    };
  };
}>("meilisearch");

const namespace = new k8s.core.v1.Namespace("meilisearch", {
  metadata: {
    name: "meilisearch",
  },
});

let meilisearch: MeilisearchComponent | undefined;

if (meilisearchConfig.enabled) {
  meilisearch = new MeilisearchComponent("meilisearch", {
    namespace: "meilisearch",
    environment: meilisearchConfig.environment || "production",
    storage: meilisearchConfig.storage,
    resources: meilisearchConfig.resources,
    config: meilisearchConfig.config,
    ingress: meilisearchConfig.ingress?.host
      ? {
          enabled: meilisearchConfig.ingress.enabled,
          className: meilisearchConfig.ingress.className,
          host: meilisearchConfig.ingress.host,
          annotations: meilisearchConfig.ingress.tls?.enabled
            ? { "cert-manager.io/cluster-issuer": "letsencrypt-prod" }
            : undefined,
          tls: meilisearchConfig.ingress.tls,
        }
      : undefined,
  });
}

export const meilisearchUrl = meilisearch?.url;
export const meilisearchMasterKey = meilisearch?.masterKey;
export const meilisearchInternalUrl = meilisearch
  ? pulumi.interpolate`http://${meilisearch.service.metadata.name}.meilisearch.svc.cluster.local:7700`
  : undefined;

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

import { AuthentikOIDCApp } from "../../src/components/authentik-oidc-app";
import { LobeChatModule, ObjectStorageImplementation } from "../../src/modules/lobechat";

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

interface DatabaseConfig {
  storageSize?: string;
  storageClass?: string;
  resources?: ResourceConfig;
  tolerations?: TolerationConfig[];
  nodeSelector?: { [key: string]: string };
}

interface ObjectStorageConfig {
  cluster: string;
  storageClassName: string;
  endpoint: string;
  userNamespace?: string;
}

interface IngressConfig {
  enabled: boolean;
  className: string;
  annotations?: { [key: string]: string };
  tls?: {
    enabled: boolean;
    secretName?: string;
  };
}

interface TolerationConfig {
  key: string;
  operator: string;
  value?: string;
  effect: string;
}

interface AppConfig {
  resources?: ResourceConfig;
  replicas?: number;
  ingress?: IngressConfig;
  tolerations?: TolerationConfig[];
  nodeSelector?: { [key: string]: string };
}

interface AuthConfig {
  domain: string;
}

interface SearchConfig {
  providers: string[];
  searxng?: {
    url: string;
  };
  firecrawl?: {
    url: string;
    apiKey: string;
  };
  crawlerImpls?: string[];
}

const config = new pulumi.Config();

export const namespaceName = config.get("namespace") ?? "lobechat";
const domain = config.require("domain");

const databaseConfig = config.getObject<DatabaseConfig>("database");
const objectStorageConfig = config.requireObject<ObjectStorageConfig>("objectStorage");
const appConfig = config.getObject<AppConfig>("app");
const authConfig = config.requireObject<AuthConfig>("auth");
const searchConfig = config.getObject<SearchConfig>("search");

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const lobechatAuth = new AuthentikOIDCApp("lobechat", {
  name: "LobeChat",
  slug: "lobechat",
  redirectUri: `https://${domain}/api/auth/callback/authentik`,
  launchUrl: `https://${domain}`,
  group: "AI Tools",
});

const lobechat = new LobeChatModule("lobechat", {
  namespace: namespace.metadata.name,
  domain: domain,
  database: {
    storage: {
      size: databaseConfig?.storageSize ?? "10Gi",
      storageClass: databaseConfig?.storageClass,
    },
    resources: databaseConfig?.resources,
    tolerations: databaseConfig?.tolerations,
    nodeSelector: databaseConfig?.nodeSelector,
  },
  objectStorage: {
    implementation: ObjectStorageImplementation.CEPH,
    cluster: objectStorageConfig.cluster,
    storageClassName: objectStorageConfig.storageClassName,
    endpoint: objectStorageConfig.endpoint,
    userNamespace: objectStorageConfig.userNamespace,
  },
  auth: {
    oidc: {
      provider: "authentik",
      env: {
        AUTH_AUTHENTIK_ID: lobechatAuth.clientId,
        AUTH_AUTHENTIK_ISSUER: lobechatAuth.getIssuerUrl(authConfig.domain),
      },
      secrets: {
        AUTH_AUTHENTIK_SECRET: lobechatAuth.clientSecret,
      },
    },
  },
  app: {
    resources: appConfig?.resources,
    replicas: appConfig?.replicas,
    ingress: appConfig?.ingress,
    tolerations: appConfig?.tolerations,
    nodeSelector: appConfig?.nodeSelector,
  },
  search: searchConfig,
}, { dependsOn: [namespace] });

export const serviceUrl = lobechat.getServiceUrl();
export const authentikClientId = lobechatAuth.clientId;
export const authentikClientSecret = pulumi.secret(lobechatAuth.clientSecret);
export const authentikIssuerUrl = lobechatAuth.getIssuerUrl(authConfig.domain);

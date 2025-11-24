import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { AuthentikModule } from "../../src/modules/authentik";

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
}

interface AppConfig {
  resources?: {
    server?: ResourceConfig;
    worker?: ResourceConfig;
  };
  ingress?: {
    enabled?: boolean;
    className?: string;
    annotations?: Record<string, string>;
    host?: string;
    tls?: {
      enabled?: boolean;
      secretName?: string;
    };
  };
}

const config = new pulumi.Config();

export const namespaceName = config.get("namespace") ?? "authentik";

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const databaseConfig = config.getObject<DatabaseConfig>("database");
const appConfig = config.getObject<AppConfig>("app");

const authentik = new AuthentikModule("authentik", {
  namespace: namespace.metadata.name,
  database: {
    storage: {
      size: databaseConfig?.storageSize || "10Gi",
      storageClass: databaseConfig?.storageClass,
    },
    resources: databaseConfig?.resources,
  },
  app: {
    resources: appConfig?.resources,
    ingress: appConfig?.ingress,
  },
}, {
  dependsOn: [namespace],
});

export const databaseConnectionConfig = authentik.getDatabase().getConnectionConfig();
export const serviceUrl = authentik.getServiceUrl();
export const bootstrapToken = pulumi.secret(authentik.getBootstrapToken());
export const bootstrapPassword = pulumi.secret(authentik.getBootstrapPassword());

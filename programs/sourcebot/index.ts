import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import {
  SourcebotComponent,
  SourcebotConnection,
  SourcebotSettings,
  SourcebotExclude,
  SourcebotRevisions,
} from "../../src/components/sourcebot";
import { PostgreSQLModule, PostgreSQLImplementation } from "../../src/modules/postgres";
import { RedisModule, RedisImplementation } from "../../src/modules/redis-cache";
import { createConnectionString as createPostgresConnectionString } from "../../src/adapters/postgres";
import { createRedisConnectionString } from "../../src/adapters/redis";

interface SourcebotConfigConnection {
  type: "github" | "gitlab" | "gitea";
  url?: string;
  token?: string;
  orgs?: string[];
  users?: string[];
  repos?: string[];
  groups?: string[];
  projects?: string[];
  topics?: string[];
  all?: boolean;
  exclude?: SourcebotExclude;
  revisions?: SourcebotRevisions;
}

const config = new pulumi.Config();
const sourcebotConfig = config.requireObject<{
  enabled: boolean;
  database?: {
    implementation?: "cloudnative-pg" | "bitnami-postgresql";
    storage?: {
      size?: string;
      storageClass?: string;
    };
    resources?: {
      requests?: { memory?: string; cpu?: string };
      limits?: { memory?: string; cpu?: string };
    };
  };
  redis?: {
    implementation?: "valkey" | "bitnami-valkey";
    storage?: {
      size?: string;
      storageClass?: string;
    };
    resources?: {
      requests?: { memory?: string; cpu?: string };
      limits?: { memory?: string; cpu?: string };
    };
  };
  auth?: {
    secret?: string;
    url?: string;
    encryptionKey?: string;
  };
  connections?: { [name: string]: SourcebotConfigConnection };
  settings?: SourcebotSettings;
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
  ingress?: {
    enabled?: boolean;
    className?: string;
    host?: string;
    annotations?: { [key: string]: string };
    tls?: {
      enabled?: boolean;
      secretName?: string;
    };
  };
  telemetryDisabled?: boolean;
}>("sourcebot");

const namespace = new k8s.core.v1.Namespace("sourcebot", {
  metadata: {
    name: "sourcebot",
  },
});

let sourcebot: SourcebotComponent | undefined;

if (sourcebotConfig.enabled) {
  const dbImpl = sourcebotConfig.database?.implementation === "bitnami-postgresql"
    ? PostgreSQLImplementation.BITNAMI_POSTGRESQL
    : PostgreSQLImplementation.CLOUDNATIVE_PG;

  const database = new PostgreSQLModule("sourcebot-db", {
    namespace: "sourcebot",
    implementation: dbImpl,
    auth: {
      database: "sourcebot",
      username: "sourcebot",
    },
    storage: {
      size: sourcebotConfig.database?.storage?.size || "10Gi",
      storageClass: sourcebotConfig.database?.storage?.storageClass,
    },
    resources: sourcebotConfig.database?.resources,
  }, { dependsOn: [namespace] });

  const redisImpl = sourcebotConfig.redis?.implementation === "bitnami-valkey"
    ? RedisImplementation.BITNAMI_VALKEY
    : RedisImplementation.VALKEY;

  const redis = new RedisModule("sourcebot-redis", {
    namespace: "sourcebot",
    implementation: redisImpl,
    storage: {
      size: sourcebotConfig.redis?.storage?.size || "5Gi",
      storageClass: sourcebotConfig.redis?.storage?.storageClass,
    },
    resources: sourcebotConfig.redis?.resources,
    maxMemoryPolicy: "noeviction",
  }, { dependsOn: [namespace] });

  const dbConfig = database.getConnectionConfig();
  const redisConfig = redis.getConnectionConfig();

  const databaseUrl = createPostgresConnectionString(dbConfig);
  const redisUrl = createRedisConnectionString(redisConfig);

  let connections: { [name: string]: SourcebotConnection } | undefined;

  if (sourcebotConfig.connections) {
    connections = {};
    for (const [name, conn] of Object.entries(sourcebotConfig.connections)) {
      if (conn.type === "gitea") {
        connections[name] = {
          type: "gitea",
          url: conn.url!,
          token: conn.token,
          orgs: conn.orgs,
          users: conn.users,
          repos: conn.repos,
          exclude: conn.exclude,
          revisions: conn.revisions,
        };
      } else if (conn.type === "github") {
        connections[name] = {
          type: "github",
          url: conn.url,
          token: conn.token,
          orgs: conn.orgs,
          users: conn.users,
          repos: conn.repos,
          topics: conn.topics,
          exclude: conn.exclude,
          revisions: conn.revisions,
        };
      } else if (conn.type === "gitlab") {
        connections[name] = {
          type: "gitlab",
          url: conn.url,
          token: conn.token,
          all: conn.all,
          groups: conn.groups,
          users: conn.users,
          projects: conn.projects,
          topics: conn.topics,
          exclude: conn.exclude,
          revisions: conn.revisions,
        };
      }
    }
  }

  sourcebot = new SourcebotComponent("sourcebot", {
    namespace: "sourcebot",
    database: { url: databaseUrl },
    redis: { url: redisUrl },
    auth: sourcebotConfig.auth,
    connections,
    settings: sourcebotConfig.settings,
    storage: sourcebotConfig.storage,
    resources: sourcebotConfig.resources,
    ingress:
      sourcebotConfig.ingress?.enabled && sourcebotConfig.ingress.host
        ? {
            enabled: true,
            className: sourcebotConfig.ingress.className,
            host: sourcebotConfig.ingress.host,
            annotations: sourcebotConfig.ingress.annotations,
            tls: sourcebotConfig.ingress.tls,
          }
        : undefined,
    telemetryDisabled: sourcebotConfig.telemetryDisabled,
  }, { dependsOn: [database, redis] });
}

export const sourcebotUrl = sourcebot?.url;
export const sourcebotInternalUrl = sourcebot
  ? pulumi.interpolate`http://${sourcebot.service.metadata.name}.sourcebot.svc.cluster.local:3000`
  : undefined;

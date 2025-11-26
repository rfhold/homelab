import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { RedisModule, RedisImplementation } from "./redis-cache";
import { Firecrawl, FirecrawlResourceConfig } from "../components/firecrawl";
import { createRedisConnectionString } from "../adapters/redis";

interface ResourceConfig {
  requests?: {
    memory?: pulumi.Input<string>;
    cpu?: pulumi.Input<string>;
  };
  limits?: {
    memory?: pulumi.Input<string>;
    cpu?: pulumi.Input<string>;
  };
}

export interface FirecrawlModuleArgs {
  namespace: pulumi.Input<string>;

  redis?: {
    storage?: {
      size?: pulumi.Input<string>;
      storageClass?: pulumi.Input<string>;
    };
    resources?: ResourceConfig;
  };

  postgres?: {
    resources?: ResourceConfig;
  };

  app?: {
    resources?: {
      api?: FirecrawlResourceConfig;
      playwright?: FirecrawlResourceConfig;
    };

    searxng?: {
      endpoint: pulumi.Input<string>;
      engines?: pulumi.Input<string>;
      categories?: pulumi.Input<string>;
    };

    ai?: {
      baseUrl: pulumi.Input<string>;
      apiKey: pulumi.Input<string>;
      modelName?: pulumi.Input<string>;
      embeddingModelName?: pulumi.Input<string>;
    };

    httpRoute?: {
      enabled: boolean;
      hostname: pulumi.Input<string>;
      gatewayRef: {
        name: pulumi.Input<string>;
        namespace: pulumi.Input<string>;
      };
      requestTimeout?: pulumi.Input<string>;
    };

    image?: {
      api?: pulumi.Input<string>;
      playwright?: pulumi.Input<string>;
      nuqPostgres?: pulumi.Input<string>;
    };

    tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
    nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };
}

export class FirecrawlModule extends pulumi.ComponentResource {
  public readonly redis: RedisModule;
  public readonly app: Firecrawl;

  constructor(name: string, args: FirecrawlModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Firecrawl", name, args, opts);

    this.redis = new RedisModule(`${name}-redis`, {
      namespace: args.namespace,
      implementation: RedisImplementation.VALKEY,
      storage: args.redis?.storage,
      resources: args.redis?.resources,
      maxMemoryPolicy: "noeviction",
    }, { parent: this });

    const redisConfig = this.redis.getConnectionConfig();
    const redisUrl = createRedisConnectionString(redisConfig);

    this.app = new Firecrawl(name, {
      namespace: args.namespace,
      redis: {
        url: redisUrl,
      },
      postgres: args.postgres,
      searxng: args.app?.searxng,
      ai: args.app?.ai,
      resources: args.app?.resources,
      httpRoute: args.app?.httpRoute,
      image: args.app?.image,
      tolerations: args.app?.tolerations,
      nodeSelector: args.app?.nodeSelector,
    }, { parent: this, dependsOn: [this.redis] });

    this.registerOutputs({
      redis: this.redis,
      app: this.app,
    });
  }

  public getRedis(): RedisModule {
    return this.redis;
  }

  public getApp(): Firecrawl {
    return this.app;
  }

  public getApiUrl(): pulumi.Output<string> {
    return this.app.getApiUrl();
  }

  public getApiServiceName(): pulumi.Output<string> {
    return this.app.getApiServiceName();
  }
}

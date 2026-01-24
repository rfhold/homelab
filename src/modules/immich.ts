import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { PostgreSQLModule, PostgreSQLImplementation } from "./postgres";
import { RedisModule, RedisImplementation } from "./redis-cache";
import { Immich, ImmichMachineLearningArgs, ImmichServerArgs, ResourceArgs, TlsArgs } from "../components/immich";
import { DOCKER_IMAGES } from "../docker-images";

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

interface StorageConfig {
  size?: pulumi.Input<string>;
  storageClass?: pulumi.Input<string>;
}

export interface ImmichModuleArgs {
  namespace: pulumi.Input<string>;

  database?: {
    storage?: StorageConfig;
    resources?: ResourceConfig;
    tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
    nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };

  redis?: {
    storage?: StorageConfig;
    resources?: ResourceConfig;
    tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
    nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };

  app?: {
    libraryStorage?: StorageConfig;
    modelCacheStorage?: StorageConfig;

    machineLearning?: {
      enabled?: pulumi.Input<boolean>;
      replicas?: pulumi.Input<number>;
      requestThreads?: pulumi.Input<number>;
      modelInterOpThreads?: pulumi.Input<number>;
      modelIntraOpThreads?: pulumi.Input<number>;
      workers?: pulumi.Input<number>;
      modelTtl?: pulumi.Input<number>;
      preloadClipTextual?: pulumi.Input<string>;
      preloadClipVisual?: pulumi.Input<string>;
      preloadFacialRecognitionDetection?: pulumi.Input<string>;
      preloadFacialRecognitionRecognition?: pulumi.Input<string>;
      resources?: ResourceConfig;
      nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
      tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
    };

    server?: {
      replicas?: pulumi.Input<number>;
      resources?: ResourceConfig;
      nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
      tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
    };

    ingress?: {
      enabled?: boolean;
      className?: pulumi.Input<string>;
      annotations?: pulumi.Input<{ [key: string]: string }>;
      host: pulumi.Input<string>;
      tls?: {
        enabled?: boolean;
        secretName?: pulumi.Input<string>;
      };
    };

    imageTag?: pulumi.Input<string>;
    env?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };
}

export class ImmichModule extends pulumi.ComponentResource {
  public readonly database: PostgreSQLModule;
  public readonly redis: RedisModule;
  public readonly app: Immich;

  constructor(name: string, args: ImmichModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Immich", name, args, opts);

    this.database = new PostgreSQLModule(`${name}-postgres`, {
      namespace: args.namespace,
      implementation: PostgreSQLImplementation.CLOUDNATIVE_PG,
      storage: args.database?.storage,
      resources: args.database?.resources,
      image: DOCKER_IMAGES.VECTORCHORD.image,
      defaultDatabase: {
        name: "immich",
        extensions: [
          { name: "vector" },
        ],
      },
      enableSuperuserAccess: true,
      postgresql: {
        sharedPreloadLibraries: ["vchord"],
      },
      tolerations: args.database?.tolerations,
      nodeSelector: args.database?.nodeSelector,
    }, { parent: this });

    this.redis = new RedisModule(`${name}-redis`, {
      namespace: args.namespace,
      implementation: RedisImplementation.VALKEY,
      storage: args.redis?.storage,
      resources: args.redis?.resources,
      tolerations: args.redis?.tolerations,
      nodeSelector: args.redis?.nodeSelector,
    }, { parent: this });

    const dbConfig = this.database.getSuperuserConnectionConfig() ?? this.database.getConnectionConfig();
    const redisConfig = this.redis.getConnectionConfig();

    this.app = new Immich(name, {
      namespace: args.namespace,
      postgresql: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        username: dbConfig.username,
        password: dbConfig.password,
      },
      redis: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
      },
      libraryStorage: args.app?.libraryStorage ? {
        size: args.app.libraryStorage.size || "100Gi",
        storageClass: args.app.libraryStorage.storageClass,
      } : undefined,
      modelCacheStorage: args.app?.modelCacheStorage ? {
        size: args.app.modelCacheStorage.size || "10Gi",
        storageClass: args.app.modelCacheStorage.storageClass,
      } : undefined,
      machineLearning: args.app?.machineLearning,
      server: args.app?.server,
      ingress: args.app?.ingress ? {
        enabled: args.app.ingress.enabled,
        className: args.app.ingress.className,
        host: args.app.ingress.host,
        annotations: args.app.ingress.annotations,
        tls: args.app.ingress.tls ? {
          enabled: args.app.ingress.tls.enabled,
          secretName: args.app.ingress.tls.secretName,
        } : undefined,
      } : undefined,
      imageTag: args.app?.imageTag,
      env: args.app?.env,
    }, { parent: this, dependsOn: [this.database, this.redis] });

    this.registerOutputs({
      database: this.database,
      redis: this.redis,
      app: this.app,
    });
  }

  public getDatabase(): PostgreSQLModule {
    return this.database;
  }

  public getRedis(): RedisModule {
    return this.redis;
  }

  public getApp(): Immich {
    return this.app;
  }

  public getIngressUrl(): pulumi.Output<string> | undefined {
    return this.app.getIngressUrl();
  }

  public getServerUrl(namespace: pulumi.Input<string>): pulumi.Output<string> {
    return this.app.getServerUrl(namespace);
  }

  public getMachineLearningUrl(namespace: pulumi.Input<string>): pulumi.Output<string> {
    return this.app.getMachineLearningUrl(namespace);
  }
}

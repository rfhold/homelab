import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import * as k8s from "@pulumi/kubernetes";
import { PostgreSQLModule, PostgreSQLImplementation } from "./postgres";
import { RookCephObjectStoreUser } from "../components/rook-ceph-object-store-user";
import { RookCephBucket } from "../components/rook-ceph-bucket";
import { LobeChat, LobeChatOIDCProvider, LobeChatSearchConfig } from "../components/lobechat";

export enum ObjectStorageImplementation {
  CEPH = "ceph",
}

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

export interface LobeChatModuleArgs {
  namespace: pulumi.Input<string>;

  domain: pulumi.Input<string>;

  database?: {
    storage?: {
      size?: pulumi.Input<string>;
      storageClass?: pulumi.Input<string>;
    };
    resources?: ResourceConfig;
  };

  objectStorage: {
    implementation: ObjectStorageImplementation;
    cluster: pulumi.Input<string>;
    storageClassName: pulumi.Input<string>;
    endpoint: pulumi.Input<string>;
    userNamespace?: pulumi.Input<string>;
  };

  auth: {
    oidc: LobeChatOIDCProvider;
  };

  app?: {
    resources?: ResourceConfig;
    replicas?: pulumi.Input<number>;
    ingress?: {
      enabled?: boolean;
      className?: pulumi.Input<string>;
      annotations?: { [key: string]: string };
      tls?: {
        enabled?: boolean;
        secretName?: pulumi.Input<string>;
      };
    };
    tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
    nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };

  search?: LobeChatSearchConfig;
}

export class LobeChatModule extends pulumi.ComponentResource {
  public readonly database: PostgreSQLModule;
  public readonly app: LobeChat;

  private readonly s3User?: RookCephObjectStoreUser;
  private readonly s3Bucket?: RookCephBucket;
  private readonly keyVaultsSecret: pulumi.Output<string>;
  private readonly nextAuthSecret: pulumi.Output<string>;

  constructor(name: string, args: LobeChatModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:LobeChat", name, args, opts);

    this.database = new PostgreSQLModule(`${name}-postgres`, {
      namespace: args.namespace,
      implementation: PostgreSQLImplementation.CLOUDNATIVE_PG,
      storage: args.database?.storage,
      resources: args.database?.resources,
      defaultDatabase: {
        name: "lobechat",
        extensions: [{ name: "vector" }],
      },
      enableSuperuserAccess: true,
    }, { parent: this });

    const dbConfig = this.database.getSuperuserConnectionConfig() ?? this.database.getConnectionConfig();

    this.keyVaultsSecret = new random.RandomPassword(`${name}-key-vaults-secret`, {
      length: 32,
      special: false,
    }, { parent: this }).result;

    this.nextAuthSecret = new random.RandomPassword(`${name}-next-auth-secret`, {
      length: 32,
      special: false,
    }, { parent: this }).result;

    let s3Config: {
      endpoint: pulumi.Input<string>;
      bucket: pulumi.Input<string>;
      accessKeyId: pulumi.Input<string>;
      secretAccessKey: pulumi.Input<string>;
      publicDomain: pulumi.Input<string>;
      region?: pulumi.Input<string>;
      enablePathStyle?: pulumi.Input<boolean>;
      setAcl?: pulumi.Input<boolean>;
    };

    switch (args.objectStorage.implementation) {
      case ObjectStorageImplementation.CEPH:
        this.s3User = new RookCephObjectStoreUser(`${name}-s3-user`, {
          name: "lobechat",
          namespace: args.objectStorage.userNamespace ?? args.namespace,
          store: args.objectStorage.cluster,
          displayName: "lobechat",
        }, { parent: this });

        this.s3Bucket = new RookCephBucket(`${name}-s3-bucket`, {
          name: `${name}-files`,
          bucketName: "lobechat-files",
          namespace: args.namespace,
          storageClassName: args.objectStorage.storageClassName,
          writeUsers: ["lobechat"],
        }, { parent: this, dependsOn: [this.s3User] });

        s3Config = {
          endpoint: args.objectStorage.endpoint,
          bucket: this.s3Bucket.bucketName,
          accessKeyId: this.s3User.accessKey,
          secretAccessKey: this.s3User.secretKey,
          publicDomain: args.objectStorage.endpoint,
          region: "auto",
          enablePathStyle: true,
          setAcl: false,
        };
        break;

      default:
        throw new Error(`Unknown object storage implementation: ${args.objectStorage.implementation}`);
    }

    const databaseUrl = pulumi.interpolate`postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

    this.app = new LobeChat(name, {
      namespace: args.namespace,
      domain: args.domain,
      database: {
        url: databaseUrl,
        keyVaultsSecret: this.keyVaultsSecret,
      },
      s3: s3Config,
      auth: {
        secret: this.nextAuthSecret,
        oidc: args.auth.oidc,
      },
      resources: args.app?.resources,
      replicas: args.app?.replicas,
      ingress: args.app?.ingress ? {
        enabled: args.app.ingress.enabled,
        className: args.app.ingress.className,
        annotations: args.app.ingress.annotations,
        tls: args.app.ingress.tls,
      } : undefined,
      search: args.search,
      tolerations: args.app?.tolerations,
      nodeSelector: args.app?.nodeSelector,
    }, { parent: this, dependsOn: [this.database, ...(this.s3Bucket ? [this.s3Bucket] : [])] });

    this.registerOutputs({
      database: this.database,
      app: this.app,
      s3User: this.s3User,
      s3Bucket: this.s3Bucket,
    });
  }

  public getDatabase(): PostgreSQLModule {
    return this.database;
  }

  public getApp(): LobeChat {
    return this.app;
  }

  public getServiceUrl(): pulumi.Output<string> {
    return this.app.getServiceUrl();
  }

  public getKeyVaultsSecret(): pulumi.Output<string> {
    return this.keyVaultsSecret;
  }
}

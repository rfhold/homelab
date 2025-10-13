import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Vaultwarden } from "../components/vaultwarden";
import { StorageConfig } from "../adapters/storage";
import { PostgreSQLModule, PostgreSQLImplementation } from "./postgres";
import { createConnectionString } from "../adapters/postgres";

export enum BitwardenImplementation {
  VAULTWARDEN = "vaultwarden",
}

export interface BitwardenModuleArgs {
  namespace: pulumi.Input<string>;

  implementation: BitwardenImplementation;

  domain: pulumi.Input<string>;

  admin?: {
    token?: pulumi.Input<string>;
  };

  ingress?: {
    enabled?: boolean;
    className?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
    tls?: {
      enabled?: boolean;
      secretName?: pulumi.Input<string>;
    };
  };

  smtp?: {
    enabled?: boolean;
    host?: pulumi.Input<string>;
    from?: pulumi.Input<string>;
    fromName?: pulumi.Input<string>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    port?: pulumi.Input<number>;
    security?: "starttls" | "force_tls" | "off";
    acceptInvalidHostnames?: boolean;
    acceptInvalidCerts?: boolean;
  };

  storage?: {
    size?: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
  };

  database?: {
    implementation?: PostgreSQLImplementation;
    auth?: {
      database?: pulumi.Input<string>;
      username?: pulumi.Input<string>;
      password?: pulumi.Input<string>;
    };
    storage?: {
      size?: pulumi.Input<string>;
      storageClass?: pulumi.Input<string>;
    };
    resources?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
  };

  podAnnotations?: Record<string, pulumi.Input<string>>;

  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };
}

export class BitwardenModule extends pulumi.ComponentResource {
  public readonly instance: Vaultwarden;
  public readonly database?: PostgreSQLModule;

  constructor(name: string, args: BitwardenModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Bitwarden", name, args, opts);

    switch (args.implementation) {
      case BitwardenImplementation.VAULTWARDEN:
        const vaultwardenStorage: StorageConfig | undefined = args.storage ? {
          size: args.storage.size || "10Gi",
          storageClass: args.storage.storageClass,
          accessModes: ["ReadWriteOnce"],
        } : undefined;

        this.database = new PostgreSQLModule(`${name}-postgres`, {
          namespace: args.namespace,
          implementation: args.database?.implementation || PostgreSQLImplementation.BITNAMI_POSTGRESQL,
          auth: {
            database: args.database?.auth?.database || "vaultwarden",
            username: args.database?.auth?.username || "vaultwarden",
            password: args.database?.auth?.password,
          },
          storage: args.database?.storage ? {
            size: args.database.storage.size || "10Gi",
            storageClass: args.database.storage.storageClass || args.storage?.storageClass,
          } : undefined,
          resources: args.database?.resources,
        }, { parent: this });

        const dbConfig = this.database.getConnectionConfig();
        const connectionString = createConnectionString(dbConfig);

        const dbSecret = new k8s.core.v1.Secret(`${name}-db-creds`, {
          metadata: {
            namespace: args.namespace,
            name: `${name}-db-creds`,
          },
          stringData: {
            "secret-uri": connectionString,
          },
        }, { parent: this });

        this.instance = new Vaultwarden(`${name}-vaultwarden`, {
          namespace: args.namespace,
          domain: args.domain,

          adminToken: args.admin?.token,

          storage: vaultwardenStorage,

          externalDatabase: {
            existingSecret: {
              name: dbSecret.metadata.name,
              key: "secret-uri",
            },
          },

          smtp: args.smtp,

          ingress: {
            enabled: args.ingress?.enabled !== false,
            className: args.ingress?.className,
            annotations: args.ingress?.annotations,
            tls: args.ingress?.tls?.enabled !== false ? {
              secretName: args.ingress?.tls?.secretName || `${name}-tls`,
            } : undefined,
          },

          podAnnotations: args.podAnnotations,

          memoryRequest: args.resources?.requests?.memory,
          cpuRequest: args.resources?.requests?.cpu,
          memoryLimit: args.resources?.limits?.memory,
          cpuLimit: args.resources?.limits?.cpu,
        }, { parent: this, dependsOn: [this.database] });
        break;

      default:
        throw new Error(`Unknown Bitwarden implementation: ${args.implementation}`);
    }

    this.registerOutputs({
      instance: this.instance,
      database: this.database,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return this.instance.getServiceUrl();
  }

  public getAdminToken(): pulumi.Output<string> {
    return this.instance.getAdminToken();
  }

  public getAdminTokenHash(): pulumi.Output<string> {
    return this.instance.getAdminTokenHash();
  }

  public getPostgresPassword(): pulumi.Output<string> {
    return this.database?.getPassword() || this.instance.getPostgresPassword();
  }

  public getDatabase(): PostgreSQLModule | undefined {
    return this.database;
  }
}

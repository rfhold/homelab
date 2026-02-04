import * as pulumi from "@pulumi/pulumi";
import { Gitea } from "../components/gitea";
import { StorageConfig } from "../adapters/storage";

export enum GitImplementation {
  GITEA = "gitea",
}

export interface GitModuleArgs {
  namespace: pulumi.Input<string>;

  implementation: GitImplementation;

  domain: pulumi.Input<string>;

  admin?: {
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    email?: pulumi.Input<string>;
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

  ssh?: {
    enabled?: boolean;
    serviceType?: pulumi.Input<string>;
    loadBalancerIP?: pulumi.Input<string>;
    port?: pulumi.Input<number>;
    nodePort?: pulumi.Input<number>;
    annotations?: Record<string, pulumi.Input<string>>;
  };

  storage?: {
    size?: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
  };

  database?: {
    storage?: {
      size?: pulumi.Input<string>;
      storageClass?: pulumi.Input<string>;
    };
  };

  cache?: {
    storage?: {
      size?: pulumi.Input<string>;
      storageClass?: pulumi.Input<string>;
    };
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

  webhook?: {
    allowedHostList?: pulumi.Input<string>;
  };
}

export class GitModule extends pulumi.ComponentResource {
  public readonly instance: Gitea;

  constructor(name: string, args: GitModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Git", name, args, opts);

    const rootUrl = pulumi.interpolate`https://${args.domain}`;

    switch (args.implementation) {
      case GitImplementation.GITEA:
        const giteaStorage: StorageConfig | undefined = args.storage ? {
          size: args.storage.size || "50Gi",
          storageClass: args.storage.storageClass,
          accessModes: ["ReadWriteOnce"],
        } : undefined;

        const postgresStorage: StorageConfig | undefined = args.database?.storage ? {
          size: args.database.storage.size || "20Gi",
          storageClass: args.database.storage.storageClass || args.storage?.storageClass,
          accessModes: ["ReadWriteOnce"],
        } : undefined;

        const valkeyStorage: StorageConfig | undefined = args.cache?.storage ? {
          size: args.cache.storage.size || "5Gi",
          storageClass: args.cache.storage.storageClass || args.storage?.storageClass,
          accessModes: ["ReadWriteOnce"],
        } : undefined;

        this.instance = new Gitea(name, {
          namespace: args.namespace,
          domain: args.domain,
          rootUrl: rootUrl,

          adminUsername: args.admin?.username,
          adminPassword: args.admin?.password,
          adminEmail: args.admin?.email,

          storage: giteaStorage,

          postgresql: {
            enabled: true,
            storage: postgresStorage,
          },

          valkey: {
            enabled: true,
            storage: valkeyStorage,
          },

          ingress: {
            enabled: args.ingress?.enabled !== false,
            className: args.ingress?.className,
            annotations: args.ingress?.annotations,
            tls: args.ingress?.tls?.enabled !== false ? {
              secretName: args.ingress?.tls?.secretName || `${name}-tls`,
            } : undefined,
          },

          ssh: args.ssh,

          webhook: args.webhook,

          memoryRequest: args.resources?.requests?.memory,
          cpuRequest: args.resources?.requests?.cpu,
          memoryLimit: args.resources?.limits?.memory,
          cpuLimit: args.resources?.limits?.cpu,
        }, { parent: this });
        break;

      default:
        throw new Error(`Unknown Git implementation: ${args.implementation}`);
    }

    this.registerOutputs({
      instance: this.instance,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return this.instance.getServiceUrl();
  }

  public getAdminPassword(): pulumi.Output<string> {
    return this.instance.adminPassword.result;
  }

  public getPostgresPassword(): pulumi.Output<string> {
    return this.instance.postgresPassword.result;
  }

  public getValkeyPassword(): pulumi.Output<string> {
    return this.instance.valkeyPassword.result;
  }
}

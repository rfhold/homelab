import * as pulumi from "@pulumi/pulumi";
import { Forgejo } from "../components/forgejo";
import { CloudNativePGCluster } from "../components/cloudnative-pg-cluster";
import { ValkeyComponent } from "../components/valkey";

export interface GitModuleArgs {
  namespace: pulumi.Input<string>;

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

  migrations?: {
    allowedDomains?: pulumi.Input<string>;
  };
}

export class GitModule extends pulumi.ComponentResource {
  public readonly instance: Forgejo;

  constructor(name: string, args: GitModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Git", name, args, opts);

    const rootUrl = pulumi.interpolate`https://${args.domain}`;

    const cnpg = new CloudNativePGCluster(`${name}-postgres`, {
      namespace: args.namespace,
      defaultDatabase: { name: "forgejo" },
      storage: args.database?.storage ? {
        size: args.database.storage.size || "20Gi",
        storageClass: args.database.storage.storageClass,
      } : undefined,
    }, { parent: this });

    const valkey = new ValkeyComponent(`${name}-valkey`, {
      namespace: args.namespace,
      storage: args.cache?.storage ? {
        size: args.cache.storage.size || "5Gi",
        storageClass: args.cache.storage.storageClass,
        accessModes: ["ReadWriteOnce"],
      } : undefined,
    }, { parent: this });

    this.instance = new Forgejo(name, {
      namespace: args.namespace,
      domain: args.domain,
      rootUrl: rootUrl,

      adminUsername: args.admin?.username,
      adminPassword: args.admin?.password,
      adminEmail: args.admin?.email,

      postgresql: cnpg.getConnectionConfig(),
      redis: valkey.getConnectionConfig(),

      storage: args.storage ? {
        size: args.storage.size || "200Gi",
        storageClass: args.storage.storageClass,
        accessModes: ["ReadWriteOnce"],
      } : undefined,

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
      migrations: args.migrations,

      memoryRequest: args.resources?.requests?.memory,
      cpuRequest: args.resources?.requests?.cpu,
      memoryLimit: args.resources?.limits?.memory,
      cpuLimit: args.resources?.limits?.cpu,
    }, { parent: this, dependsOn: [cnpg, valkey] });

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
}

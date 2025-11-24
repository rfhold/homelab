import * as pulumi from "@pulumi/pulumi";
import { PostgreSQLModule, PostgreSQLImplementation } from "./postgres";
import { Authentik } from "../components/authentik";

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

export interface AuthentikModuleArgs {
  namespace: pulumi.Input<string>;

  database?: {
    storage?: {
      size?: pulumi.Input<string>;
      storageClass?: pulumi.Input<string>;
    };
    resources?: ResourceConfig;
  };

  app?: {
    resources?: {
      server?: ResourceConfig;
      worker?: ResourceConfig;
    };
    ingress?: {
      enabled?: boolean;
      className?: pulumi.Input<string>;
      annotations?: Record<string, pulumi.Input<string>>;
      host?: pulumi.Input<string>;
      tls?: {
        enabled?: boolean;
        secretName?: pulumi.Input<string>;
      };
    };
  };
}

export class AuthentikModule extends pulumi.ComponentResource {
  public readonly database: PostgreSQLModule;
  public readonly app: Authentik;

  constructor(name: string, args: AuthentikModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Authentik", name, args, opts);

    this.database = new PostgreSQLModule(`${name}-postgres`, {
      namespace: args.namespace,
      implementation: PostgreSQLImplementation.CLOUDNATIVE_PG,
      storage: args.database?.storage,
      resources: args.database?.resources,
      defaultDatabase: {
        name: "authentik",
        extensions: [{ name: "vector" }],
      },
    }, { parent: this });

    const dbConfig = this.database.getConnectionConfig();

    this.app = new Authentik(name, {
      namespace: args.namespace,
      postgresql: {
        host: dbConfig.host,
        port: dbConfig.port,
        name: dbConfig.database,
        user: dbConfig.username,
        password: dbConfig.password,
      },
      resources: args.app?.resources,
      ingress: args.app?.ingress ? {
        enabled: args.app.ingress.enabled,
        className: args.app.ingress.className,
        annotations: args.app.ingress.annotations,
        hostname: args.app.ingress.host,
        tls: args.app.ingress.tls ? {
          secretName: args.app.ingress.tls.secretName,
        } : undefined,
      } : undefined,
    }, { parent: this, dependsOn: [this.database] });

    this.registerOutputs({
      database: this.database,
      app: this.app,
    });
  }

  public getDatabase(): PostgreSQLModule {
    return this.database;
  }

  public getApp(): Authentik {
    return this.app;
  }

  public getServiceUrl(): pulumi.Output<string> {
    return this.app.getServiceUrl();
  }
}

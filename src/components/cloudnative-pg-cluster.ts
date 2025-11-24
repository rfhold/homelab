import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { PostgreSQLConfig } from "../adapters/postgres";

export interface DatabaseExtension {
  name: string;
  version?: string;
}

export interface DefaultDatabase {
  name: string;
  extensions?: DatabaseExtension[];
}

export interface CloudNativePGClusterArgs {
  namespace: pulumi.Input<string>;

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

  instances?: pulumi.Input<number>;

  defaultDatabase?: DefaultDatabase;
}

export class CloudNativePGCluster extends pulumi.ComponentResource {
  public readonly cluster: k8s.apiextensions.CustomResource;

  public readonly password: pulumi.Output<string>;

  private readonly connectionConfig: PostgreSQLConfig;

  public readonly database?: k8s.apiextensions.CustomResource;

  constructor(name: string, args: CloudNativePGClusterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CloudNativePGCluster", name, args, opts);

    this.cluster = new k8s.apiextensions.CustomResource(
      name,
      {
        apiVersion: "postgresql.cnpg.io/v1",
        kind: "Cluster",
        metadata: {
          name: name,
          namespace: args.namespace,
        },
        spec: {
          instances: args.instances ?? 1,
          storage: args.storage,
          resources: args.resources,
        },
      },
      { parent: this }
    );

    if (args.defaultDatabase) {
      this.database = new k8s.apiextensions.CustomResource(
        `${name}-db`,
        {
          apiVersion: "postgresql.cnpg.io/v1",
          kind: "Database",
          metadata: {
            name: `${name}-${args.defaultDatabase.name}`,
            namespace: args.namespace,
          },
          spec: {
            name: args.defaultDatabase.name,
            owner: "app",
            cluster: {
              name: name,
            },
            extensions: args.defaultDatabase.extensions?.map(ext => ({
              name: ext.name,
              ...(ext.version && { version: ext.version }),
              ensure: "present",
            })),
          },
        },
        { parent: this, dependsOn: [this.cluster] }
      );
    }

    const appSecretName = `${name}-app`;
    const appSecret = pulumi.all([args.namespace, this.cluster.id]).apply(
      ([namespace]) =>
        k8s.core.v1.Secret.get(
          `${name}-app-secret`,
          pulumi.interpolate`${namespace}/${appSecretName}`,
          { parent: this }
        )
    );

    this.password = appSecret.apply(s => s.data).apply(data =>
      Buffer.from(data["password"], "base64").toString("utf-8")
    );

    this.connectionConfig = {
      host: pulumi.interpolate`${name}-rw.${args.namespace}`,
      port: 5432,
      username: appSecret.apply(s => s.data).apply(data =>
        Buffer.from(data["username"], "base64").toString("utf-8")
      ),
      password: this.password,
      database: appSecret.apply(s => s.data).apply(data =>
        Buffer.from(data["dbname"], "base64").toString("utf-8")
      ),
      sslMode: "disable",
    };

    this.registerOutputs({
      cluster: this.cluster,
      password: this.password,
      ...(this.database && { database: this.database }),
    });
  }

  public getConnectionConfig(): PostgreSQLConfig {
    return {
      host: this.connectionConfig.host,
      port: this.connectionConfig.port,
      username: this.connectionConfig.username,
      password: this.connectionConfig.password,
      database: this.connectionConfig.database,
      sslMode: this.connectionConfig.sslMode,
    };
  }
}

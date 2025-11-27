import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { PostgreSQLConfig } from "../adapters/postgres";

export interface DatabaseExtension {
  name: string;
  version?: string;
}

export interface ImageVolumeExtension {
  name: string;
  image: string;
  dynamicLibraryPath?: string[];
  extensionControlPath?: string[];
}

export interface PostgreSQLServerConfig {
  sharedPreloadLibraries?: string[];
  extensions?: ImageVolumeExtension[];
}

export interface DefaultDatabase {
  name: string;
  extensions?: DatabaseExtension[];
}

export interface CloudNativePGClusterArgs {
  namespace: pulumi.Input<string>;

  version?: pulumi.Input<string>;

  image?: pulumi.Input<string>;

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

  enableSuperuserAccess?: pulumi.Input<boolean>;

  postgresql?: PostgreSQLServerConfig;
}

export class CloudNativePGCluster extends pulumi.ComponentResource {
  public readonly cluster: k8s.apiextensions.CustomResource;

  public readonly password: pulumi.Output<string>;

  private readonly connectionConfig: PostgreSQLConfig;

  public readonly database?: k8s.apiextensions.CustomResource;

  private readonly superuserConfig?: PostgreSQLConfig;

  constructor(name: string, args: CloudNativePGClusterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CloudNativePGCluster", name, args, opts);

    const postgresqlConfig = args.postgresql ? {
      postgresql: {
        ...(args.postgresql.sharedPreloadLibraries && {
          shared_preload_libraries: args.postgresql.sharedPreloadLibraries,
        }),
        ...(args.postgresql.extensions && {
          extensions: args.postgresql.extensions.map(ext => ({
            name: ext.name,
            image: {
              reference: ext.image,
            },
            ...(ext.dynamicLibraryPath && { dynamic_library_path: ext.dynamicLibraryPath }),
            ...(ext.extensionControlPath && { extension_control_path: ext.extensionControlPath }),
          })),
        }),
      },
    } : {};

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
          ...(args.image ? { imageName: args.image } : args.version ? { imageName: pulumi.interpolate`ghcr.io/cloudnative-pg/postgresql:${args.version}` } : {}),
          storage: args.storage,
          resources: args.resources,
          enableSuperuserAccess: args.enableSuperuserAccess ?? false,
          ...postgresqlConfig,
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

    if (args.enableSuperuserAccess) {
      const superuserSecretName = `${name}-superuser`;
      const superuserSecret = pulumi.all([args.namespace, this.cluster.id]).apply(
        ([namespace]) =>
          k8s.core.v1.Secret.get(
            `${name}-superuser-secret`,
            pulumi.interpolate`${namespace}/${superuserSecretName}`,
            { parent: this }
          )
      );

      this.superuserConfig = {
        host: pulumi.interpolate`${name}-rw.${args.namespace}`,
        port: 5432,
        username: superuserSecret.apply(s => s.data).apply(data =>
          Buffer.from(data["username"], "base64").toString("utf-8")
        ),
        password: superuserSecret.apply(s => s.data).apply(data =>
          Buffer.from(data["password"], "base64").toString("utf-8")
        ),
        database: args.defaultDatabase?.name ?? "postgres",
        sslMode: "disable",
      };
    }

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

  public getSuperuserConnectionConfig(): PostgreSQLConfig | undefined {
    if (!this.superuserConfig) {
      return undefined;
    }
    return {
      host: this.superuserConfig.host,
      port: this.superuserConfig.port,
      username: this.superuserConfig.username,
      password: this.superuserConfig.password,
      database: this.superuserConfig.database,
      sslMode: this.superuserConfig.sslMode,
    };
  }
}

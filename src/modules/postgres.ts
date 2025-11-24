import * as pulumi from "@pulumi/pulumi";
import { PostgreSQL } from "../components/bitnami-postgres";
import { CloudNativePGCluster, DefaultDatabase } from "../components/cloudnative-pg-cluster";
import { PostgreSQLConfig } from "../adapters/postgres";

/**
 * Available PostgreSQL implementations
 */
export enum PostgreSQLImplementation {
  BITNAMI_POSTGRESQL = "bitnami-postgresql",
  CLOUDNATIVE_PG = "cloudnative-pg",
}

/**
 * Configuration for the PostgreSQL module
 */
export interface PostgreSQLModuleArgs {
  /** Kubernetes namespace to deploy PostgreSQL into */
  namespace: pulumi.Input<string>;
  
  /** PostgreSQL implementation to use */
  implementation: PostgreSQLImplementation;
  
  /** Authentication configuration */
  auth?: {
    /** Custom password for PostgreSQL authentication (if not provided, a random one will be generated) */
    password?: pulumi.Input<string>;
    /** PostgreSQL username (defaults to 'postgres') */
    username?: pulumi.Input<string>;
    /** PostgreSQL database name (defaults to 'postgres') */
    database?: pulumi.Input<string>;
  };
  
  /** Resource configuration */
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
  
  /** Storage configuration */
  storage?: {
    size?: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
  };
  
  /** Custom Docker image to use for PostgreSQL (e.g., for pgvector or documentdb variants) */
  image?: pulumi.Input<string>;

  /** Default database configuration (CloudNative-PG only) */
  defaultDatabase?: DefaultDatabase;
}

/**
 * PostgreSQL module - provides a PostgreSQL database service with implementation flexibility
 * 
 * @example
 * ```typescript
 * import { PostgreSQLModule, PostgreSQLImplementation } from "../modules/postgres";
 * 
 * const database = new PostgreSQLModule("app-database", {
 *   namespace: "application",
 *   implementation: PostgreSQLImplementation.BITNAMI_POSTGRESQL,
 *   auth: {
 *     database: "myapp",
 *     username: "appuser",
 *   },
 *   resources: {
 *     requests: {
 *       memory: "512Mi",
 *       cpu: "200m",
 *     },
 *     limits: {
 *       memory: "1Gi",
 *       cpu: "500m",
 *     },
 *   },
 *   storage: {
 *     size: "20Gi",
 *     storageClass: "fast-ssd",
 *   },
 * });
 * 
 * // Use unified interface
 * const dbConfig = database.getConnectionConfig();
 * ```
 */
export class PostgreSQLModule extends pulumi.ComponentResource {
  public readonly instance: PostgreSQL | CloudNativePGCluster;

  constructor(name: string, args: PostgreSQLModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:PostgreSQL", name, args, opts);

    switch (args.implementation) {
      case PostgreSQLImplementation.BITNAMI_POSTGRESQL:
        this.instance = new PostgreSQL(name, {
          namespace: args.namespace,
          password: args.auth?.password,
          username: args.auth?.username,
          database: args.auth?.database,
          storage: args.storage ? {
            size: args.storage.size || "8Gi",
            storageClass: args.storage.storageClass,
          } : undefined,
          memoryRequest: args.resources?.requests?.memory,
          cpuRequest: args.resources?.requests?.cpu,
          memoryLimit: args.resources?.limits?.memory,
          cpuLimit: args.resources?.limits?.cpu,
          image: args.image,
        }, { parent: this });
        break;
      case PostgreSQLImplementation.CLOUDNATIVE_PG:
        this.instance = new CloudNativePGCluster(name, {
          namespace: args.namespace,
          storage: args.storage,
          resources: args.resources,
          defaultDatabase: args.defaultDatabase,
        }, { parent: this });
        break;
      default:
        throw new Error(`Unknown PostgreSQL implementation: ${args.implementation}`);
    }

    this.registerOutputs({
      instance: this.instance,
    });
  }

  /**
   * Returns connection configuration for PostgreSQL
   * @returns PostgreSQL connection configuration that works across implementations
   */
  public getConnectionConfig(): PostgreSQLConfig {
    return this.instance.getConnectionConfig();
  }

  /**
   * Returns the generated or provided password for PostgreSQL authentication
   * @returns Password output that can be used for connecting to PostgreSQL
   */
  public getPassword(): pulumi.Output<string> {
    if ('result' in this.instance.password) {
      return this.instance.password.result;
    }
    return this.instance.password;
  }
}

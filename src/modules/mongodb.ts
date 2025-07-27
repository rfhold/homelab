import * as pulumi from "@pulumi/pulumi";
import { MongoDB, MongoDBArchitecture } from "../components/bitnami-mongodb";
import { BasicMongoDB } from "../components/basic-mongodb";
import { MongoDBConfig } from "../adapters/mongodb";

// Re-export MongoDBArchitecture for convenience
export { MongoDBArchitecture } from "../components/bitnami-mongodb";

/**
 * Available MongoDB implementations
 */
export enum MongoDBImplementation {
  BITNAMI_MONGODB = "bitnami-mongodb",
  BASIC_MONGODB = "basic-mongodb",
}

/**
 * Configuration for the MongoDB module
 */
export interface MongoDBModuleArgs {
  /** Kubernetes namespace to deploy MongoDB into */
  namespace: pulumi.Input<string>;
  
  /** MongoDB implementation to use */
  implementation: MongoDBImplementation;
  
  /** MongoDB architecture (standalone or replicaset) */
  architecture?: pulumi.Input<MongoDBArchitecture>;
  
  /** Authentication configuration */
  auth?: {
    /** Custom password for MongoDB authentication (if not provided, a random one will be generated) */
    password?: pulumi.Input<string>;
    /** MongoDB username (defaults to 'root') */
    username?: pulumi.Input<string>;
    /** MongoDB database name (defaults to 'admin') */
    database?: pulumi.Input<string>;
    /** Replica set key for internal authentication (only for replicaset architecture) */
    replicaSetKey?: pulumi.Input<string>;
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
  
  /** Custom Docker image to use for MongoDB */
  image?: pulumi.Input<string>;
  
  /** Replication configuration (only for replicaset architecture) */
  replication?: {
    /** Number of replicas (defaults to 3) */
    replicaCount?: pulumi.Input<number>;
    /** Enable arbiter (defaults to true for replicaset) */
    arbiterEnabled?: pulumi.Input<boolean>;
    /** Replica set name (defaults to 'rs0') */
    replicaSetName?: pulumi.Input<string>;
  };
}

/**
 * MongoDB module - provides a NoSQL document database service with implementation flexibility
 * 
 * @example
 * ```typescript
 * import { MongoDBModule, MongoDBImplementation, MongoDBArchitecture } from "../modules/mongodb";
 * 
 * // Using Bitnami MongoDB (supports amd64 only)
 * const database = new MongoDBModule("app-database", {
 *   namespace: "application",
 *   implementation: MongoDBImplementation.BITNAMI_MONGODB,
 *   architecture: MongoDBArchitecture.REPLICASET,
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
 *   replication: {
 *     replicaCount: 3,
 *     arbiterEnabled: true,
 *   },
 * });
 * 
 * // Using Basic MongoDB (supports amd64/arm64)
 * const basicDb = new MongoDBModule("basic-database", {
 *   namespace: "application",
 *   implementation: MongoDBImplementation.BASIC_MONGODB,
 *   architecture: MongoDBArchitecture.STANDALONE,
 *   auth: {
 *     database: "myapp",
 *     username: "appuser",
 *   },
 *   storage: {
 *     size: "10Gi",
 *   },
 * });
 * 
 * // Use unified interface
 * const dbConfig = database.getConnectionConfig();
 * ```
 */
export class MongoDBModule extends pulumi.ComponentResource {
  public readonly instance: MongoDB | BasicMongoDB;

  constructor(name: string, args: MongoDBModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:MongoDB", name, args, opts);

    switch (args.implementation) {
      case MongoDBImplementation.BITNAMI_MONGODB:
        this.instance = new MongoDB(name, {
          namespace: args.namespace,
          architecture: args.architecture,
          password: args.auth?.password,
          username: args.auth?.username,
          database: args.auth?.database,
          replicaSetKey: args.auth?.replicaSetKey,
          storage: args.storage ? {
            size: args.storage.size || "8Gi",
            storageClass: args.storage.storageClass,
          } : undefined,
          memoryRequest: args.resources?.requests?.memory,
          cpuRequest: args.resources?.requests?.cpu,
          memoryLimit: args.resources?.limits?.memory,
          cpuLimit: args.resources?.limits?.cpu,
          image: args.image,
          replicaCount: args.replication?.replicaCount,
          arbiterEnabled: args.replication?.arbiterEnabled,
          replicaSetName: args.replication?.replicaSetName,
        }, { parent: this });
        break;
      case MongoDBImplementation.BASIC_MONGODB:
        this.instance = new BasicMongoDB(name, {
          namespace: args.namespace,
          architecture: args.architecture,
          password: args.auth?.password,
          username: args.auth?.username,
          database: args.auth?.database,
          replicaSetKey: args.auth?.replicaSetKey,
          storage: args.storage ? {
            size: args.storage.size || "8Gi",
            storageClass: args.storage.storageClass,
          } : undefined,
          memoryRequest: args.resources?.requests?.memory,
          cpuRequest: args.resources?.requests?.cpu,
          memoryLimit: args.resources?.limits?.memory,
          cpuLimit: args.resources?.limits?.cpu,
          image: args.image,
          replicaCount: args.replication?.replicaCount,
          arbiterEnabled: args.replication?.arbiterEnabled,
          replicaSetName: args.replication?.replicaSetName,
        }, { parent: this });
        break;
      default:
        throw new Error(`Unknown MongoDB implementation: ${args.implementation}`);
    }

    this.registerOutputs({
      instance: this.instance,
    });
  }

  /**
   * Returns connection configuration for MongoDB
   * @returns MongoDB connection configuration that works across implementations
   */
  public getConnectionConfig(): MongoDBConfig {
    return this.instance.getConnectionConfig();
  }

  /**
   * Returns the generated or provided password for MongoDB authentication
   * @returns Password output that can be used for connecting to MongoDB
   */
  public getPassword(): pulumi.Output<string> {
    return this.instance.password.result;
  }

  /**
   * Returns the generated or provided replica set key for internal authentication
   * @returns Replica set key output (only available for replicaset architecture)
   */
  public getReplicaSetKey(): pulumi.Output<string> | undefined {
    return this.instance.replicaSetKey?.result;
  }
}
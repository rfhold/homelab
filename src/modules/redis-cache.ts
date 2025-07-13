import * as pulumi from "@pulumi/pulumi";
import { Valkey } from "../components/bitnami-valkey";
import { RedisConfig } from "../adapters/redis";

/**
 * Available Redis implementations
 */
export enum RedisImplementation {
  BITNAMI_VALKEY = "bitnami-valkey",
}

/**
 * Configuration for the Redis module
 */
export interface RedisModuleArgs {
  /** Kubernetes namespace to deploy Redis into */
  namespace: pulumi.Input<string>;
  
  /** Redis implementation to use */
  implementation: RedisImplementation;
  
  /** Authentication configuration */
  auth?: {
    /** Custom password for Redis authentication (if not provided, a random one will be generated) */
    password?: pulumi.Input<string>;
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
  
  /** Number of Redis replicas */
  replicas?: pulumi.Input<number>;
}

/**
 * Redis module - provides a Redis-compatible caching service with implementation flexibility
 * 
 * @example
 * ```typescript
 * import { RedisModule, RedisImplementation } from "../modules/redis-cache";
 * 
 * const cache = new RedisModule("app-cache", {
 *   namespace: "application",
 *   implementation: RedisImplementation.BITNAMI_VALKEY,
 *   auth: {
 *     password: "my-secure-password",
 *   },
 *   resources: {
 *     requests: {
 *       memory: "256Mi",
 *       cpu: "100m",
 *     },
 *     limits: {
 *       memory: "512Mi",
 *       cpu: "200m",
 *     },
 *   },
 *   storage: {
 *     size: "10Gi",
 *     storageClass: "fast-ssd",
 *   },
 *   replicas: 1,
 * });
 * 
 * // Use unified interface
 * const cacheConfig = cache.getConnectionConfig();
 * ```
 */
export class RedisModule extends pulumi.ComponentResource {
  public readonly instance: Valkey;

  constructor(name: string, args: RedisModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Redis", name, args, opts);

    switch (args.implementation) {
      case RedisImplementation.BITNAMI_VALKEY:
        this.instance = new Valkey(name, {
          namespace: args.namespace,
          password: args.auth?.password,
          storage: args.storage ? {
            size: args.storage.size || "8Gi",
            storageClass: args.storage.storageClass,
          } : undefined,
          replicas: args.replicas,
          memoryLimit: args.resources?.limits?.memory,
          cpuLimit: args.resources?.limits?.cpu,
        }, { parent: this });
        break;
      default:
        throw new Error(`Unknown Redis implementation: ${args.implementation}`);
    }

    this.registerOutputs({
      instance: this.instance,
    });
  }

  /**
   * Returns connection configuration for Redis
   * @returns Redis connection configuration that works across implementations
   */
  public getConnectionConfig(): RedisConfig {
    return this.instance.getConnectionConfig();
  }

  /**
   * Returns the generated or provided password for Redis authentication
   * @returns Password output that can be used for connecting to Redis
   */
  public getPassword(): pulumi.Output<string> {
    return this.instance.password.result;
  }
}

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createConnectionSafePassword, MongoDBConfig } from "../adapters/mongodb";
import { StorageConfig, createPVCSpec } from "../adapters/storage";

/**
 * MongoDB architecture options
 */
export enum MongoDBArchitecture {
  STANDALONE = "standalone",
  REPLICASET = "replicaset",
}

/**
 * Configuration for the MongoDB component
 */
export interface MongoDBArgs {
  /** Kubernetes namespace to deploy MongoDB into */
  namespace: pulumi.Input<string>;
  
  /** MongoDB architecture (standalone or replicaset) */
  architecture?: pulumi.Input<MongoDBArchitecture>;
  
  /** Custom password for MongoDB authentication (if not provided, a random one will be generated) */
  password?: pulumi.Input<string>;
  
  /** MongoDB database name (defaults to 'admin') */
  database?: pulumi.Input<string>;
  
  /** MongoDB username (defaults to 'root') */
  username?: pulumi.Input<string>;
  
  /** Storage configuration for MongoDB persistence (defaults to 8Gi) */
  storage?: StorageConfig;
  
  /** Memory limit for MongoDB container */
  memoryLimit?: pulumi.Input<string>;
  
  /** CPU limit for MongoDB container */
  cpuLimit?: pulumi.Input<string>;
  
  /** Memory request for MongoDB container */
  memoryRequest?: pulumi.Input<string>;
  
  /** CPU request for MongoDB container */
  cpuRequest?: pulumi.Input<string>;
  
  /** Custom Docker image to use for MongoDB */
  image?: pulumi.Input<string>;
  
  /** Number of replicas (only for replicaset architecture) */
  replicaCount?: pulumi.Input<number>;
  
  /** Enable arbiter (only for replicaset architecture) */
  arbiterEnabled?: pulumi.Input<boolean>;
  
  /** Replica set name (only for replicaset architecture) */
  replicaSetName?: pulumi.Input<string>;
  
  /** Replica set key for internal authentication (only for replicaset architecture) */
  replicaSetKey?: pulumi.Input<string>;
}

/**
 * MongoDB component - provides NoSQL document database
 * 
 * @example
 * ```typescript
 * import { MongoDB } from "../components/bitnami-mongodb";
 * 
 * const mongodb = new MongoDB("database", {
 *   namespace: "mongodb-system",
 *   database: "myapp",
 *   architecture: MongoDBArchitecture.REPLICASET,
 *   replicaCount: 3,
 *   storage: {
 *     size: "20Gi",
 *     storageClass: "fast-ssd"
 *   },
 * });
 * 
 * // Access the generated password
 * const password = mongodb.password.result;
 * ```
 * 
 * @see https://www.mongodb.com/
 * @see https://github.com/bitnami/charts/tree/main/bitnami/mongodb
 */
export class MongoDB extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;
  
  /** The generated or provided password for MongoDB authentication */
  public readonly password: ReturnType<typeof createConnectionSafePassword>;
  
  /** The generated or provided replica set key for internal authentication */
  public readonly replicaSetKey?: ReturnType<typeof createConnectionSafePassword>;

  /** Private connection configuration base - single source of truth */
  private readonly connectionConfig: MongoDBConfig;

  constructor(name: string, args: MongoDBArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:MongoDB", name, args, opts);

    const chartConfig = HELM_CHARTS.MONGODB;

    // Generate a random password if not provided
    this.password = createConnectionSafePassword(`${name}-password`, 32, { parent: this });

    // Handle architecture as an Output
    const architecture = pulumi.output(args.architecture || MongoDBArchitecture.STANDALONE);

    // Generate replica set key if using replicaset architecture
    const replicaSetKey = architecture.apply(arch => {
      if (arch === MongoDBArchitecture.REPLICASET) {
        if (args.replicaSetKey) {
          return pulumi.output(args.replicaSetKey);
        }
        return createConnectionSafePassword(`${name}-replica-set-key`, 32, { parent: this }).result;
      }
      return undefined;
    });

    // Store replica set key if generated
    if (args.architecture === MongoDBArchitecture.REPLICASET || !args.architecture) {
      this.replicaSetKey = args.replicaSetKey 
        ? { result: pulumi.output(args.replicaSetKey) } as any
        : createConnectionSafePassword(`${name}-replica-set-key`, 32, { parent: this });
    }

    // Default storage configuration
    const storageConfig: StorageConfig = {
      size: args.storage?.size || "8Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    // Create PVC spec using storage adapter
    const pvcSpec = createPVCSpec(storageConfig);

    // Chart release name for consistent naming
    const chartReleaseName = `${name}-chart`;

    // Parse custom image if provided
    let imageConfig: any = undefined;
    if (args.image) {
      // Parse the image string to extract registry, repository, and tag
      const imageStr = pulumi.output(args.image).apply(img => {
        const parts = img.split('/');
        const lastPart = parts[parts.length - 1];
        const [repoAndName, tag] = lastPart.split(':');
        
        // Handle different image formats
        if (parts.length === 3) {
          // Format: registry/namespace/repo:tag
          return {
            registry: parts[0],
            repository: `${parts[1]}/${repoAndName}`,
            tag: tag || 'latest',
          };
        } else if (parts.length === 2) {
          // Format: namespace/repo:tag
          return {
            registry: 'docker.io',
            repository: `${parts[0]}/${repoAndName}`,
            tag: tag || 'latest',
          };
        } else {
          // Format: repo:tag
          return {
            registry: 'docker.io',
            repository: repoAndName,
            tag: tag || 'latest',
          };
        }
      });
      
      imageConfig = {
        registry: imageStr.registry,
        repository: imageStr.repository,
        tag: imageStr.tag,
        pullPolicy: 'IfNotPresent',
      };
    }

    // Build values based on architecture
    const values = pulumi.all([
      architecture,
      replicaSetKey,
      args.replicaCount || 3,
      args.arbiterEnabled,
      args.replicaSetName || "rs0",
      args.username || "root",
      args.password || this.password.result,
    ]).apply(([arch, rsKey, replicaCount, arbiterEnabled, replicaSetName, username, password]) => {
      // Build auth configuration
      const authConfig: any = {
        enabled: true,
        rootUser: username,
        rootPassword: password,
        usernames: [],
        passwords: [],
        databases: [],
      };

      // Add replica set key if using replicaset architecture
      if (arch === MongoDBArchitecture.REPLICASET && rsKey) {
        authConfig.replicaSetKey = rsKey;
      }

      return {
        global: {
          security: {
            allowInsecureImages: true,
          },
        },
        architecture: arch,
        auth: authConfig,
        image: imageConfig,
        replicaCount: arch === MongoDBArchitecture.REPLICASET ? replicaCount : 1,
        arbiter: {
          enabled: arch === MongoDBArchitecture.REPLICASET 
            ? (arbiterEnabled !== false) // Default to true for replicaset
            : false,
        },
        replicaSetName: arch === MongoDBArchitecture.REPLICASET ? replicaSetName : undefined,
        persistence: {
          enabled: true,
          ...pvcSpec,
        },
        resources: {
          limits: {
            memory: args.memoryLimit || undefined,
            cpu: args.cpuLimit || undefined,
          },
          requests: {
            memory: args.memoryRequest || undefined,
            cpu: args.cpuRequest || undefined,
          },
        },
        metrics: {
          enabled: false, // Can be enabled in the future
        },
      };
    });

    // Deploy MongoDB using Helm v4 Chart
    // Use the helper function to handle OCI chart configuration automatically
    this.chart = new k8s.helm.v4.Chart(
      chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: values,
      },
      { parent: this }
    );

    // Initialize connection configuration - single source of truth
    // Complete connection configuration with discovered host based on architecture
    this.connectionConfig = pulumi.all([
      architecture,
      args.namespace,
      args.username || "root",
      args.password || this.password.result,
      args.database || "admin",
      args.replicaSetName || "rs0",
      args.replicaCount || 3,
    ]).apply(([arch, namespace, username, password, database, replicaSetName, replicaCount]) => {
      const config: MongoDBConfig = {
        host: arch === MongoDBArchitecture.STANDALONE
          ? `${chartReleaseName}-mongodb.${namespace}`
          : `${chartReleaseName}-mongodb-headless.${namespace}`,
        port: 27017,
        username: username,
        password: password,
        database: database,
        authDatabase: "admin",
        replicaSet: arch === MongoDBArchitecture.REPLICASET ? replicaSetName : undefined,
      };

      // For replicaset, add additional hosts for direct connections
      if (arch === MongoDBArchitecture.REPLICASET) {
        const hosts: string[] = [];
        for (let i = 0; i < replicaCount; i++) {
          hosts.push(`${chartReleaseName}-mongodb-${i}.${chartReleaseName}-mongodb-headless.${namespace}:27017`);
        }
        config.additionalHosts = hosts;
      }

      return config;
    }) as any;

    this.registerOutputs({
      chart: this.chart,
      password: this.password,
      replicaSetKey: this.replicaSetKey,
    });
  }

  /**
   * Returns connection configuration for MongoDB
   * @returns A copy of the connection configuration to prevent accidental modification
   */
  public getConnectionConfig(): MongoDBConfig {
    return {
      host: this.connectionConfig.host,
      port: this.connectionConfig.port,
      username: this.connectionConfig.username,
      password: this.connectionConfig.password,
      database: this.connectionConfig.database,
      authDatabase: this.connectionConfig.authDatabase,
      replicaSet: this.connectionConfig.replicaSet,
      additionalHosts: this.connectionConfig.additionalHosts,
    };
  }
}
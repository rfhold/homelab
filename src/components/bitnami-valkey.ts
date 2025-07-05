import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createRedisPassword, RedisConfig } from "../adapters/redis";
import { StorageConfig, createPVCSpec } from "../adapters/storage";

/**
 * Configuration for the Valkey component
 */
export interface ValkeyArgs {
  /** Kubernetes namespace to deploy Valkey into */
  namespace: pulumi.Input<string>;
  
  /** Custom password for Valkey authentication (if not provided, a random one will be generated) */
  password?: pulumi.Input<string>;
  
  /** Storage configuration for Valkey persistence (defaults to 8Gi) */
  storage?: StorageConfig;
  
  /** Number of Valkey replicas (defaults to 1) */
  replicas?: pulumi.Input<number>;
  
  /** Memory limit for Valkey container */
  memoryLimit?: pulumi.Input<string>;
  
  /** CPU limit for Valkey container */
  cpuLimit?: pulumi.Input<string>;
}

/**
 * Valkey component - provides high-performance data structure server (Redis-compatible)
 * 
 * @example
 * ```typescript
 * import { Valkey } from "../components/bitnami-valkey";
 * 
 * const valkey = new Valkey("cache", {
 *   namespace: "valkey-system",
 *   storage: {
 *     size: "10Gi",
 *     storageClass: "fast-ssd"
 *   },
 *   replicas: 1,
 * });
 * 
 * // Access the generated password
 * const password = valkey.password.result;
 * ```
 * 
 * @see https://valkey.io/
 * @see https://github.com/bitnami/charts/tree/main/bitnami/valkey
 */
export class Valkey extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;
  
  /** The generated or provided password for Valkey authentication */
  public readonly password: ReturnType<typeof createRedisPassword>;

  /** Private connection configuration base - single source of truth */
  private readonly connectionConfig: RedisConfig;

  constructor(name: string, args: ValkeyArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Valkey", name, args, opts);

    const chartConfig = HELM_CHARTS.VALKEY;

    // Generate a random password if not provided
    this.password = createRedisPassword(`${name}-password`, 32, { parent: this });

    // Initialize connection configuration first - single source of truth
    // Note: host will be set after chart creation since we need the chart to find the service
    this.connectionConfig = {
      host: pulumi.output(""), // Will be set after chart creation
      port: 6379,
      password: args.password || this.password.result,
    };

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

    // Deploy Valkey using Helm v4 Chart
    // Use the helper function to handle OCI chart configuration automatically
    this.chart = new k8s.helm.v4.Chart(
      chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          auth: {
            enabled: true,
            password: this.connectionConfig.password,
          },
          primary: {
            count: args.replicas || 1,
            persistence: {
              enabled: true,
              ...pvcSpec,
            },
            resources: {
              limits: {
                memory: args.memoryLimit || undefined,
                cpu: args.cpuLimit || undefined,
              },
            },
          },
          replica: {
            replicaCount: 0, // Start with master-only setup
          },
        },
      },
      { parent: this }
    );

    // Complete connection configuration with discovered host
    // Using standard Bitnami chart naming convention: {release-name}-valkey
    this.connectionConfig = {
      ...this.connectionConfig,
      host: pulumi.interpolate`${chartReleaseName}-valkey.${args.namespace}`,
    };

    this.registerOutputs({
      chart: this.chart,
      password: this.password,
    });
  }

  /**
   * Returns connection configuration for Valkey
   * @returns A copy of the connection configuration to prevent accidental modification
   */
  public getConnectionConfig(): RedisConfig {
    return {
      host: this.connectionConfig.host,
      port: this.connectionConfig.port,
      password: this.connectionConfig.password,
    };
  }
}

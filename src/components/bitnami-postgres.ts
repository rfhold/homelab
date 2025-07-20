import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createConnectionSafePassword, PostgreSQLConfig } from "../adapters/postgres";
import { StorageConfig, createPVCSpec } from "../adapters/storage";

/**
 * Configuration for the PostgreSQL component
 */
export interface PostgreSQLArgs {
  /** Kubernetes namespace to deploy PostgreSQL into */
  namespace: pulumi.Input<string>;
  
  /** Custom password for PostgreSQL authentication (if not provided, a random one will be generated) */
  password?: pulumi.Input<string>;
  
  /** PostgreSQL database name (defaults to 'postgres') */
  database?: pulumi.Input<string>;
  
  /** PostgreSQL username (defaults to 'postgres') */
  username?: pulumi.Input<string>;
  
  /** Storage configuration for PostgreSQL persistence (defaults to 8Gi) */
  storage?: StorageConfig;
  
  /** Memory limit for PostgreSQL container */
  memoryLimit?: pulumi.Input<string>;
  
  /** CPU limit for PostgreSQL container */
  cpuLimit?: pulumi.Input<string>;
  
  /** Memory request for PostgreSQL container */
  memoryRequest?: pulumi.Input<string>;
  
  /** CPU request for PostgreSQL container */
  cpuRequest?: pulumi.Input<string>;
}

/**
 * PostgreSQL component - provides open source object-relational database system
 * 
 * @example
 * ```typescript
 * import { PostgreSQL } from "../components/bitnami-postgres";
 * 
 * const postgres = new PostgreSQL("database", {
 *   namespace: "postgres-system",
 *   database: "myapp",
 *   storage: {
 *     size: "20Gi",
 *     storageClass: "fast-ssd"
 *   },
 * });
 * 
 * // Access the generated password
 * const password = postgres.password.result;
 * ```
 * 
 * @see https://www.postgresql.org/
 * @see https://github.com/bitnami/charts/tree/main/bitnami/postgresql
 */
export class PostgreSQL extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;
  
  /** The generated or provided password for PostgreSQL authentication */
  public readonly password: ReturnType<typeof createConnectionSafePassword>;

  /** Private connection configuration base - single source of truth */
  private readonly connectionConfig: PostgreSQLConfig;

  constructor(name: string, args: PostgreSQLArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:PostgreSQL", name, args, opts);

    const chartConfig = HELM_CHARTS.POSTGRESQL;

    // Generate a random password if not provided
    this.password = createConnectionSafePassword(`${name}-password`, 32, { parent: this });

    // Initialize connection configuration first - single source of truth
    // Note: host will be set after chart creation since we need the chart to find the service
    this.connectionConfig = {
      host: "", // Will be set after chart creation
      port: 5432,
      username: args.username || "postgres",
      password: args.password || this.password.result,
      database: args.database || "postgres",
      sslMode: "disable",
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

    // Deploy PostgreSQL using Helm v4 Chart
    // Use the helper function to handle OCI chart configuration automatically
    this.chart = new k8s.helm.v4.Chart(
      chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          auth: {
            enablePostgresUser: true,
            postgresPassword: this.connectionConfig.password,
            username: this.connectionConfig.username,
            password: this.connectionConfig.password,
            database: this.connectionConfig.database,
          },
          primary: {
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
          },
        },
      },
      { parent: this }
    );

    // Complete connection configuration with discovered host
    // Using standard Bitnami chart naming convention: {release-name}-postgresql
    this.connectionConfig = {
      ...this.connectionConfig,
      host: pulumi.interpolate`${chartReleaseName}-postgresql.${args.namespace}`,
    };

    this.registerOutputs({
      chart: this.chart,
      password: this.password,
    });
  }

  /**
   * Returns connection configuration for PostgreSQL
   * @returns A copy of the connection configuration to prevent accidental modification
   */
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

import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

/**
 * Configuration for connecting to a PostgreSQL database
 */
export interface PostgreSQLConfig {
  /** Database host/endpoint */
  host: pulumi.Input<string>;
  
  /** Database port (defaults to 5432) */
  port?: pulumi.Input<number>;
  
  /** Database name */
  database: pulumi.Input<string>;
  
  /** Database username */
  username: pulumi.Input<string>;
  
  /** Database password */
  password: pulumi.Input<string>;
  
  /** SSL mode (disable, require, verify-ca, verify-full) */
  sslMode?: pulumi.Input<string>;
}

/**
 * Creates a Pulumi random password with connection string safe characters
 * Excludes characters that could cause issues in connection strings: @ : / ? # [ ] %
 * 
 * @param name Unique name for the random password resource
 * @param length Password length (defaults to 32)
 * @param opts Optional Pulumi resource options
 * @returns Random password resource
 */
export function createConnectionSafePassword(
  name: string, 
  length: number = 32,
  opts?: pulumi.ResourceOptions
): random.RandomPassword {
  return new random.RandomPassword(name, {
    length: length,
    special: true,
    // Exclude connection string problematic characters
    overrideSpecial: "!$^&*()-_=+[]{};'|,.<>~`",
    minLower: 1,
    minUpper: 1,
    minNumeric: 1,
    minSpecial: 1,
  }, opts);
}

/**
 * Creates a PostgreSQL connection string from configuration
 * 
 * @param config PostgreSQL configuration
 * @returns Pulumi output containing the connection string
 */
export function createConnectionString(config: PostgreSQLConfig): pulumi.Output<string> {
  return pulumi.all([
    config.host,
    config.port || 5432,
    config.database,
    config.username,
    config.password,
    config.sslMode || "require"
  ]).apply(([host, port, database, username, password, sslMode]) => {
    // URL encode password to handle special characters safely
    const encodedPassword = encodeURIComponent(password);
    return `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}?sslmode=${sslMode}`;
  });
}

/**
 * Creates a PostgreSQL connection object for applications that need individual components
 * 
 * @param config PostgreSQL configuration
 * @returns Object with individual connection components
 */
export function createConnectionComponents(config: PostgreSQLConfig) {
  return {
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    username: config.username,
    password: config.password,
    sslMode: config.sslMode || "require",
  };
}

/**
 * Creates standard PostgreSQL environment variables from configuration
 * Follows official PostgreSQL libpq environment variable conventions
 * 
 * @param config PostgreSQL configuration
 * @returns Object with standard PostgreSQL environment variables
 */
export function createPostgreSQLEnvironmentVariables(config: PostgreSQLConfig): Record<string, pulumi.Input<string>> {
  const components = createConnectionComponents(config);
  const connectionString = createConnectionString(config);
  
  return {
    PGHOST: components.host,
    PGPORT: pulumi.output(components.port).apply(p => p.toString()),
    PGDATABASE: components.database,
    PGUSER: components.username,
    PGPASSWORD: components.password,
    PGSSLMODE: components.sslMode,
    // Connection string for apps that prefer DATABASE_URL pattern
    DATABASE_URL: connectionString,
    // Alternative naming for apps that expect these patterns
    POSTGRES_HOST: components.host,
    POSTGRES_PORT: pulumi.output(components.port).apply(p => p.toString()),
    POSTGRES_DB: components.database,
    POSTGRES_USER: components.username,
    POSTGRES_PASSWORD: components.password,
    POSTGRES_URL: connectionString,
  };
}

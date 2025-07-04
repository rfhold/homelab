import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

/**
 * Configuration for connecting to a Redis/Valkey instance
 */
export interface RedisConfig {
  /** Redis server hostname or IP address */
  host: pulumi.Input<string>;
  
  /** Redis server port (defaults to 6379) */
  port?: pulumi.Input<number>;
  
  /** Redis password for authentication (optional) */
  password?: pulumi.Input<string>;
  
  /** Redis database number (defaults to 0) */
  database?: pulumi.Input<number>;
  
  /** Use SSL/TLS for connections (defaults to false) */
  ssl?: pulumi.Input<boolean>;
  
  /** Username for Redis ACL authentication (Redis 6+, optional) */
  username?: pulumi.Input<string>;
  
  /** Connection timeout in seconds (defaults to 5) */
  connectTimeout?: pulumi.Input<number>;
  
  /** Command timeout in seconds (defaults to 5) */
  commandTimeout?: pulumi.Input<number>;
  
  /** Maximum number of connection retries (defaults to 3) */
  retryAttempts?: pulumi.Input<number>;
  
  /** Retry delay in milliseconds (defaults to 1000) */
  retryDelay?: pulumi.Input<number>;
  

}

/**
 * Creates a connection-safe Redis password using Pulumi's random provider
 * 
 * @param name Unique name for the password resource
 * @param length Password length (defaults to 32)
 * @param opts Optional Pulumi resource options
 * @returns Random password resource
 */
export function createRedisPassword(name: string, length: number = 32, opts?: pulumi.ResourceOptions): random.RandomPassword {
  return new random.RandomPassword(name, {
    length: length,
    special: true,
    // Exclude characters that might cause issues in connection strings
    overrideSpecial: "!@#$%^&*()-_=+[]{}|;:,.<>?",
  }, opts);
}

/**
 * Creates a Redis connection string from configuration
 * 
 * @param config Redis configuration
 * @returns Redis connection string (redis://[username:password@]host:port/database)
 */
export function createRedisConnectionString(config: RedisConfig): pulumi.Output<string> {
  return pulumi.all([
    config.host,
    config.port || 6379,
    config.database || 0,
    config.username,
    config.password,
    config.ssl || false,
  ]).apply(([host, port, database, username, password, ssl]) => {
    const protocol = ssl ? "rediss" : "redis";
    let auth = "";
    
    if (username && password) {
      auth = `${username}:${password}@`;
    } else if (password) {
      auth = `:${password}@`;
    }
    
    return `${protocol}://${auth}${host}:${port}/${database}`;
  });
}

/**
 * Creates Redis connection components for applications that need individual parameters
 * 
 * @param config Redis configuration
 * @returns Object with individual Redis connection parameters
 */
export function createRedisConnectionComponents(config: RedisConfig) {
  return {
    host: config.host,
    port: config.port || 6379,
    database: config.database || 0,
    username: config.username,
    password: config.password,
    ssl: config.ssl || false,
    connectTimeout: config.connectTimeout || 5,
    commandTimeout: config.commandTimeout || 5,
    retryAttempts: config.retryAttempts || 3,
    retryDelay: config.retryDelay || 1000,
  };
}

/**
 * Creates standard Redis environment variables from configuration
 * 
 * @param config Redis configuration
 * @param prefix Optional prefix for environment variable names (defaults to "REDIS")
 * @returns Object with Redis environment variables
 */
export function createRedisEnvironmentVariables(config: RedisConfig, prefix: string = "REDIS"): Record<string, pulumi.Input<string>> {
  const components = createRedisConnectionComponents(config);
  const connectionString = createRedisConnectionString(config);
  
  return {
    [`${prefix}_HOST`]: components.host,
    [`${prefix}_PORT`]: pulumi.output(components.port).apply(p => p.toString()),
    [`${prefix}_DATABASE`]: pulumi.output(components.database).apply(d => d.toString()),
    [`${prefix}_PASSWORD`]: components.password || "",
    [`${prefix}_USERNAME`]: components.username || "",
    [`${prefix}_SSL`]: pulumi.output(components.ssl).apply(s => s.toString()),
    [`${prefix}_URL`]: connectionString,
    [`${prefix}_CONNECT_TIMEOUT`]: pulumi.output(components.connectTimeout).apply(t => t.toString()),
    [`${prefix}_COMMAND_TIMEOUT`]: pulumi.output(components.commandTimeout).apply(t => t.toString()),
    [`${prefix}_RETRY_ATTEMPTS`]: pulumi.output(components.retryAttempts).apply(r => r.toString()),
    [`${prefix}_RETRY_DELAY`]: pulumi.output(components.retryDelay).apply(d => d.toString()),

  };
}

/**
 * Creates a Redis client configuration object for applications
 * 
 * @param config Redis configuration
 * @returns Redis client configuration object
 */
export function createRedisClientConfig(config: RedisConfig) {
  const components = createRedisConnectionComponents(config);
  
  return {
    socket: {
      host: components.host,
      port: components.port,
      connectTimeout: pulumi.output(components.connectTimeout).apply(t => t * 1000), // Convert to milliseconds
      commandTimeout: pulumi.output(components.commandTimeout).apply(t => t * 1000), // Convert to milliseconds
      tls: components.ssl,
    },
    username: components.username,
    password: components.password,
    database: components.database,
    retry: {
      retries: components.retryAttempts,
      delay: components.retryDelay,
    },
  };
}

 
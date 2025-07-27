import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

/**
 * MongoDB connection configuration
 */
export interface MongoDBConfig {
  /** MongoDB host */
  host: pulumi.Input<string>;
  /** MongoDB port */
  port: pulumi.Input<number>;
  /** MongoDB username */
  username: pulumi.Input<string>;
  /** MongoDB password */
  password: pulumi.Input<string>;
  /** MongoDB database name */
  database: pulumi.Input<string>;
  /** MongoDB authentication database (defaults to 'admin') */
  authDatabase?: pulumi.Input<string>;
  /** MongoDB replica set name (for replicaset architecture) */
  replicaSet?: pulumi.Input<string>;
  /** Additional MongoDB hosts for replica set */
  additionalHosts?: pulumi.Input<string>[];
}

/**
 * Creates a connection-safe password for MongoDB
 * MongoDB passwords should not contain certain special characters that can cause issues in connection strings
 * 
 * @param name Resource name for the password
 * @param length Password length
 * @param opts Pulumi resource options
 * @returns Random password resource
 */
export function createConnectionSafePassword(
  name: string,
  length: number = 32,
  opts?: pulumi.CustomResourceOptions
): random.RandomPassword {
  return new random.RandomPassword(name, {
    length: length,
    special: true,
    // Avoid characters that can cause issues in MongoDB connection strings
    overrideSpecial: "!#$%&*()-_=+[]{}:?",
  }, opts);
}

/**
 * Generates a MongoDB connection string from configuration
 * 
 * @param config MongoDB connection configuration
 * @returns MongoDB connection string
 */
export function generateConnectionString(config: MongoDBConfig): pulumi.Output<string> {
  return pulumi.all([
    config.host,
    config.port,
    config.username,
    config.password,
    config.database,
    config.authDatabase || "admin",
    config.replicaSet,
    config.additionalHosts || []
  ]).apply(([host, port, username, password, database, authDatabase, replicaSet, additionalHosts]) => {
    // Encode username and password for URL safety
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);
    
    // Build host list for connection string
    let hostList = `${host}:${port}`;
    if (additionalHosts && additionalHosts.length > 0) {
      const additionalHostStrings = additionalHosts.map(h => h);
      hostList = [hostList, ...additionalHostStrings].join(',');
    }
    
    // Build connection string
    let connectionString = `mongodb://${encodedUsername}:${encodedPassword}@${hostList}/${database}`;
    
    // Add query parameters
    const queryParams: string[] = [];
    
    // Add auth source if different from admin
    if (authDatabase !== "admin") {
      queryParams.push(`authSource=${authDatabase}`);
    }
    
    // Add replica set if specified
    if (replicaSet) {
      queryParams.push(`replicaSet=${replicaSet}`);
    }
    
    // Append query parameters if any
    if (queryParams.length > 0) {
      connectionString += `?${queryParams.join('&')}`;
    }
    
    return connectionString;
  });
}

/**
 * Generates a MongoDB connection string for SRV records (MongoDB Atlas style)
 * This is useful when using external MongoDB services
 * 
 * @param config MongoDB connection configuration (host should be the SRV domain)
 * @returns MongoDB SRV connection string
 */
export function generateSRVConnectionString(config: Omit<MongoDBConfig, 'port' | 'additionalHosts'>): pulumi.Output<string> {
  return pulumi.all([
    config.host,
    config.username,
    config.password,
    config.database,
    config.authDatabase || "admin",
    config.replicaSet
  ]).apply(([host, username, password, database, authDatabase, replicaSet]) => {
    // Encode username and password for URL safety
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);
    
    // Build connection string
    let connectionString = `mongodb+srv://${encodedUsername}:${encodedPassword}@${host}/${database}`;
    
    // Add query parameters
    const queryParams: string[] = [];
    
    // Add auth source if different from admin
    if (authDatabase !== "admin") {
      queryParams.push(`authSource=${authDatabase}`);
    }
    
    // Add replica set if specified
    if (replicaSet) {
      queryParams.push(`replicaSet=${replicaSet}`);
    }
    
    // Append query parameters if any
    if (queryParams.length > 0) {
      connectionString += `?${queryParams.join('&')}`;
    }
    
    return connectionString;
  });
}
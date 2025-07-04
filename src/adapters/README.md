# Infrastructure Adapters

This directory contains **Infrastructure Adapters** - standardized configuration interfaces and utility functions for working with infrastructure services in Pulumi.

## What are Infrastructure Adapters?

Infrastructure Adapters provide consistent, type-safe **connection configuration interfaces** and utility functions for connecting to infrastructure services. Each adapter defines:

1. **Connection Interface** - A standardized TypeScript interface describing how to connect to a service
2. **Utility Functions** - Common operations like connection string generation, credential creation, and configuration formatting
3. **Pulumi Integration** - Proper handling of Pulumi inputs, outputs, and resources

**Important**: Adapters describe how applications connect to services, not how to configure the services themselves.

## Key Benefits

- **Standardization**: Consistent configuration patterns across all infrastructure services
- **Type Safety**: Full TypeScript support with compile-time validation of configurations
- **Utility Functions**: Reusable functions for common operations (passwords, connection strings, etc.)
- **Pulumi-Native**: Built-in support for Pulumi inputs/outputs and resource management
- **Security**: Safe handling of credentials and connection strings with proper encoding

## Current Adapters

### Docker Registry (`docker.ts`)
- **Interface**: `DockerRegistryConfig` - Registry URL, username, and password
- **Utilities**: 
  - `createDockerConfigJson()` - Generates `.dockerconfigjson` for Kubernetes secrets
  - `createDockerRegistryEnvironmentVariables()` - Generates Docker registry environment variables

### PostgreSQL (`postgres.ts`)
- **Interface**: `PostgreSQLConfig` - Host, port, database, credentials, and SSL configuration  
- **Utilities**:
  - `createConnectionSafePassword()` - Generates connection string safe passwords
  - `createConnectionString()` - Builds complete PostgreSQL connection URLs
  - `createConnectionComponents()` - Returns individual connection parameters
  - `createPostgreSQLEnvironmentVariables()` - Generates standard PostgreSQL environment variables

### S3 Storage (`s3.ts`)
- **Interface**: `S3Config` - Endpoint, credentials, region (default: "auto"), and path-style configuration (default: true)
- **Utilities**:
  - `createS3Url()` - Builds S3 connection URLs with optional bucket names
  - `createS3ClientConfig()` - Returns S3 client configuration object
  - `createS3EnvironmentVariables()` - Generates standard S3 environment variables

### Kubernetes Storage (`storage.ts`)
- **Interface**: `StorageConfig` - Size, storage class, access modes, volume mode, and PVC configuration options
- **Utilities**:
  - `createPVC()` - Creates a Kubernetes PVC resource from configuration
  - `createPVCSpec()` - Returns PVC specification object for embedding in other resources (e.g., StatefulSet volumeClaimTemplates)

### Redis/Valkey (`redis.ts`)
- **Interface**: `RedisConfig` - Host, port, database, credentials, SSL, and timeout configuration
- **Utilities**:
  - `createRedisPassword()` - Generates connection-safe Redis passwords
  - `createRedisConnectionString()` - Builds complete Redis connection URLs
  - `createRedisConnectionComponents()` - Returns individual connection parameters
  - `createRedisEnvironmentVariables()` - Generates standard Redis environment variables
  - `createRedisClientConfig()` - Returns Redis client configuration object

## Usage Pattern

```typescript
// Docker Registry Example
import { DockerRegistryConfig, createDockerConfigJson, createDockerRegistryEnvironmentVariables } from "../adapters/docker";

const dockerConfig: DockerRegistryConfig = {
  url: "ghcr.io",
  username: "my-username",
  password: "my-token"
};
const dockerConfigJson = createDockerConfigJson(dockerConfig);
const envVars = createDockerRegistryEnvironmentVariables(dockerConfig);
// or with custom prefix:
// const envVars = createDockerRegistryEnvironmentVariables(dockerConfig, "GHCR");

// PostgreSQL Example
import { PostgreSQLConfig, createConnectionSafePassword, createConnectionString, createPostgreSQLEnvironmentVariables } from "../adapters/postgres";

const dbPassword = createConnectionSafePassword("my-app-db-password");
// or with resource options:
// const dbPassword = createConnectionSafePassword("my-app-db-password", 32, { protect: true });
const postgresConfig: PostgreSQLConfig = {
  host: "postgres.example.com",
  database: "myapp",
  username: "app_user",
  password: dbPassword.result,
  sslMode: "require"
};
const connectionString = createConnectionString(postgresConfig);
const envVars = createPostgreSQLEnvironmentVariables(postgresConfig);

// S3 Example
import { S3Config, createS3ClientConfig, createS3EnvironmentVariables } from "../adapters/s3";

const s3Config: S3Config = {
  endpoint: "s3.example.com",
  accessKeyId: "my-access-key",
  secretAccessKey: "my-secret-key",
  region: "us-east-1", // defaults to "auto"
  s3ForcePathStyle: true // defaults to true
};
const clientConfig = createS3ClientConfig(s3Config);
const envVars = createS3EnvironmentVariables(s3Config);

// Storage Example
import { StorageConfig, createPVC, createPVCSpec } from "../adapters/storage";

const storageConfig: StorageConfig = {
  size: "10Gi",
  storageClass: "fast-ssd",
  accessModes: ["ReadWriteOnce"], // defaults to ["ReadWriteOnce"]
  namespace: "production"
};
const pvc = createPVC("myapp-data", storageConfig);
const pvcSpec = createPVCSpec(storageConfig); // for StatefulSet volumeClaimTemplates

// Example with resource options
const pvcWithOptions = createPVC("myapp-data", storageConfig, {
  dependsOn: [someOtherResource],
  protect: true
});

// Redis Example
import { RedisConfig, createRedisPassword, createRedisConnectionString, createRedisEnvironmentVariables, createRedisClientConfig } from "../adapters/redis";

const redisPassword = createRedisPassword("myapp-redis-password");
// or with resource options:
// const redisPassword = createRedisPassword("myapp-redis-password", 32, { protect: true });
const redisConfig: RedisConfig = {
  host: "redis.example.com",
  port: 6379, // defaults to 6379
  database: 0, // defaults to 0
  password: redisPassword.result,
  ssl: true,
  connectTimeout: 10, // defaults to 5 seconds
  retryAttempts: 5 // defaults to 3
};
const connectionString = createRedisConnectionString(redisConfig);
const envVars = createRedisEnvironmentVariables(redisConfig);
const clientConfig = createRedisClientConfig(redisConfig);


```

## Architecture Overview

```
┌─────────────────┐    imports      ┌──────────────────┐   provides      ┌─────────────────┐
│   Application   │ ──────────────→ │ Infrastructure   │ ─────────────→  │ Infrastructure  │
│     Stack       │                 │    Adapter       │ connection info │   Component     │
│   (GitLab)      │                 │  (PostgreSQL)    │                 │ (Bitnami-PG)    │
└─────────────────┘                 └──────────────────┘                 └─────────────────┘
                                           │                                      │
                                           ▼                                      │
                                    ┌──────────────────┐                          │
                                    │ Connection Utils │                          │
                                    │ • Passwords      │                          │
                                    │ • URLs           │ ◄────────────────────────┘
                                    │ • Environment    │   service deploys here
                                    │   Variables      │   
                                    └──────────────────┘
```

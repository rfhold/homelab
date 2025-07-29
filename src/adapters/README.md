# Adapters

Standardized configuration interfaces and utility functions for working with infrastructure services. Adapters focus on connection information and utilities, not service configuration.

## Purpose & Responsibility

Adapters are responsible for:
- Providing consistent connection configuration interfaces across all infrastructure services
- Offering type-safe utilities for common operations (passwords, connection strings, environment variables)
- Handling Pulumi inputs/outputs properly in connection contexts
- Ensuring secure credential management and connection string encoding
- Abstracting service-specific connection details behind common interfaces

## Available Adapters

| Adapter | File | Purpose |
|---------|------|---------|
| `DockerRegistryConfig` | `docker.ts` | Docker registry connection configuration with JSON config generation |
| `EnvironmentConfig` | `environment.ts` | Environment variable management from environment stack |
| `MongoDBConfig` | `mongodb.ts` | MongoDB connection configuration with replica set support |
| `PostgreSQLConfig` | `postgres.ts` | PostgreSQL connection configuration with SSL support |
| `RedisConfig` | `redis.ts` | Redis/Valkey connection configuration with SSL and timeout options |
| `S3Config` | `s3.ts` | S3-compatible storage connection configuration |
| `StackReferenceConfig` | `stack-reference.ts` | Pulumi stack reference management with caching |
| `StorageConfig` | `storage.ts` | Kubernetes storage configuration for PVCs and volumes |
| `WebhookConfig` | `webhook.ts` | Webhook configuration utilities for external services |

## Standard Structure

All adapters must follow this structure:

### Configuration Interface
- Named with `Config` suffix (e.g., `PostgreSQLConfig`, `RedisConfig`)
- Use `pulumi.Input<T>` for all configuration properties
- Include all necessary connection parameters (host, port, credentials, etc.)
- Provide sensible defaults for optional parameters

### Utility Functions
Common utility function patterns:
- `createConnectionSafePassword()` - Generate passwords safe for connection strings
- `createConnectionString()` - Build complete connection URLs
- `createEnvironmentVariables()` - Generate standard environment variables
- `createClientConfig()` - Return client configuration objects

### Pulumi Integration
- Handle Pulumi inputs/outputs properly using `pulumi.interpolate`
- Support both static values and Pulumi outputs in configuration
- Return Pulumi outputs from utility functions when appropriate

## Guidelines

### Connection Configuration Design
- Focus on connection information, not service configuration
- Include all parameters needed to connect to the service
- Use standard parameter names across similar services (host, port, username, password)
- Support both basic and advanced connection options (SSL, timeouts, etc.)

### Password Generation
- Use connection-safe characters in generated passwords (avoid special characters that break URLs)
- Provide configurable password length with sensible defaults
- Support Pulumi resource options for password resources (protection, etc.)
- Generate passwords using `pulumi.random.RandomPassword` with appropriate character sets

### Connection String Building
- Use proper URL encoding for all connection string components
- Support optional parameters that may not be present in all configurations
- Handle different connection string formats for the same service type
- Use `pulumi.interpolate` for dynamic connection strings with Pulumi outputs

### Environment Variable Generation
- Follow standard naming conventions for each service type
- Support custom prefixes for environment variable names
- Include all necessary connection parameters as separate variables
- Provide both individual variables and connection string variables

### Client Configuration
- Return configuration objects that can be used directly with client libraries
- Include all connection parameters in the appropriate format
- Support both synchronous and asynchronous client configurations
- Handle service-specific client options and defaults

### Error Handling
- Validate required configuration parameters
- Provide clear error messages for invalid configurations
- Handle missing optional parameters gracefully
- Support partial configurations for different use cases

### Security Best Practices
- Never log or expose credentials in plain text
- Use proper encoding for connection strings and URLs
- Support SSL/TLS configuration options where applicable
- Generate cryptographically secure passwords and tokens

### Type Safety
- Use strict TypeScript types for all configuration interfaces
- Provide proper type definitions for utility function parameters and return values
- Support generic types where appropriate for flexibility
- Ensure compile-time validation of configuration objects
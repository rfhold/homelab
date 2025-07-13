# Adapters - Service Connection Patterns

## Purpose
Adapters provide connection configuration interfaces and utility functions for external services. They focus on connection info, not service configuration.

## Adapter Structure
- Export `ServiceNameConfig` interface for connection configuration
- Provide utility functions for common operations
- Handle Pulumi inputs/outputs properly
- All config properties use `pulumi.Input<T>`

## Adapter-Specific Import Order
- @pulumi/pulumi → @pulumi/random → other imports

## Common Utility Functions
- `createServicePassword()` - Generate connection-safe passwords
- `createConnectionString()` - Build connection URLs
- `createServiceEnvironmentVariables()` - Generate env vars
- `createServiceClientConfig()` - Return client configuration objects

## Adapter Patterns
```typescript
export interface ServiceConfig {
  host: pulumi.Input<string>;
  port?: pulumi.Input<number>;
  password?: pulumi.Input<string>;
  // Other connection properties
}

export function createServicePassword(
  name: string,
  length: number = 32,
  opts?: pulumi.CustomResourceOptions
): pulumi.random.RandomPassword {
  return new pulumi.random.RandomPassword(name, {
    length,
    special: false, // Connection-safe
  }, opts);
}

export function createConnectionString(config: ServiceConfig): pulumi.Output<string> {
  return pulumi.interpolate`protocol://${config.host}:${config.port}`;
}
```

## Connection String Guidelines
- Use proper URL encoding for connection strings
- Prefer connection-safe characters in generated passwords (no special chars)
- Always use `pulumi.interpolate` for dynamic connection strings
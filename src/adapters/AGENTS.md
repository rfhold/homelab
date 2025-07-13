# Agent Instructions for Adapters

## DEPLOYMENT RESTRICTIONS
**CRITICAL: DO NOT RUN ANY DEPLOYMENT COMMANDS**
- Code review and development only - no deployment execution
- These adapters are used in sensitive production infrastructure

## Build/Lint/Test Commands
- **Install deps**: `bun install` from project root
- **No test runner** - Add adapter tests as needed

## Adapter Structure
Adapters provide connection configuration interfaces and utility functions:
- Export `ServiceNameConfig` interface for connection configuration
- Provide utility functions for common operations
- Handle Pulumi inputs/outputs properly
- Focus on connection info, not service configuration

## Code Style Guidelines
- Interface naming: `ServiceNameConfig` (e.g., `PostgreSQLConfig`, `RedisConfig`)
- All config properties use `pulumi.Input<T>`
- Utility function patterns:
  - `createServicePassword()` - Generate connection-safe passwords
  - `createConnectionString()` - Build connection URLs
  - `createServiceEnvironmentVariables()` - Generate env vars
  - `createServiceClientConfig()` - Return client configuration objects
- Import order: @pulumi/pulumi → @pulumi/random → other imports
- Use proper URL encoding for connection strings

## Common Patterns
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
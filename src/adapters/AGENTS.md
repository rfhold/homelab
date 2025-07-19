# Adapters - Service Connection Patterns

## Purpose
Adapters provide connection configuration interfaces and utility functions for external services. They focus on connection info, not service configuration.

## Adapter Structure
- Export `ServiceNameConfig` interface for connection configuration
- Provide utility functions for common operations
- Handle Pulumi inputs/outputs properly
- All config properties use `pulumi.Input<T>`

## Common Utility Functions
- `createServicePassword()` - Generate connection-safe passwords
- `createConnectionString()` - Build connection URLs
- `createServiceEnvironmentVariables()` - Generate env vars
- `createServiceClientConfig()` - Return client configuration objects

## Connection Guidelines
- Use proper URL encoding for connection strings
- Prefer connection-safe characters in generated passwords (no special chars)
- Always use `pulumi.interpolate` for dynamic connection strings

## Reference
See `docs/dependencies/PULUMI.md` for detailed Pulumi output handling patterns.

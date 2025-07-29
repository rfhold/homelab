# Modules

Higher-level abstractions that combine multiple components or provide a unified interface for switching between different implementations. Modules provide a uniform interface for integrating and grouping components together.

## Purpose & Responsibility

Modules are responsible for:
- Providing abstraction layers over components with implementation switching
- Combining multiple components into cohesive infrastructure solutions
- Offering generic configuration that works across different implementations
- Exposing unified interfaces regardless of underlying implementation
- Orchestrating complex multi-component setups

## Available Modules

| Module | File | Purpose |
|--------|------|---------|
| `AIWorkspaceModule` | `ai-workspace.ts` | AI services ecosystem with search, chat, and processing capabilities |
| `BitwardenModule` | `bitwarden.ts` | Password management service with web interface and API access |
| `GitModule` | `git.ts` | Complete Git service solution with web interface, SSH access, and storage |
| `IngressModule` | `ingress.ts` | Complete ingress solution with load balancing, routing, DNS, and certificates |
| `MongoDBModule` | `mongodb.ts` | MongoDB NoSQL database service with flexible architecture options |
| `PostgreSQLModule` | `postgres.ts` | PostgreSQL relational database service with connection management |
| `RedisModule` | `redis-cache.ts` | Redis-compatible caching service with connection utilities |
| `StorageModule` | `storage.ts` | Complete storage and backup solution with multiple backend options |

## Standard Structure

All modules must follow this structure:

### Implementation Enum
Define available implementations for switchable components:
```typescript
export enum RedisImplementation {
  BITNAMI_VALKEY = "bitnami-valkey",
}
```

### Generic Configuration Interface
- Named with `ModuleArgs` suffix (e.g., `RedisModuleArgs`)
- Include `implementation` property with enum type
- Use generic properties that work across implementations
- Avoid implementation-specific configuration objects

### Module Class
- Extend `pulumi.ComponentResource`
- Use resource type pattern: `"homelab:modules:ModuleName"`
- Use switch statements to instantiate appropriate components
- Expose component instances as `public readonly` properties

### Unified Interface Methods
Provide consistent methods that work across implementations:
- `getConnectionConfig()` for service modules
- Other common operations specific to the module's purpose

## Guidelines

### Generic Configuration Design
- Design configuration interfaces that work across all implementations
- Map generic arguments to implementation-specific settings within the module
- Provide type-safe configuration that doesn't change when switching implementations
- Focus on the 80/20 rule - cover common use cases with simple config

### Implementation Switching
- Use TypeScript enums to define available implementation options
- Support graceful evolution from single to multiple implementations
- Start with single implementation enums and design for future expansion
- Provide clear error messages for unsupported implementations

### Component Composition
- Focus on composing existing components rather than creating new infrastructure
- Leverage component interfaces and expose their key resources
- Maintain separation of concerns between modules and components
- For complex modules, allow switching individual components separately

### Granular Control
- For infrastructure modules, use separate enums for each switchable component
- Clearly separate what's switchable vs. what's fixed
- Always include certain components (like DNS and certificates in ingress)
- Provide escape hatches through component property access

### Configuration Mapping
- Map generic module-level configuration to component-level configuration
- Provide sensible defaults while allowing customization
- Maintain type safety throughout the mapping process
- Handle missing or invalid configuration gracefully

### Resource Management
- Set `{ parent: this }` on all child components
- Call `this.registerOutputs()` with key component instances
- Expose underlying components for advanced use cases
- Maintain consistent resource naming patterns

### Design Principles
- Each module should solve a specific infrastructure problem
- Avoid creating overly broad modules that try to do everything
- Design for evolution - consider future implementations in the interface
- Use union types for implementation instances to maintain type safety
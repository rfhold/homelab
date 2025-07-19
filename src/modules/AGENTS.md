# Modules - Abstraction Layer Components

## Purpose
Modules provide abstraction layers over components with implementation switching. They allow for different implementations of the same capability while maintaining a consistent interface.

## Module Structure
- Extend `pulumi.ComponentResource` with type `"homelab:modules:ModuleName"`
- Define implementation enums (e.g., `RedisImplementation`)
- Configuration interface named `ModuleNameModuleArgs` with generic properties
- Use switch statements to instantiate appropriate components
- Expose component instances as `public readonly` properties

## Key Patterns
- **Generic Configuration**: Design config that works across implementations
- **Implementation Switching**: Use switch statements with implementation enums
- **Unified Interface**: Provide consistent methods like `getConnectionConfig()`
- **Enum Naming**: Use SCREAMING_SNAKE_CASE (e.g., `BITNAMI_VALKEY`)
- **Service Modules**: Modules like Git can provide complete service solutions with ingress, storage, and dependencies
- **Password Access**: Expose generated passwords through getter methods for external access

## Design Principles
- Map generic config to component-specific config in constructor
- For multiple instances: create arrays of components, not components that handle multiple resources
- Match enum values to component names where possible

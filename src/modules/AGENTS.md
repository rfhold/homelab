# Modules - Abstraction Layer Components

## Purpose
Modules provide abstraction layers over components with implementation switching. They allow for different implementations of the same capability while maintaining a consistent interface.

## Module Structure
- Extend `pulumi.ComponentResource` with type `"homelab:modules:ModuleName"`
- Define implementation enums (e.g., `RedisImplementation`)
- Configuration interface named `ModuleNameModuleArgs` with generic properties
- Use switch statements to instantiate appropriate components
- Expose component instances as `public readonly` properties

## Module-Specific Import Order
- @pulumi/pulumi → ../components → other imports

## Implementation Pattern
```typescript
export enum ServiceImplementation {
  IMPL_ONE = "impl-one",
}

export interface ServiceModuleArgs {
  namespace: pulumi.Input<string>;
  implementation: ServiceImplementation;
  // Generic config properties
}

export class ServiceModule extends pulumi.ComponentResource {
  public readonly instance: ComponentType;
  
  constructor(name: string, args: ServiceModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Service", name, args, opts);
    
    switch (args.implementation) {
      case ServiceImplementation.IMPL_ONE:
        this.instance = new Component(name, { /* mapped config */ }, { parent: this });
        break;
    }
  }
}
```

## Module Design Principles
- Design generic configuration that works across implementations
- Map generic config to component-specific config in constructor
- Provide unified interface methods (e.g., `getConnectionConfig()`)
- For multiple instances: create arrays of components, not components that handle multiple resources

## Implementation Enum Guidelines
- Enum values in SCREAMING_SNAKE_CASE (e.g., `BITNAMI_VALKEY`)
- Use descriptive names that clearly indicate the underlying component
- Match enum values to component names where possible

## Documentation Maintenance
When adding new modules or implementations:
- Update module examples in README.md when adding new implementation options
- Add new modules to the module documentation with proper categorization
- Update usage examples if module interfaces change
- Ensure new modules follow the documented abstraction patterns
- Update implementation enum documentation when adding new options
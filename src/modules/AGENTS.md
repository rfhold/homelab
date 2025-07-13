# Agent Instructions for Modules

## DEPLOYMENT RESTRICTIONS
**CRITICAL: DO NOT RUN ANY DEPLOYMENT COMMANDS**
- Code review and development only - no deployment execution
- These modules orchestrate sensitive production infrastructure

## Build/Lint/Test Commands
- **Type check**: `bun tsc` from project root
- **Install deps**: `bun install` from project root
- **No test runner** - Add module tests as needed

## Module Structure
Modules provide abstraction layers over components with implementation switching:
- Extend `pulumi.ComponentResource` with type `"homelab:modules:ModuleName"`
- Define implementation enums (e.g., `RedisImplementation`)
- Configuration interface named `ModuleNameModuleArgs` with generic properties
- Use switch statements to instantiate appropriate components
- Expose component instances as `public readonly` properties
- For multiple instances: create arrays of components, not components that handle multiple resources

## Code Style Guidelines
- Design generic configuration that works across implementations
- Enum values in SCREAMING_SNAKE_CASE (e.g., `BITNAMI_VALKEY`)
- Import order: @pulumi/pulumi → ../components → other imports
- Map generic config to component-specific config in constructor
- Provide unified interface methods (e.g., `getConnectionConfig()`)
- File naming: kebab-case matching capability (e.g., redis-cache.ts)

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
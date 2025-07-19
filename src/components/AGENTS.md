# Components - Pulumi Infrastructure Components

## Purpose
Components are Pulumi ComponentResource classes that encapsulate infrastructure resources. They provide reusable, composable building blocks for infrastructure deployment.

## Component Structure
- Extend `pulumi.ComponentResource` with type `"homelab:components:ComponentName"`
- Configuration interface named `ComponentNameArgs`
- Use `pulumi.Input<T>` for all configuration properties
- Expose key resources as `public readonly` properties
- Use `{ parent: this }` on child resources
- Call `this.registerOutputs()` with key resources

## Key Patterns
- **Helm Integration**: Reference charts via `HELM_CHARTS.COMPONENT_NAME` from ../helm-charts.ts
- **Service Connection**: Include `getConnectionConfig(): ServiceConfig` method for service components
- **Documentation**: Use JSDoc with @example for all public APIs

## Reference
See `docs/dependencies/PULUMI.md` for detailed Pulumi patterns and examples.

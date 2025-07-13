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

## Component-Specific Import Order
- @pulumi/pulumi → @pulumi/kubernetes → ../helm-charts → ../adapters → ../utils

## Helm Chart Integration
- Reference charts via `HELM_CHARTS.COMPONENT_NAME` from ../helm-charts.ts
- Use `createHelmChartArgs()` helper for Helm chart configuration

## Common Component Patterns
```typescript
const chartConfig = HELM_CHARTS.COMPONENT_NAME;
const chartOptions = {
  ...createHelmChartArgs(chartConfig, args.namespace),
  values: { /* component-specific values */ }
};
this.chart = new k8s.helm.v4.Chart(`${name}-chart`, chartOptions, { parent: this });
```

## Service Connection Pattern
Components providing services should include:
```typescript
public getConnectionConfig(): ServiceConfig {
  return { /* connection details */ };
}
```

## Documentation Requirements
- Use JSDoc comments with @example for all public APIs
- Document all constructor parameters and public methods
- Include usage examples in JSDoc
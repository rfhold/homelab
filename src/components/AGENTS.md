# Agent Instructions for Components

## DEPLOYMENT RESTRICTIONS
**CRITICAL: DO NOT RUN ANY DEPLOYMENT COMMANDS**
- Code review and development only - no deployment execution
- These components manage sensitive production infrastructure

## Build/Lint/Test Commands
- **Type check**: `bun tsc` from project root
- **Install deps**: `bun install` from project root
- **No test runner** - Add component tests as needed

## Component Structure
Components are Pulumi ComponentResource classes that encapsulate infrastructure:
- Extend `pulumi.ComponentResource` with type `"homelab:components:ComponentName"`
- Configuration interface named `ComponentNameArgs`
- Expose key resources as `public readonly` properties
- Use `{ parent: this }` on child resources
- Call `this.registerOutputs()` with key resources

## Code Style Guidelines
- Use `pulumi.Input<T>` for all configuration properties
- Import order: @pulumi/pulumi → @pulumi/kubernetes → ../helm-charts → ../adapters → ../utils
- Reference charts via `HELM_CHARTS.COMPONENT_NAME` from ../helm-charts.ts
- Use `createHelmChartArgs()` helper for Helm chart configuration
- Always specify return types for public methods
- Use JSDoc comments with @example for all public APIs
- File naming: kebab-case (e.g., bitnami-postgres.ts)

## Common Patterns
```typescript
const chartConfig = HELM_CHARTS.COMPONENT_NAME;
const chartOptions = {
  ...createHelmChartArgs(chartConfig, args.namespace),
  values: { /* component-specific values */ }
};
this.chart = new k8s.helm.v4.Chart(`${name}-chart`, chartOptions, { parent: this });
```

## Connection Configuration
Components providing services should include:
```typescript
public getConnectionConfig(): ServiceConfig {
  return { /* connection details */ };
}
```
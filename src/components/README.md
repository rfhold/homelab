# Components

Components are reusable Pulumi `ComponentResource` building blocks that encapsulate a cohesive resource graph. The source directory is the current catalog; this README intentionally does not maintain a component inventory.

## Layer Contract

- Own provider-resource construction, implementation defaults, child dependencies, and resource-level outputs for one reusable capability.
- Parent child resources to the component and register the outputs that consumers need to depend on.
- Use shared adapter contracts for connection and storage data, and shared image or chart catalogs when those catalogs own the dependency version.
- Expose a focused input surface instead of copying every underlying provider or Helm option.

## Relationships

| Layer | Relationship |
| --- | --- |
| [`../adapters/`](../adapters/README.md) | Supplies shared data shapes and focused support helpers. |
| [`../modules/`](../modules/README.md) | Composes components into higher-level infrastructure capabilities. |
| [`../../programs/`](../../programs/AGENTS.md) | Instantiates components directly when no higher-level composition is needed. |
| [`../helm-charts.ts`](../helm-charts.ts) and [`../docker-images.ts`](../docker-images.ts) | Own shared chart and image references used by components. |

## Change Boundaries

- Keep stack selection, environment-specific configuration, namespaces shared across a complete program, and cross-service orchestration in modules or programs.
- Treat component type tokens, logical names, input defaults, public properties, and registered outputs as migration-sensitive contracts.
- Preserve Pulumi parentage, dependencies, secret propagation, and replacement behavior when changing the resource graph.

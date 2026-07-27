# Modules

Modules are higher-level Pulumi `ComponentResource` compositions that turn components and providers into a coherent infrastructure capability. The source directory is the current catalog; this README intentionally does not duplicate a module inventory.

## Layer Contract

- Own cross-component orchestration, shared policy, dependency ordering, and the stable interface a program needs for one capability.
- Compose existing components when they provide the required resource boundary; create provider resources directly only when the orchestration itself owns them.
- Offer implementation selection only where real alternatives exist. An implementation enum or switch is not required for a module that provides one composition.
- Expose outputs or component handles needed by programs without leaking incidental construction details.

## Relationships

| Layer | Relationship |
| --- | --- |
| [`../adapters/`](../adapters/README.md) | Defines shared data contracts used across implementations and components. |
| [`../components/`](../components/README.md) | Supplies reusable resource-level building blocks. |
| [`../../programs/`](../../programs/AGENTS.md) | Selects stacks and targets, supplies environment configuration, and exports stack outputs. |

## Change Boundaries

- Keep a module focused on one infrastructure capability; unrelated application or environment policy belongs in the owning program.
- Treat public arguments, implementation identifiers, component handles, resource type tokens, and registered outputs as consumer contracts.
- When changing composition or implementation selection, inspect every consuming program and preserve Pulumi parentage, dependencies, secrets, and replacement behavior.

# Adapters

Adapters define shared boundary types and focused helpers for passing connection, storage, webhook, and stack-reference data between Pulumi resources. The source directory is the current catalog; this README intentionally does not duplicate a file inventory.

## Layer Contract

- Normalize service-facing configuration while preserving `pulumi.Input` and `pulumi.Output` behavior.
- Build derived values such as connection strings, client settings, and environment maps without exposing credentials.
- Create only narrowly scoped supporting resources, such as generated passwords, stack references, or storage claims. Complete service deployment and orchestration belong in higher layers.
- Keep defaults and encoding rules consistent for all consumers of an adapter.

## Relationships

| Layer | Relationship |
| --- | --- |
| [`../components/`](../components/README.md) | Uses adapters to expose consistent resource inputs and outputs. |
| [`../modules/`](../modules/README.md) | Uses adapter contracts to present stable interfaces across composed resources. |
| [`../../programs/`](../../programs/AGENTS.md) | May consume adapters directly for stack configuration and cross-stack outputs. |

## Change Boundaries

- Treat exported interfaces, defaults, and helper return shapes as shared API. Search components, modules, and programs before changing them.
- Preserve Pulumi dependency and secret propagation; do not unwrap outputs into planning-time values or log credential-bearing values.
- Keep provider resources, service lifecycle, and stack-specific policy out of this layer unless they are the narrow support resource the adapter exists to create.

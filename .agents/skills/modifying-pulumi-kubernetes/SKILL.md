---
name: modifying-pulumi-kubernetes
description: Use when changing Kubernetes-focused Pulumi under programs/ or src/, including reusable layers, chart or image pins, labels, routes, storage, dependencies, secrets, or rendered resources; produces the smallest correct owning-layer change with typed propagation, preserved Pulumi semantics, and focused source validation.
---

# Modifying Pulumi Kubernetes

Make the smallest correct change at the owning layer and propagate its typed contract to every affected consumer.

## Required Context

1. Read the root [`AGENTS.md`](../../../AGENTS.md), [`programs/AGENTS.md`](../../../programs/AGENTS.md), and the guidance for each affected `src/` layer.
2. Read the owning feature index, specification, implementation, operations, and verification documents under [`docs/`](../../../docs/README.md).
3. Inspect the owning `Pulumi.yaml`, relevant `Pulumi.<stack>.yaml`, program entry point, reusable layers, catalogs, provider resources, outputs, and consumers together.
4. Load the [ownership and validation matrix](references/ownership-and-validation.md) for the changed surfaces.

Use installed planning and making skills for end-to-end change planning and execution. This skill supplies repository-specific Pulumi and Kubernetes modification procedure; it does not provide user authorization.

## Workflow

1. Identify the program, candidate stack, backend, provider, cluster, and resource owner from source. Do not infer a live target from the working directory or stack filename.
2. Place the change in the lowest correct owning layer. Avoid stack-specific policy in reusable code and avoid duplicated reusable behavior in programs.
3. Propagate types and values through config, program, module, component, adapter, and Kubernetes resources. Search all consumers before changing public arguments, outputs, defaults, type tokens, or catalogs.
4. Preserve Pulumi `Input` and `Output` behavior, secret propagation, parentage, providers, dependency ordering, aliases, protection, and replacement semantics.
5. Inspect rendered intent for metadata and pod-template labels, namespaces, selectors, routes, storage, secrets, chart values, image references, and explicit dependencies.
6. Run focused source-only validation.
7. Review the final diff against feature contracts and state checks that were not safely verified.

## Boundaries

- Do not modify `programs/media-server/`; it is a separate Git submodule unless authority for that repository is explicit.
- Never print, decrypt, replace, or move Pulumi secrets, Kubernetes Secret data, kubeconfig content, provider credentials, or secret-bearing outputs. Preserve secure stack values unchanged unless the approved change explicitly owns them.
- Do not hand-edit generated provider output. Follow the owning generation input and require separate authorization for generation or dependency installation.
- Do not commit or push without explicit authorization for that exact Git action.

## Completion

- The owning layer contains the change and every typed consumer remains aligned.
- Pulumi dependencies, secrets, outputs, and replacement-sensitive identities are preserved or intentionally changed by the approved contract.
- Relevant local validation passed; root typecheck is not claimed as coverage for `programs/**`.
- Documentation agrees with tracked implementation, or the remaining discrepancy is explicit and not verified.

## Reference

- [Ownership and validation matrix](references/ownership-and-validation.md) - layer routing, Kubernetes concerns, Pulumi semantics, and evidence limits.

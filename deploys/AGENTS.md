# Index

| Path | Info |
| --- | --- |
| [`README.md`](README.md) | PyInfra deploy organization and repository-local conventions |
| [`../maskfile.md`](../maskfile.md) | Maintained task entry points for inventory and deploy work |
| [`../docs/quality/testing.md`](../docs/quality/testing.md) | Local verification and credentialed-check boundaries |

# Boundaries

- This subtree owns PyInfra deploy entry points, reusable deploy packages, facts, operations, and templates that converge host state.
- `inventory.py` owns host grouping and per-host data. Treat it as sensitive operational configuration and never copy its secret-bearing values into output or documentation.
- Kubernetes resources and service composition belong under `programs/` and `src/`; do not reproduce them as host deploys.

# Contracts

- Preserve PyInfra's two-phase model. Facts are evaluated while planning, so do not branch on state expected to change earlier in the same deploy; gate dependent operations with deferred operation results.
- Keep operations idempotent, privileges explicit, and inventory and host limits deliberate. A destructive filename or an existing task is not authorization to execute it.
- PyInfra check mode, facts, and other dry runs can still connect to hosts or external systems. Authorization to inspect or dry-run does not authorize apply.
- Keep secrets out of command arguments, logs, templates, and generated evidence.

# Hints

- Use the `pyinfra` skill when changing deploys, facts, operations, or reusable deploy packages.
- Prefer local tests for pure planning logic. If verification requires host access, report it as not run unless the target and access were explicitly authorized.

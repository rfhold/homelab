# Index

| Path | Info |
| --- | --- |
| [`../src/adapters/README.md`](../src/adapters/README.md) | Shared connection, storage, and stack-reference boundaries |
| [`../src/components/README.md`](../src/components/README.md) | Reusable Pulumi resource abstractions |
| [`../src/modules/README.md`](../src/modules/README.md) | Higher-level Pulumi compositions |
| [`../docs/quality/testing.md`](../docs/quality/testing.md) | Validation coverage and credentialed-check boundaries |

# Boundaries

- Each direct child with a `Pulumi.yaml` is an independently selected Pulumi project. Its entry point owns top-level composition, stack configuration, providers, and exported stack outputs.
- Reusable behavior belongs in `src/`; keep cluster-, environment-, and stack-specific choices in the owning program.
- `media-server/` is a separate Git submodule. Do not treat it as parent-repository source or modify it without authority for that repository.

# Contracts

- Identify the program, stack, backend, provider, and infrastructure target explicitly before any Pulumi command. Never infer a live target from the current directory or a stack filename alone.
- Stack configuration can contain encrypted secrets. Preserve secure values and never include ciphertext or decrypted values in logs, documentation, or review output.
- Treat exported output names and `StackReference` consumers as cross-stack contracts; find and update consumers when either side changes.
- `pulumi preview` can contact state backends, providers, clusters, and external APIs. Authorization to preview does not authorize apply (`pulumi up`), destroy, refresh, import, or state edits.
- Root TypeScript validation does not include `programs/`; do not report a root typecheck as proof that a program entry point is valid.

# Hints

- Inspect the owning `Pulumi.yaml`, selected `Pulumi.<stack>.yaml`, entry point, and referenced `src/` abstractions together.
- Prefer source-only validation until an explicit target and authorization permit a preview or other live check.

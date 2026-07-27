# Index

| Path | Info |
| --- | --- |
| [`README.md`](README.md) | Repository orientation, setup, and local validation |
| [`docs/README.md`](docs/README.md) | Canonical architecture, feature contracts, operations, quality, and evidence |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Documentation authority and lifecycle rules |
| [`deploys/AGENTS.md`](deploys/AGENTS.md) | PyInfra and host-operation boundaries |
| [`programs/AGENTS.md`](programs/AGENTS.md) | Pulumi micro-stack ownership and mutation boundaries |
| [`docker/AGENTS.md`](docker/AGENTS.md) | Container image classes and validation |
| [`scripts/AGENTS.md`](scripts/AGENTS.md) | Operational script safety |
| [`.tekton/AGENTS.md`](.tekton/AGENTS.md) | Pipeline trigger, dispatch, and release boundaries |
| [`.opencode/AGENTS.md`](.opencode/AGENTS.md) | Agent workflow and external-mutation boundaries |
| [`packages/authentik-provider/AGENTS.md`](packages/authentik-provider/AGENTS.md) | Generated Authentik provider ownership |

# Hints

- Do not add comments unless explicitly requested.
- Follow established patterns in neighboring files and check imports before using libraries.
- Never commit secrets, expose sensitive values, or include secret-bearing command output in documentation.
- Specify return types for public functions.
- Avoid labels such as `New` or `Simplified` in names and descriptions.
- Use Bun instead of Node, npm, or Yarn; Bun is the JavaScript package manager.
- Treat tracked source and configuration as evidence of repository implementation, not proof of live state.
- Keep desired feature contracts, source-verified behavior, historical evidence, and unresolved verification visibly distinct.
- Do not run deployments, live infrastructure commands, workflow dispatches, publication, commits, or pushes without explicit authorization.

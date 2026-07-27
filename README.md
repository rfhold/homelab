# Homelab

Infrastructure as code for K3s clusters, physical hosts, supporting services, and operational tooling. PyInfra owns host provisioning; Pulumi TypeScript micro-stacks own Kubernetes resources and service configuration.

## Start Here

| Document | Covers |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Repository instructions and scoped guidance routing |
| [`docs/README.md`](docs/README.md) | Architecture, feature contracts, operations, quality, and research evidence |
| [`maskfile.md`](maskfile.md) | Executable local and operational task definitions |
| [`deploys/README.md`](deploys/README.md) | Host-provisioning structure and local verification |
| [`src/adapters/README.md`](src/adapters/README.md) | Shared connection and configuration interfaces |
| [`src/components/README.md`](src/components/README.md) | Reusable Pulumi resource abstractions |
| [`src/modules/README.md`](src/modules/README.md) | Compositions of multiple components |

## Repository Layout

| Path | Purpose |
| --- | --- |
| `deploys/` | PyInfra deploys, facts, operations, and host configuration |
| `docker/` | Repository-owned container image definitions |
| `programs/` | Independently deployable Pulumi micro-stacks |
| `src/` | Shared Pulumi adapters, components, modules, providers, and utilities |
| `packages/` | Generated or bridged Pulumi provider packages |
| `grafana/` | Source-controlled dashboards and alert rules |
| `scripts/` | Guarded operational utilities |
| `.tekton/` | Tekton Pipelines as Code definitions |
| `docs/` | Canonical feature documentation and historical evidence |

`programs/media-server/` is a separate Git submodule with its own repository authority.

## Setup

Requirements:

- Bun 1.3.6 or the compatible version declared by `package.json`
- Python 3.13 or later with `uv`
- Pulumi CLI for stack work
- `mask` when using `maskfile.md`

Install local dependencies:

```bash
bun install
uv sync
```

These commands update local dependency environments. They do not authorize previews, deployments, host access, or live infrastructure changes.

## Local Validation

```bash
bun run typecheck
git diff --check
```

Root TypeScript validation covers the paths selected by `tsconfig.json`; it does not prove every `programs/` entry point. See [`docs/quality/testing.md`](docs/quality/testing.md) for coverage and operational boundaries.

## Operations

Commands that contact hosts, clusters, Pulumi backends, registries, DNS, Grafana, or CI systems require an explicit target and authorization. Start with the owning feature documentation under [`docs/`](docs/README.md) and the nearest scoped `AGENTS.md`.

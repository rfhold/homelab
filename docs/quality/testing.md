# Testing And Verification

## Local Checks

| Command | Covers | Does Not Prove |
| --- | --- | --- |
| `bun run typecheck` | TypeScript paths included by `tsconfig.json` | Every program entry point or deployed resources |
| `git diff --check` | Whitespace errors in the diff | Markdown links, factual accuracy, or runtime behavior |

Run only checks relevant to the changed surface. Dependency installation may update local environments and caches.

## Credentialed Checks

Pulumi previews, PyInfra check mode, Kubernetes queries, Grafana queries, DNS queries, and CI inspection may contact external systems or expose operational context. They require an explicit target and authorization. A preview or dry run is not permission to apply changes.

When a required check cannot run safely, record it as not verified. Never substitute an apply, deployment, restart, reconciliation, or publication action for missing validation.

## Evidence

Verification records identify the command or inspection, scope, result, date when relevant, and limits. Source inspection proves tracked configuration only. Historical execution output is not current health evidence.

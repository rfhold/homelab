# Index

| Path | Info |
| --- | --- |
| [`README.md`](README.md) | Documentation routing and authority order |
| [`quality/documentation.md`](quality/documentation.md) | Structure, links, evidence labels, and validation |
| [`research/README.md`](research/README.md) | Historical and external evidence rules |
| `plans/` | Temporary approved execution records; completed plans are deleted |

# Boundaries

- Feature specifications define intended contracts; changing normative behavior requires explicit approval.
- Source-backed prose may describe tracked implementation but must not imply deployment or live health.
- Research, migrations, previews, benchmarks, incidents, and point-in-time outputs are historical evidence unless independently reverified.
- Never copy secrets, secret-bearing configuration, kubeconfig content, tokens, or unredacted command output into documentation.
- Generated documentation remains owned by its generator and is not hand-edited.

# Hints

- Every populated direct child feature of `docs/` has an indexed `README.md` using a `Document | Covers` table; temporary `plans/` scaffolding is exempt and is deleted at close-out.
- Put intended behavior in focused `spec/` files and operational procedures in `operations/` files.
- Put unresolved source, contract, or live-state discrepancies in `verification.md` rather than silently choosing an authority.
- Use repository-relative links and verify paths and anchors after moving content.
- Lifecycle plans are temporary. Migrate durable facts, preserve genuine evidence, and remove completed lifecycle artifacts.

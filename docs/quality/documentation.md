# Documentation Quality

## Structure

- The root `AGENTS.md` routes to scoped guidance.
- `docs/README.md` indexes every feature area.
- Each feature `README.md` indexes its prose, specifications, operations, verification, and evidence.
- Specifications contain enduring intended behavior rather than rollout steps or migration chronology.
- Research records are non-authoritative and identify provenance and supersession.

## Validation

Before close-out:

1. Resolve every relative file link and local heading anchor.
2. Confirm every populated direct-child feature under `docs/` has an indexed `README.md`; temporary `docs/plans/` scaffolding is exempt until it is deleted at close-out.
3. Confirm moved or removed paths have no remaining repository references.
4. Run `git diff --check`.
5. Inspect the complete tracked and untracked result for sensitive values.
6. Compare factual claims with current source and mark unverified live behavior.

Operational examples must state mutation boundaries and use placeholders instead of credentials or secret-bearing output.

---
name: reviewing-changes
description: Use when reviewing a PR, branch diff, staged change, implementation stage, or completed change in this homelab repository; produces a read-only, findings-first review against the correct comparison base, scoped standards, documentation contracts, and available evidence.
---

# Reviewing Changes

Review repository changes without mutation and report actionable defects before summaries.

## Required Context

1. Read the root [`AGENTS.md`](../../../AGENTS.md), then every scoped `AGENTS.md` governing a changed path.
2. Establish the requested comparison base. Include staged, unstaged, and untracked files when the review covers the current worktree; do not silently review only the latest commit.
3. Read [`docs/README.md`](../../../docs/README.md), [`docs/quality/testing.md`](../../../docs/quality/testing.md), and the affected feature index, specification, implementation, operations, and verification documents.
4. Load the [review matrix](references/review-matrix.md) and apply every row relevant to the changed paths.

## Workflow

1. Inventory the complete changed scope against the established base and route each path to its owner and standards.
2. Trace behavior across callers, consumers, generated boundaries, documentation contracts, tests, automation, and operational effects.
3. Distinguish tracked implementation, intended contracts, historical evidence, live evidence, and facts that were not verified.
4. Run only relevant read-only local checks. Treat a passing check as evidence only for the paths and behavior it actually covers.
5. Report findings first, ordered by severity. Each finding identifies the defect and consequence with a precise repository-relative `path:line` reference.
6. After findings, state assumptions, evidence gaps, and not-verified risks. If there are no findings, say so and retain material testing or live-state gaps.

Do not copy a generic findings template. Shape the report around the defects and evidence in the reviewed change.

## Routing

- Use installed planning and making skills for change design or implementation orchestration; this skill does not plan or fix the change under review.
- Use installed infrastructure-inspection, Grafana, GitOps, or Technitium skills only when separately authorized live evidence is required. Repository source and CI definitions do not prove live state.
- Review PyInfra changes with the installed PyInfra skill and its scoped repository guidance; this skill adds the cross-repository review procedure, not PyInfra implementation instructions.

## Boundaries

- Remain read-only: do not edit files, stage changes, update the Git index, create commits, switch or create branches, push, or modify remotes.
- Do not fetch, inspect credentialed CI, query infrastructure, or access any external system without explicit target and authorization.
- Never reveal secret values, encrypted stack values, Kubernetes Secret data, tokens, kubeconfig content, or secret-bearing command output in findings.
- Do not run previews, applies, deployments, reconciliations, restarts, workflow dispatches, publications, or any other external mutation. A review request is not authorization for them.
- Do not treat tool availability, a clean diff, green CI, historical output, or an approved plan as proof that behavior is correct or deployed.

## Completion

- The comparison base, reviewed scope, governing standards, and validation evidence are explicit.
- Findings are severity ordered and use precise `path:line` references.
- Documentation disagreements and unverified behavior are visible rather than inferred away.
- No repository, Git, secret store, CI system, or infrastructure state was mutated.

## Reference

- [Review matrix](references/review-matrix.md) - path routing, repository-specific hazards, and evidence expectations.

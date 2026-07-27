---
name: recovering-technitium-secondary
description: Use ONLY when diagnosing or recovering the Pantheon Technitium secondary, including cluster rejoin or catalog resync; produces a guarded repository-specific recovery path that preserves the Pulumi-owned primary and requires explicit authorization before every write or restart.
---

# Technitium DNS Secondary Recovery

Route Pantheon secondary diagnosis and recovery to the repository's authoritative contract and guarded runbook.

## Use This Skill

Use this local skill only when the request concerns:

- failure isolated to the Pantheon Technitium secondary;
- secondary cluster membership or rejoin;
- secondary catalog expiry, transfer failure, missing members, or resync; or
- recovery of the secondary's persisted configuration under the documented conditions.

For generic Technitium zone, record, block-list, query-log, cache, application, DNS-client, authentication, or API management, use the installed generic `technitium-dns` skill instead. This local skill does not duplicate the generic API manual.

## Required Context

1. Read the current [DNS architecture contract](../../../docs/edge-networking/spec/dns.md).
2. Follow the [Technitium secondary recovery runbook](../../../docs/edge-networking/operations/technitium-secondary-recovery.md) exactly for classification, preconditions, procedure, stop conditions, verification, and sanitized evidence.
3. Use the installed infrastructure-inspection skill for authorized read-only live diagnosis. Use the installed generic `technitium-dns` skill only for API mechanics required by an already selected runbook step.

Repository source describes intended and tracked topology; it does not prove current DNS, cluster, pod, volume, or catalog state.

## Authorization Gates

- Read-only DNS, Kubernetes, log, API, or cluster inspection requires an explicit target and authorization because it contacts external systems and can expose operational context.
- Obtain separate explicit authorization immediately before every DNS API write, Kubernetes write, file quarantine, scale change, restart, rollout, cluster leave, node deletion, rejoin, catalog resync, Pulumi preview, or reconciliation.
- Reconfirm the exact target is the Pantheon secondary before each mutation. Never infer authorization from an incident, loaded credentials, tool access, this skill, or the runbook.
- A preview or read-only diagnosis never authorizes apply, deployment, restart, rejoin, resync, or any other mutation.

## Boundaries

- Preserve the Pulumi-owned topology and primary authority. Never delete or reinitialize the primary cluster, primary zones, or primary catalog.
- Never print, log, store, or include passwords, API tokens, TSIG values, Kubernetes Secret data, config-file contents, kubeconfig content, or secret-bearing command output in evidence.
- Do not improvise generic API changes or bypass the runbook's preconditions, stop conditions, target checks, or primary-health checks.
- Do not run Pulumi apply, deployment, unapproved restart, workflow dispatch, publication, commit, or push. DNS recovery authorization does not authorize Git or repository mutation.

## Completion

- Diagnosis is either read-only or each mutation has its own explicit authorization and recorded target.
- The runbook's primary safety, deployment, cluster, catalog, member-zone, serial, and resolution checks pass, or the procedure stops with sanitized not-verified evidence.
- No secret value is exposed and no action exceeds the Pantheon secondary recovery boundary.

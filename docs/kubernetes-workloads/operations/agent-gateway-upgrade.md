# Agent Gateway v1.7.0 Upgrade and Recovery

## Purpose and authority

Use this runbook for the standalone v1.5.0 to v1.7.0 compatibility upgrade on Pantheon.
It defines a procedure, not evidence of a live upgrade or successful restore.
Live migration duration, mixed-version behavior, and recovery require an authorized rehearsal before rollout.

The source owner is [`programs/agent-gateway`](../../../programs/agent-gateway/index.ts), with the shared [`AgentGateway` component](../../../src/components/agent-gateway.ts).
The [model gateway specification](../spec/model-gateway.md) defines resource ownership and client contracts.
Resolve any version-specific source/specification disagreement before rollout; this runbook does not amend that contract.

Pulumi renders a `k8s.helm.v4.Chart`, not a Helm Release.
Use the owner program for chart and configuration changes.
Upstream `helm upgrade` and `helm rollback` examples do not apply to this resource graph.

## Target and authorization

Before any live check, identify the exact Pulumi backend, project, stack, provider, and Kubernetes context.
Confirm Pantheon independently of the working directory and stack filename.
Obtain exact authorization for inspection, rehearsal, preview, apply, database mutation, and recovery as separate actions.
Authorization for local compatibility changes does not authorize these actions.

| Surface | Expected source target |
| --- | --- |
| Program and stack configuration | `programs/agent-gateway`, [`Pulumi.pantheon.yaml`](../../../programs/agent-gateway/Pulumi.pantheon.yaml) |
| Namespace | `agentgateway-system` |
| Deployment, Service, HTTPRoute | `agent-gateway`; two gateway replicas; Service port `4000` |
| Startup configuration | Chart-generated ConfigMap `agent-gateway-config`; confirm the rendered Deployment reference before rollout |
| Private hostname | `agent-gateway.holdenitdown.net`, through `ingress/default-gateway` |
| Database | Protected `agent-gateway-postgres`; one CloudNativePG instance; `10Gi`; database `agentgateway` |
| Configuration modes | `routeStorageMode: database`, `routingRepresentationMode: first-class`; runtime hybrid storage |

Keep database protection in place.
Treat any database replacement, deletion, or protection change as a stop condition.
Do not print database URLs, provider credentials, key hashes, raw keys, or secret-bearing configuration.

## Recovery prerequisites

1. Record the exact old and target chart/image versions and source revisions.
2. Capture a consistent database backup under separate authorization.
3. Preserve the old startup configuration, database resource configuration, and Pulumi state through approved secret-safe storage.
4. Include UI-owned resources, `llm.apiKey` records, and request logs in the recovery scope.
5. Preserve the four Stashes: `openai-api-key`, `anthropic-api-key`, `chutes-api-key`, and `cerebras-api-key`.
6. Rehearse restore into an isolated target with the old binary and old configuration.
7. Define the recovery point, acceptable data loss, maintenance window, operator, and stop criteria.
8. Confirm that the restore preserves resource IDs, repository attribution, and provider credential references.

A backup alone does not demonstrate recoverability.
Pulumi's database protection does not prevent startup migrations or replace a backup.

### PostgreSQL migration rehearsal

`config.database` also supplies request-log storage unless `config.logging.database` selects another database.
Inspect the effective configuration under authorization to identify every database in scope.

Upstream v1.7 adds request-log analytics columns and backfills older rows from `attributes_json` at startup.
PostgreSQL records migrations `2` and `3` in `_agentgateway_request_log_migrations`.
Large tables can delay startup.

The [v1.7.0 chart startup probe](https://github.com/agentgateway/agentgateway/blob/v1.7.0/controller/install/helm/agentgateway-standalone/templates/deployment.yaml) permits 60 failures, with a one-second period and two-second timeout.
These settings do not establish a safe migration duration.

Rehearse migration against representative database volume and contents.
Measure migration duration, lock contention, restart behavior, and both replicas' startup.
Compare those results with the rendered probe and rollout settings.
If migration exceeds that allowance, stop for a separately reviewed startup strategy.
Do not use repeated production restarts as the migration rehearsal.

### Mixed-version prerequisite

The source dependency order is:

`chart + HTTPRoute -> providers -> concrete models -> virtual models -> legacy routes`

Chart readiness precedes provider resource PUTs.
New processes first read the current database configuration, before Pulumi updates provider URLs and formats.
From v1.6, explicit provider `baseUrl` values require the full API prefix.
Old host-only URLs can therefore route incorrectly on the new binary.

Two replicas do not establish zero-downtime compatibility.
Rehearse old/new binary coexistence against both old and target provider values.
Include resource parsing, configuration reload, request paths, database migrations, and partial Pulumi failure in that rehearsal.
Establish an authorized order or maintenance-window procedure before production apply.
If any transition lacks a compatible configuration, stop; obtain approval for an explicit traffic interruption and recovery procedure.
Do not bypass dependency order through ad hoc provider API writes.

## Compatibility review before rollout

Review the exact proposed source and authorized preview against these invariants:

| Check | Required outcome |
| --- | --- |
| Provider paths | Explicit `baseUrl` includes the intended API prefix; requests neither omit nor duplicate `/v1` |
| Provider formats | Custom providers declare actual upstream capabilities; Messages conversion does not select unsupported Responses |
| Native providers | Native OpenAI and Anthropic semantics remain; Claude Proxy retains its Anthropic contract |
| Model inventory | `llm.discovery: disabled` preserves literal wildcard IDs and exact aliases |
| Resource ownership | Eleven first-class providers, 21 concrete models, two virtual models, and one legacy Bifrost route |
| Migration phases | Embedding phase 2 remains; local-small phase 1 retains its concrete alias and `retainConcreteAlias` |
| UI resources | Undeclared IDs and kinds, especially `llm.apiKey`, survive reconciliation |
| Credentials | Four retained Stashes supply Secret-backed provider references; proxies gain no credential |
| Bifrost | Legacy `/openai/v1/chat/completions` and `bifrost/` prefix removal remain |
| Retry scope | Only `POST /v1/embeddings` with `x-model: local-embedding`; at most two runtime attempts |
| Retry policy | `attempts: 1`, `100ms` backoff, status codes `500`, `502`, `503`, `504`; shared `600s` timeout |
| Local targets | Internal target names stay absent from public inventory; virtual aliases retain their exact upstream models |
| Drain and telemetry | `660s` termination grace; `600s` request/drain budget; readiness `15021`, metrics `15020`, current OTLP destination |

Recheck the target version's retry execution semantics before retention of `attempts: 1`.
Include absent and repeated `x-model` headers in policy verification.
Chat, Responses, and local-small requests retain a single attempt.
This upgrade does not perform alias cleanup or adopt optional features.

With inspection authorization, review UI-owned budgets, policies, MCP resources, and provider overrides for release-specific effects.
Built-in pricing can activate USD budgets that previously lacked cost data.
Resolve any budget effect before rollout; do not delete or change UI-owned budgets implicitly.

In hybrid mode, the new runtime can generate and persist an MCP session key.
If MCP is in use, verify shared-key consistency across replicas and client session renewal in rehearsal.
Any explicit key provisioning or session-policy change requires its own authorization.

## Authorized rollout and verification

1. Confirm that backup, restore, migration, and mixed-version prerequisites pass for the selected target.
2. Review the authorized preview for unexpected replacement, deletion, ownership acquisition, or mode changes.
3. Apply only the approved program change through Pulumi, within the rehearsed rollout procedure.
4. Observe migrations and startup on each replica through authorized, secret-safe inspection.
5. Verify each replica's `/api/runtime` reports `configReload.synchronized: true` and `lastError: null`.
6. Verify the private-host HTTPRoute reports `Accepted=True` and `ResolvedRefs=True`.
7. Compare post-update owned resource IDs and UI-owned IDs with the pre-upgrade baseline.
8. Complete the client checks below before closure.

A successful Service response does not prove that both replicas loaded the target configuration.
Readiness does not prove upstream request compatibility.

| Client check | Expected observation |
| --- | --- |
| `/v1/models` | Literal wildcard families and exact public aliases; no internal virtual targets or unsolicited discovery entries |
| Provider requests | Correct upstream prefix, exact alias mapping, supported Messages/Responses/Chat conversion, preserved TLS SNI |
| Streaming | Clients accept the final usage chunk with empty `choices`, then `[DONE]`; no duplicate generation |
| Token accounting | Normalized prompt, output, and prompt-cache usage retain the client contract |
| Repository attribution | Valid retained keys yield `user: rfhold`, repository `group`, and the expected key name |
| Permissive access | Requests without keys or with invalid placeholder keys retain access without repository attribution |
| Embeddings | Public virtual alias works; authorized failure rehearsal confirms the bounded retry and passive eviction |
| Local-small | Virtual-first coexistence works; both targets retain compatibility; no automatic replay |
| Audio | Exact `/v1/audio/transcriptions` and `/v1/audio/speech` bypass Agent Gateway through workload-owned routes |
| Audio direct hosts | `whisperx.holdenitdown.net` and `kokoro.holdenitdown.net` retain unauthenticated private access |
| UI and logs | Persistent editors work, raw `/api/config` remains read-only, request logs persist, debug administration remains private |

The audio owners remain `rfhold/whisperx-server` and `rfhold/kokoro-server`.
Coordinate audio verification with those owners; this procedure grants no mutation authority in either repository.

## Stop and recover

Stop rollout progression on migration failure, restart loops, configuration reload errors, incompatible paths, resource loss, or unexplained budget rejection.
Retain redacted diagnostics and the last known resource identities.
Escalate to the rollout and database recovery operators with the failed prerequisite or verification check.
Do not delete the database, remove protection, switch storage modes, or remove retained aliases as a repair shortcut.

A chart/image pin reversal alone is not a database-compatible rollback.
Older Agent Gateway binaries fail startup when they encounter unknown PostgreSQL request-log migration records.
Upstream describes removal of migration records `2` and `3`; the new columns remain.
A subsequent upgrade repeats the migrations and backfill, including logs from the downgrade interval.
That remedy addresses migration bookkeeping only, not provider configuration or full hybrid-storage compatibility.
It is not turnkey SQL authorization for this deployment.

For recovery:

1. Obtain explicit authorization for the selected recovery target, database action, and expected data-loss boundary.
2. Quiesce gateway writers through the rehearsed maintenance procedure.
3. Preserve the failed-state database through approved backup procedures.
4. Restore or repair the database using the separately reviewed recovery procedure.
5. Restore compatible startup configuration and persisted resource values alongside the selected binary.
6. Reconcile Pulumi ownership and source through the approved recovery path.
7. Repeat per-replica reload, resource identity, attribution, provider, streaming, and audio verification.

If recovery uses migration-record removal, first demonstrate old-binary schema and configuration compatibility on an isolated restore.
Account explicitly for UI changes, runtime keys, and request logs after the recovery point.

Record versions, target identifiers, backup references, migration duration, per-replica results, and recovery outcomes in the authorized change record.
Keep credentials and secret-bearing payloads out of that record.
Keep live rehearsal gaps open until evidence closes them; local source checks do not close those gaps.

## References

- [Upstream upgrade procedure and storage warnings](https://agentgateway.dev/docs/standalone/latest/operations/upgrade/)
- [Request-log migrations and downgrade limitations](https://agentgateway.dev/docs/standalone/latest/documentation/observability/access-logs/database/)
- [Standalone release notes](https://agentgateway.dev/docs/standalone/latest/release-notes/release-notes/)
- [Model discovery and literal wildcard inventory](https://agentgateway.dev/docs/standalone/latest/documentation/llm/api-types/models/)
- [v1.7.0 release](https://github.com/agentgateway/agentgateway/releases/tag/v1.7.0)
- [Resource-set reconciliation owner](../../../src/providers/agent-gateway/config-resource-set.ts)
- [Workload verification ledger](../verification.md)

The upstream `latest` pages can change; compare their instructions with the selected release before execution.

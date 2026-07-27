# Observability Verification

Source inspection establishes tracked implementation only. This conversion did not run a Pulumi preview, query Kubernetes or Grafana, reconcile alert rules, or inspect live telemetry.

## Open Verification

| Concern | Tracked or historical evidence | Verification still required |
| --- | --- | --- |
| Tempo deployment and drift | Tempo 3 source, topic wiring, component values, and dependency ordering are present; the upgrade lifecycle record ends with planned deployment and zero-drift tasks but contains no execution evidence | Verify the live version and workloads, end-to-end ingestion/query behavior, generated metrics, and an expect-no-changes preview |
| Grafana and Tempo application versions | The desired contract names Grafana `13.1.1` and Tempo `3.0.2`; tracked source pins chart versions but does not encode or render those application versions directly | Inspect a rendered chart or authorized live workload before claiming either application version is running |
| Grafana PostgreSQL storage class | Pantheon source requests three `50Gi` volumes using storage class `shared-fs`; the intended contract requires durable block storage | Establish the storage class semantics or align source and contract through a separately approved change |
| Grafana HA and Git Sync | Source configures two replicas, PostgreSQL, alerting peers, and a write-enabled Git Sync resource | Verify replica coordination, datasource access, direct writes, and repository sync in Grafana |
| Pyroscope and Alloy | Source enables Pyroscope v2-only object storage and Alloy forwarding on port 4040 | Verify endpoint reachability, ingestion from one supported SDK, datasource queries, and absence of unintended direct backend clients |
| Current memory alerts | Four managed rule files match the intended thresholds | Query current managed rule state and notification routing before treating the files as active alerts |
| Alert pipeline trigger | The deployment verification record identifies `.tekton/**` trigger drift | Resolve [`../deployment/verification.md`](../deployment/verification.md) before claiming path isolation |

## Historical Alert Evidence

The `protect-apollo-memory` lifecycle record dated 2026-07-26 reports that all four memory rule files parsed, Grafana reconciled them, the provisioning API returned the expected pending periods and warning severity, and the three new PromQL expressions evaluated successfully. It also reported no active OSD or OOM series and one active swap series at that point in time.

That record is historical evidence, not current Grafana state or notification-delivery proof.

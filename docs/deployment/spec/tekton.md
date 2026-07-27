# Tekton Delivery

## Deployer RBAC

The shared Tekton deployer credentials MUST authorize deployment workflows to get, list, watch, create, update, patch, and delete both `batch/v1` Jobs and CronJobs. CronJob support MUST NOT broaden unrelated API-group permissions.

## PAC Repository Enrollment

When the Pantheon Tekton stack is rendered, its Pipelines as Code repository configuration MUST include both `rfhold/kokoro` and `rfhold/whisperx`. Enrollment does not change provider-wide webhook behavior or PAC global provider configuration.

## Grafana Alert Reconciliation

The deployment platform MUST provide a Pipelines as Code workflow that uses `gcx` to reconcile [`grafana/alert-rules/`](../../../grafana/alert-rules/) with Grafana.

- A push to `main` that changes `grafana/alert-rules/**` or the reconciliation pipeline definition MUST run the workflow.
- Unrelated repository changes MUST NOT trigger the workflow.
- Deleting a tracked rule file MUST remove the corresponding managed rule or rule group when reconciliation succeeds.
- The workflow MUST receive `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, and `GRAFANA_ORG_ID=1` through Kubernetes Secret-backed environment variables. The connection and administrator values MUST come from the existing Grafana stack outputs; the homelab organization ID remains fixed at `1`.
- Basic authentication MUST be sufficient. `GRAFANA_TOKEN` MUST NOT be required, but standard `gcx` token authentication MAY be used when an operator supplies it.

The destructive ordering and exact selectors used for reconciliation are governed by the [alert-rule operation](../../observability/operations/alert-rules.md).

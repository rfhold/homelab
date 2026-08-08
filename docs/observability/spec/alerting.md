# Grafana-Managed Alerting

## Rule Ownership

[`programs/grafana-alerts/`](../../../programs/grafana-alerts/) and [`programs/grafana-recording-rules/`](../../../programs/grafana-recording-rules/) MUST be the authoritative version-controlled sources for Grafana-managed alert and recording rules.

- Each rule file MUST be JSON matching the corresponding Pulumiverse Grafana `AlertRuleArgs` or `RecordingRuleArgs` input directly, without a repository-specific translation schema.
- Expression map values MUST be valid JSON encoded as strings, as required by the provider input. Native expression fields MUST use `datasource_uid`, `relative_time_range`, and `query_type` rather than the camelCase fields from the retired export format.
- Rules MUST use the stable shared domain-folder UIDs owned by [`programs/grafana-dashboards/`](../../../programs/grafana-dashboards/).
- All applicable rules formerly provisioned into Mimir MUST remain represented, while Mimir ruler capability remains available for future use. The optional-feature exclusion below defines when a former rule is not applicable.
- Removing a rule file and successfully applying its stack MUST remove the corresponding Pulumi resource.

Contact points, notification policies, and Grafana alerting HA configuration remain outside this file-ownership contract.

## Evaluation Efficiency

- External Mimir range expressions in Grafana-managed alerts MUST use a query interval of at least 60 seconds unless a rule documents and validates a need for finer resolution.
- Recording rules MUST evaluate no more frequently than every three minutes unless a downstream freshness contract requires a shorter interval.
- Rules for optional platform features MUST NOT be managed when those features are absent from the tracked deployment.
- Query-resolution changes MUST preserve each alert's PromQL expression, relative query window, pending period, and notification labels unless a separately approved behavior change states otherwise.

## Reconciliation

The content projects MUST construct independent Grafana providers from the runtime stack's API URL and administrator outputs. The dashboard stack MUST be applied before either rule stack. No reverse-export script, dedicated Tekton reconciliation pipeline, or automatic main-branch apply is required. Direct Grafana edits are drift and MUST NOT be treated as an authoring workflow.

## Memory Warnings

Existing Grafana notification routing MUST receive warning-severity alerts for these conditions:

| Alert | Condition | Pending period |
| --- | --- | --- |
| Ceph OSD memory | A monitored Pantheon OSD exceeds 12 GiB working-set memory and identifies its OSD and node | 10 minutes |
| Node memory | A monitored node exceeds 85 percent physical-memory utilization and identifies the node | 10 minutes |
| Node swap | A monitored node exceeds 50 percent swap utilization and identifies the node | 10 minutes |
| Node OOM kill | A monitored node reports an OOM kill within the five-minute evaluation window and identifies the node | No sustained pending period required |

Brief OSD, memory, or swap spikes that recover before their pending periods expire MUST NOT fire the corresponding sustained warning.

All four rules MUST evaluate once per minute against the Mimir datasource and retain warning severity and existing notification routing.

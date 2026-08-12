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

## Served TLS Certificates

Pantheon and Romulus MUST discover live TLS Kubernetes Ingress hosts in the approved public domains and probe each exact host on port 443 every minute. The probe MUST use the hostname for TLS SNI, inspect the certificate actually served by the endpoint without requiring trust validation, preserve cluster and endpoint as alert identity, and retain source namespace and Ingress labels for diagnosis. Wildcard host declarations and non-Ingress route APIs are outside this coverage.

The critical alert MUST fire when the served certificate has at most 7 days remaining; the warning MUST fire above 7 and at most 14 days remaining. Both require five sustained minutes. Missing probe data MUST remain a distinct no-data state rather than being interpreted as certificate expiry.

## Memory Warnings

Existing Grafana notification routing MUST receive warning-severity alerts for these conditions:

| Alert | Condition | Pending period |
| --- | --- | --- |
| Ceph OSD memory | A monitored Pantheon OSD exceeds 12 GiB RSS memory and identifies its OSD and node | 10 minutes |
| Node memory | A monitored node exceeds 85 percent physical-memory utilization and identifies the node | 10 minutes |
| Node swap | A monitored node exceeds 50 percent swap utilization with active paging over the 15-minute evaluation window and identifies the node | 10 minutes |
| Node OOM kill | A monitored node reports an OOM kill within the five-minute evaluation window and identifies the node | No sustained pending period required |

Brief OSD, memory, or swap spikes that recover before their pending periods expire MUST NOT fire the corresponding sustained warning.

All four rules MUST evaluate once per minute against the Mimir datasource and retain warning severity and existing notification routing.

## OpenBao Backup And DR Alerts

Repository-owned Grafana rules MUST cover these conditions:

| Alert | Condition |
| --- | --- |
| Snapshot freshness | No completed OpenBao snapshot exists within two hours |
| Snapshot Job failure | The snapshot Job reports failure |
| Snapshot deadline | The snapshot Job exceeds its bounded deadline |
| Retention execution | The retention Job fails, remains active beyond 1800 seconds, or its CronJob has no successful completion within 48 hours |
| DR activity | The Romulus `openbao-dr` workload has active replicas |
| Backup quota | The dedicated backup bucket approaches or reaches its quota |

Rules MUST use explicit sanitized metrics or logs. Queries MUST NOT parse or expose secret values, snapshot data, credentials, private age material, or Shamir shares. Source MUST document any signal that remains unavailable or unverified.

Tracked source currently contains five Kubernetes-folder rules: snapshot freshness, snapshot Job failure, snapshot Job deadline, retention execution, and DR activity. The retention rule MUST treat no data as alerting so a never-successful CronJob is visible after reconciliation. These queries have source review only and do not establish live reconciliation or signal validity.

The retention rule measures execution freshness, failure, and deadline only. No tracked telemetry reports the age of objects in the backup bucket, so source MUST NOT claim that Grafana detects S3 objects older than the intended 30-day retention period. Live object-age alerting and the backup-quota rule remain deferred until authorized evidence verifies suitable object-storage or Ceph metrics and labels; source MUST NOT invent or guess them.

The DR-activity alert MUST remain active in every phase. An approved `restore` or `test` window MUST use a separately governed alert silence. A phase change MUST NOT disable or delete the rule.

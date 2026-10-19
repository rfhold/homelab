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

## NVIDIA GPU Availability

`NodeGPUUnavailable` MUST warn when a Pantheon node reports positive NVIDIA GPU capacity but no positive allocatable GPU value for five sustained minutes.
The rule MUST evaluate once per minute through the `mimir` datasource in the shared `node` folder.
It MUST retain `cluster` and `node` as alert identity and use warning severity with current notification routing.

The expression MUST aggregate capacity and allocatable metrics with `max by (cluster, node)` before comparison to remove duplicate scrape labels.
It MUST select `cluster="pantheon"`, `resource="nvidia_com_gpu"`, and `unit="integer"` from both kube-state-metrics families.
Positive capacity MUST survive unless the same cluster and node have positive allocatable GPUs.
Healthy GPU nodes and nodes without positive GPU capacity MUST produce no alert series.

The rule MUST use `noDataState: Ok`, consistent with sibling node rules.
It does not cover a node when both capacity and allocatable metrics are absent.
Diagnosis MUST check host `nvidia-smi`, a loaded-driver/installed-library mismatch, and the NVIDIA device-plugin.
Any necessary reboot requires a separate plan with Ceph safety checks before a host restart.

# Grafana-Managed Alerting

## Rule Ownership

[`grafana/alert-rules/`](../../../grafana/alert-rules/) MUST be the authoritative version-controlled source for Grafana-managed alert and recording rules. Files MUST use a Grafana-native format accepted by `gcx`.

- All rules formerly provisioned into Mimir MUST have equivalent managed files in this tree.
- The Grafana stack MUST NOT provision those files into Mimir, while Mimir ruler capability remains available for future use.
- Removing a file and successfully reconciling MUST remove its corresponding managed resource from Grafana.

Contact points, notification policies, and Grafana alerting HA configuration remain outside this file-ownership contract.

## State Export

The repository MUST provide an operator script that exports managed Grafana alert and recording rules into `grafana/alert-rules/` without committing or pushing changes. It MUST use standard `gcx` variables: `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, `GRAFANA_ORG_ID=1`, and optional `GRAFANA_TOKEN`.

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

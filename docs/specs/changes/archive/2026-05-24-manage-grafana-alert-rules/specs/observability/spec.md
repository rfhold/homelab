## Change Overview

- **Why**: Alert rule ownership currently flows through Mimir rule files and Pulumi wiring, but operators need Grafana-managed alert rules stored as Grafana-native files so rule changes can be reviewed, imported, exported, and reconciled independently of the observability stack deployment.
- **Impact**: Existing Mimir alert and recording rules will be migrated into Grafana-managed alert rule files under `grafana/alert-rules/`. The observability stack will stop provisioning alert rules into Mimir while keeping Mimir ruler capability available for future use. Operators will have a script to export Grafana's current alert-rule state back to the repository files.
- **Non-goals**: This change does not manage Grafana contact points, notification policies, dashboard Git Sync behavior, Grafana datasource ownership, Grafana alerting high availability runtime settings, or removal of the Mimir ruler service itself.
- **Rollback**: Revert the alert rule files, restore the Mimir alert-rule Pulumi wiring and source rule files from version control, and rerun the observability stack deployment to return rule ownership to Mimir.

## ADDED Requirements

### Requirement: Grafana Managed Alert Rule Files
The observability platform MUST store Grafana-managed alert rule definitions as Grafana-native files under `grafana/alert-rules/`.

#### Scenario: Alert rule files are the source of truth
Given operators manage Grafana alert rules for the homelab observability platform
When alert rule definitions are changed in version control
Then the system MUST treat `grafana/alert-rules/` as the authoritative source for Grafana-managed alert rules
And the system MUST store those definitions in a Grafana-native format compatible with `gcx`

#### Scenario: Removed files remove rules
Given a Grafana-managed alert rule or rule group exists in Grafana from a file under `grafana/alert-rules/`
When the corresponding file is removed and the alert-rule reconciliation workflow runs
Then the system MUST remove the corresponding Grafana-managed alert rule or rule group from Grafana

### Requirement: Mimir Alert Rule Migration
The observability platform MUST migrate all currently provisioned Mimir alert rules into Grafana-managed alert rule files and MUST stop provisioning those rules into Mimir through Infrastructure as Code.

#### Scenario: Existing Mimir rules become Grafana rules
Given Mimir alert or recording rules are currently provisioned by the observability stack
When the migration to Grafana-managed alert rules is implemented
Then the system MUST create equivalent Grafana-managed alert rule definitions under `grafana/alert-rules/`
And the system MUST include all currently provisioned Mimir rule groups in the migration

#### Scenario: Mimir rule provisioning is removed
Given alert rules have been migrated into Grafana-managed alert rule files
When the observability stack is provisioned
Then the system MUST NOT wire those alert rule files into Mimir rule provisioning
And the system MUST keep Mimir ruler capability available for future use

### Requirement: Grafana Alert Rule State Export
The observability platform MUST provide an operator script that exports the current Grafana-managed alert rule state into `grafana/alert-rules/` without committing or pushing changes.

#### Scenario: Operator syncs Grafana state to files
Given Grafana contains managed alert rules
When an operator runs the alert-rule sync script with standard Grafana connection environment variables
Then the system MUST write the current Grafana-managed alert rule state into `grafana/alert-rules/`
And the system MUST NOT commit or push the resulting file changes

#### Scenario: Standard Grafana connection variables
Given an operator or automation runs the alert-rule sync script
When the script connects to Grafana through `gcx`
Then the system MUST rely on standard Grafana environment variables including `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, and optional `GRAFANA_TOKEN`
And the system MUST NOT require custom repository-specific Grafana credential variable names

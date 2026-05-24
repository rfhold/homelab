## Change Overview

- **Why**: `gcx` alert-rule sync needs the Grafana organization context, and the homelab Grafana organization ID is `1`.
- **Impact**: Local Grafana alert-rule sync and apply scripts will run with `GRAFANA_ORG_ID=1` in addition to the existing Grafana server and authentication variables.
- **Non-goals**: This change does not alter Grafana alert-rule ownership, rule file format, Mimir ruler behavior, contact points, or notification policies.
- **Rollback**: Remove `GRAFANA_ORG_ID=1` from the alert-rule scripts and Tekton credential wiring if `gcx` no longer requires an explicit organization ID.

## MODIFIED Requirements

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
Then the system MUST rely on standard Grafana environment variables including `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, `GRAFANA_ORG_ID=1`, and optional `GRAFANA_TOKEN`
And the system MUST NOT require custom repository-specific Grafana credential variable names

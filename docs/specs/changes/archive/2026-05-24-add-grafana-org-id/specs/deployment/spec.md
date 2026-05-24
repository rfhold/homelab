## Change Overview

This domain extends the primary change overview in `../observability/spec.md` with Tekton Pipeline-as-Code requirements for the Grafana organization ID.

## MODIFIED Requirements

### Requirement: Grafana Credentials For Alert Rule Pipelines
The deployment platform MUST provide Grafana admin basic-auth connection variables to Pipelines-as-Code workflows that reconcile Grafana-managed alert rules.

#### Scenario: Tekton exposes Grafana basic auth variables
Given the Tekton stack is provisioned
When the alert-rule reconciliation workflow runs through Pipelines-as-Code
Then the system MUST provide `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, and `GRAFANA_ORG_ID=1` from the existing Grafana stack outputs and fixed homelab organization ID
And the system MUST make those values available to the workflow as Kubernetes Secret-backed environment variables

#### Scenario: Service account token is not required
Given Grafana admin basic auth variables are available to the alert-rule reconciliation workflow
When the workflow invokes `gcx`
Then the system MUST NOT require `GRAFANA_TOKEN` to be set
And the system MAY use `GRAFANA_TOKEN` only when an operator supplies one through standard `gcx` environment handling

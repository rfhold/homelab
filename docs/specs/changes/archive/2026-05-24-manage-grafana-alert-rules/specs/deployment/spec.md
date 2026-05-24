## Change Overview

This domain extends the primary change overview in `../observability/spec.md` with Tekton Pipeline-as-Code requirements for applying Grafana-managed alert rule files.

## ADDED Requirements

### Requirement: Grafana Alert Rule Reconciliation Pipeline
The deployment platform MUST run a Tekton Pipelines-as-Code workflow that reconciles Grafana-managed alert rules from `grafana/alert-rules/` with Grafana by using `gcx`.

#### Scenario: Path-filtered alert rule reconciliation
Given changes are pushed to the homelab repository main branch
When the pushed changes include files under `grafana/alert-rules/`
Then the system MUST run a Tekton Pipelines-as-Code workflow to reconcile Grafana-managed alert rules with Grafana
And the system MUST NOT require unrelated repository changes to run the alert-rule reconciliation workflow

#### Scenario: File deletions are reconciled
Given a rule file under `grafana/alert-rules/` was previously applied to Grafana
When that file is removed on the main branch and the reconciliation workflow runs
Then the system MUST reconcile Grafana so the removed file no longer leaves an active Grafana-managed alert rule or rule group behind

### Requirement: Grafana Credentials For Alert Rule Pipelines
The deployment platform MUST provide Grafana admin basic-auth connection variables to Pipelines-as-Code workflows that reconcile Grafana-managed alert rules.

#### Scenario: Tekton exposes Grafana basic auth variables
Given the Tekton stack is provisioned
When the alert-rule reconciliation workflow runs through Pipelines-as-Code
Then the system MUST provide `GRAFANA_SERVER`, `GRAFANA_USER`, and `GRAFANA_PASSWORD` from the existing Grafana stack outputs
And the system MUST make those values available to the workflow as Kubernetes Secret-backed environment variables

#### Scenario: Service account token is not required
Given Grafana admin basic auth variables are available to the alert-rule reconciliation workflow
When the workflow invokes `gcx`
Then the system MUST NOT require `GRAFANA_TOKEN` to be set
And the system MAY use `GRAFANA_TOKEN` only when an operator supplies one through standard `gcx` environment handling

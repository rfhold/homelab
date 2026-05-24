# Deployment Capability Spec

Stable spec at `docs/specs/deployment/spec.md`. Source of truth. Edited only by the `code-review` skill during delta merge.

## Purpose

## Requirements

### Requirement: Generic Bun CI Image

The system MUST provide a generic Bun CI container image for repository workflows that need Bun plus SSH-capable Git operations.

#### Scenario: Bun CI tooling is available

Given a workflow uses the generic Bun CI image
When the workflow starts a shell step inside the image
Then the system MUST provide `bun`, `git`, `ssh`, and CA certificates in the image

#### Scenario: Pinned Bun base image

Given the generic Bun CI image definition is inspected
When the image base is resolved
Then the system MUST use a pinned `oven/bun:1.3` base image

#### Scenario: Internal package mirrors configured

Given the generic Bun CI image definition is inspected
When operating system or Bun package dependencies are installed or resolved
Then the system MUST use the internal package mirrors for supported package sources

### Requirement: Bun CI Image Build Pipeline

The system MUST build and publish the generic Bun CI image from homelab using the existing Tekton BuildKit image build pattern.

#### Scenario: Bun CI image pipeline publishes to rfhold registry namespace

Given the Bun CI image build pipeline runs on the homelab main branch
When the BuildKit build task publishes the image
Then the system MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/bun-ci:latest`

#### Scenario: Bun CI image pipeline is scoped to image changes

Given the Bun CI Dockerfile or its build pipeline changes
When the changes are pushed to the homelab main branch
Then the system MUST run the Bun CI image build pipeline
And the system MUST NOT require unrelated homelab changes to build the image

### Requirement: Generic Tauri E2E CI Image

The system MUST provide a generic Tauri e2e CI container image for repository workflows that run Tauri desktop WebDriver tests in Linux CI.

#### Scenario: Tauri e2e tooling is available

Given a workflow uses the generic Tauri e2e CI image
When the workflow starts a shell step inside the image
Then the system MUST provide Bun, Rust/Cargo, Git, SSH, CA certificates, Tauri Linux build dependencies, WebKit/GTK runtime dependencies, Xvfb headless display support, and a Docker CLI in the image

#### Scenario: Image supports DinD consumers

Given a workflow uses the generic Tauri e2e CI image with a Docker-in-Docker sidecar
When the workflow configures Docker client environment variables for the sidecar
Then the system MUST provide Docker client tooling capable of talking to the sidecar
And the image MUST NOT require its own Docker daemon to be running inside the step container

#### Scenario: Internal package mirrors configured

Given the generic Tauri e2e CI image definition is inspected
When operating system or Bun package dependencies are installed or resolved
Then the system MUST use the internal package mirrors for supported package sources

### Requirement: Tauri E2E CI Image Build Pipeline

The system MUST build and publish the generic Tauri e2e CI image from homelab using the existing Tekton BuildKit image build pattern.

#### Scenario: Tauri e2e CI image pipeline publishes to rfhold registry namespace

Given the Tauri e2e CI image build pipeline runs on the homelab main branch
When the BuildKit build task publishes the image
Then the system MUST publish `{{ CONTAINER_REGISTRY }}/rfhold/tauri-e2e-ci:latest`

#### Scenario: Tauri e2e CI image pipeline is scoped to image changes

Given the Tauri e2e CI Dockerfile or its build pipeline changes
When the changes are pushed to the homelab main branch
Then the system MUST run the Tauri e2e CI image build pipeline
And the system MUST NOT require unrelated homelab changes to build the image

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
Then the system MUST provide `GRAFANA_SERVER`, `GRAFANA_USER`, `GRAFANA_PASSWORD`, and `GRAFANA_ORG_ID=1` from the existing Grafana stack outputs and fixed homelab organization ID
And the system MUST make those values available to the workflow as Kubernetes Secret-backed environment variables

#### Scenario: Service account token is not required
Given Grafana admin basic auth variables are available to the alert-rule reconciliation workflow
When the workflow invokes `gcx`
Then the system MUST NOT require `GRAFANA_TOKEN` to be set
And the system MAY use `GRAFANA_TOKEN` only when an operator supplies one through standard `gcx` environment handling

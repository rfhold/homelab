# Observability Delta Spec

Delta spec at `docs/specs/changes/sync-grafana-dashboards-from-git/specs/observability/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

Grafana 13 provides Git Sync as the supported workflow for managing dashboards and folders as code. The homelab Grafana deployment should use that workflow so dashboard changes are stored in the existing homelab repository and can be edited from Grafana without requiring separate dashboard provisioning files.

### Impact

- **Breaking changes**: Existing Pulumi-managed dashboard provisioning is replaced for dashboards and folders that move under Git Sync ownership.
- **Migration**: Dashboard definitions move into the homelab repository under `grafana/`, and Grafana Git Sync is configured to synchronize that path with direct write access.
- **Cross-change dependencies**: none

### Non-goals

- Managing Grafana datasources, alerts, notification policies, contact points, plugins, users, or organization settings through Git Sync.
- Adding pull request or branch-based review workflows for Grafana-originated dashboard edits.
- Moving dashboards to a repository outside the homelab repository.
- Adding webhook-based instant synchronization.

### Rollback

Rollback is performed by disabling or removing the Grafana Git Sync repository resource and restoring the prior dashboard provisioning path. The `grafana/` dashboard files can remain in the homelab repository for inspection or later re-enablement.

---

## MODIFIED Requirements

### Requirement: Current Grafana Runtime
The observability platform MUST deploy Grafana using the selected current Grafana Helm chart, application runtime, and Pulumi provider capability while preserving existing operator access, observability integrations, and high availability runtime configuration.

#### Scenario: Grafana dashboard access after upgrade
Given the Grafana Helm chart is upgraded
When operators access the Grafana service
Then the system MUST provide Grafana dashboard access with the configured administrator credentials
And the system MUST preserve provisioned observability datasource access

#### Scenario: Grafana rendering support after upgrade
Given image rendering is enabled for Grafana
When the Grafana Helm chart is upgraded
Then the system MUST continue to configure the Grafana image renderer sidecar

#### Scenario: Grafana replica availability
Given the observability stack is deployed on the pantheon cluster
When Grafana is provisioned
Then the system MUST run two Grafana application replicas
And the system MUST keep Grafana service access available through a single service endpoint

#### Scenario: Grafana Git Sync provider support
Given Grafana 13 Git Sync resources are required
When the observability stack is provisioned with Pulumi
Then the system MUST use a Grafana Pulumi provider version or schema that can manage Grafana Git Sync repository resources

## ADDED Requirements

### Requirement: Grafana Git-Synced Dashboards
The observability platform MUST manage Grafana dashboards and folders through Grafana Git Sync using the homelab repository path `grafana/`.

#### Scenario: Homelab repository dashboard sync
Given the observability stack is deployed on the pantheon cluster
When Grafana Git Sync is configured
Then the system MUST synchronize dashboards and folders from the homelab repository path `grafana/`
And the system MUST NOT require a separate dashboard repository

#### Scenario: Direct dashboard writes
Given an operator edits a Git-synced dashboard in Grafana
When the operator saves the dashboard through the Grafana UI
Then the system MUST allow Grafana to write the dashboard change directly to the homelab repository
And the system MUST NOT require a pull request workflow for Grafana-originated dashboard edits

#### Scenario: Dashboard provisioning ownership
Given dashboards and folders are managed by Grafana Git Sync
When the observability stack provisions Grafana resources
Then the system MUST NOT also manage those dashboards and folders through the prior dashboard provisioning mechanism
And the system MUST continue to manage datasources, authentication, database configuration, alerting runtime configuration, and Grafana deployment settings outside Git Sync

### Requirement: Grafana Git Sync Token Stash
The observability platform MUST source Grafana Git Sync Git authentication from `FORGEJO_ACCESS_TOKEN` through a Pulumi Stash-backed secret.

#### Scenario: Initial token capture
Given `FORGEJO_ACCESS_TOKEN` is set in the Pulumi deployment environment
When the observability stack provisions Grafana Git Sync
Then the system MUST capture the token in a Pulumi Stash input as a secret
And the system MUST use the stashed secret output for Grafana Git Sync repository authentication

#### Scenario: Subsequent deployments without token environment
Given the Git Sync token was captured by Pulumi Stash during a previous deployment
When a later Pulumi deployment runs without `FORGEJO_ACCESS_TOKEN` set
Then the system MUST reuse the stashed token output for Grafana Git Sync repository authentication
And the system MUST NOT require the operator to provide `FORGEJO_ACCESS_TOKEN` again

#### Scenario: Token secrecy
Given Grafana Git Sync repository authentication is configured
When Pulumi stores or passes the Git authentication token
Then the system MUST treat the token as secret material
And the system MUST NOT expose the token in non-secret stack outputs or Kubernetes ConfigMaps

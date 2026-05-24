# Observability Delta Spec

Delta spec at `docs/specs/changes/upgrade-grafana-pyroscope/specs/observability/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

The observability stack should move Grafana and Pyroscope to the current supported chart and application versions. Grafana receives the latest available dashboard and datasource application release, and Pyroscope moves to the v2 storage architecture instead of continuing to operate the v1 storage path.

### Impact

- **Breaking changes**: Pyroscope profile data written before the v2 cutover is not required to remain queryable after the v1 storage components are removed.
- **Migration**: Operators perform a wholesale Pyroscope v2 cutover rather than dual-writing to v1 and v2 storage.
- **Cross-change dependencies**: none

### Non-goals

- Preserving query access to historical Pyroscope v1 profile data after the v2 cutover.
- Running a dual-write Pyroscope migration window.
- Changing application profiling SDK adoption requirements.
- Upgrading Alloy, Loki, Mimir, or Tempo.

### Rollback

Rollback is performed by reverting the Grafana and Pyroscope chart version and value changes. Pyroscope rollback restores the v1 storage path for data that remained in v1 object storage, but profiles written only after the v2-only cutover are not required to be visible through the restored v1 path.

---

## MODIFIED Requirements

### Requirement: Production Profiling Backend
The observability platform MUST deploy a continuous profiling backend on the pantheon cluster with durable object storage, separate read and write endpoints, and v2-only Pyroscope storage.

#### Scenario: Persistent profiling storage
Given the observability stack is deployed on the pantheon cluster
When the profiling backend is provisioned
Then the system MUST persist profile data in shared object storage rather than ephemeral pod storage
And the system MUST expose a write endpoint for profile ingestion
And the system MUST expose a read endpoint for profile queries

#### Scenario: Grafana query access
Given the profiling backend is deployed
When Grafana provisions observability datasources
Then the system MUST provision a Pyroscope datasource that queries the profiling backend through Grafana proxy access

#### Scenario: Pyroscope v2 storage cutover
Given the profiling backend is upgraded to Pyroscope 2.x
When the Pyroscope chart is deployed
Then the system MUST enable v2 storage
And the system MUST disable v1 storage
And the system MUST NOT require dual-writing profile data to both v1 and v2 storage paths

#### Scenario: Historical profile queryability
Given profile data was written before the Pyroscope v2-only cutover
When the v1 storage components are disabled
Then the system MUST NOT require that historical v1 profile data remain queryable through Pyroscope

## ADDED Requirements

### Requirement: Current Grafana Runtime
The observability platform MUST deploy Grafana using the selected current Grafana Helm chart and application runtime while preserving existing operator access and observability integrations.

#### Scenario: Grafana dashboard access after upgrade
Given the Grafana Helm chart is upgraded
When operators access the Grafana service
Then the system MUST provide Grafana dashboard access with the configured administrator credentials
And the system MUST preserve provisioned observability datasource access

#### Scenario: Grafana rendering support after upgrade
Given image rendering is enabled for Grafana
When the Grafana Helm chart is upgraded
Then the system MUST continue to configure the Grafana image renderer sidecar

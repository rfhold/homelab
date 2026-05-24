# Observability Delta Spec

Delta spec at `docs/specs/changes/make-grafana-ha-postgres/specs/observability/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

Grafana currently runs as a single instance with local application state under the pod filesystem. The observability platform needs Grafana to tolerate pod loss and coordinate alert evaluation across replicas.

### Impact

- **Breaking changes**: none
- **Migration**: Grafana application state moves from the chart's local database to a CloudNativePG-backed PostgreSQL database; existing local SQLite state is not migrated.
- **Cross-change dependencies**: none

### Non-goals

- Migrating historical Grafana local SQLite state.
- Changing Mimir, Loki, Tempo, Pyroscope, or Alloy behavior.
- Creating a shared platform-wide PostgreSQL service outside the Grafana stack.

### Rollback

Rollback is performed by reverting the Grafana database, replica, and alerting HA configuration changes. PostgreSQL resources created for Grafana can be retained for inspection or removed after Grafana is returned to its prior local database configuration.

---

## MODIFIED Requirements

### Requirement: Current Grafana Runtime
The observability platform MUST deploy Grafana using the selected current Grafana Helm chart and application runtime while preserving existing operator access, observability integrations, and high availability runtime configuration.

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

## ADDED Requirements

### Requirement: Grafana PostgreSQL Backend
The observability platform MUST store Grafana application state in a clustered CloudNativePG PostgreSQL backend instead of the Grafana pod filesystem.

#### Scenario: Grafana database provisioning
Given the observability stack is deployed on the pantheon cluster
When Grafana is provisioned
Then the system MUST provision a CloudNativePG PostgreSQL database for Grafana application state
And the system MUST configure Grafana to use that PostgreSQL database
And the system MUST NOT rely on pod-local storage as the authoritative Grafana application database

#### Scenario: Clustered PostgreSQL durability
Given the Grafana PostgreSQL backend is provisioned
When the database cluster is created
Then the system MUST run three CloudNativePG instances
And the system MUST allocate 10Gi of durable block storage for each PostgreSQL instance

### Requirement: Grafana Alerting High Availability
The observability platform MUST configure Grafana alerting so multiple Grafana replicas coordinate alert evaluation and notification delivery as one high availability group.

#### Scenario: Alerting replica coordination
Given Grafana is running with multiple application replicas
When Grafana evaluates alert rules
Then the system MUST configure the replicas to coordinate alerting through Grafana high availability clustering
And the system MUST NOT allow the replicas to operate as isolated alerting instances

#### Scenario: Alerting continuity during pod replacement
Given one Grafana application replica is unavailable
When alert rules continue to be evaluated
Then the system MUST allow the remaining Grafana replica to continue participating in alert evaluation and notification delivery

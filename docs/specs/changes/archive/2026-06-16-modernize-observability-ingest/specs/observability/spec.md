# Observability Delta Spec

Delta spec at `docs/specs/changes/modernize-observability-ingest/specs/observability/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

The observability stack currently deploys Tempo, Loki, and Mimir without fully matching the current Grafana guidance for modern ingest architectures. Mimir is pinned to a Mimir 3 era chart but explicitly disables ingest storage and Kafka. Tempo is deployed in distributed mode but does not configure the current Kafka-backed write path described by upstream Tempo architecture. Loki is already distributed with object storage, but its chart source and versioning need to follow the current OSS maintenance path.

This change modernizes the backend ingest architecture while preserving the existing Grafana and Alloy-facing operational model.

### Impact

- **Breaking changes**: none intended for application telemetry clients or Grafana users
- **Migration**: operators need to deploy the Strimzi operator program before applying the observability stack changes
- **Contract surfaces**: `src/components/mimir.ts`, `src/components/tempo.ts`, `src/components/loki.ts`, `src/modules/grafana-stack.ts`, `src/helm-charts.ts`, `programs/grafana/index.ts`, `programs/grafana/Pulumi.pantheon.yaml`
- **Cross-change dependencies**: architecture delta in `docs/specs/changes/modernize-observability-ingest/specs/architecture/spec.md`

### Non-goals

- Force Loki onto Kafka or data-object storage features while upstream production guidance continues to center on distributed microservices with object storage.
- Replace Pantheon Ceph object storage for Mimir, Loki, Tempo, or Grafana.
- Change public Grafana or telemetry hostnames.
- Change Grafana datasource tenant headers unless required by chart upgrades.

### Rollback

Rollback is a revert of the observability stack changes after traffic has drained from the new Kafka-backed ingest paths. Long-term object storage remains the durable backing store, so rollback must preserve existing buckets and avoid deleting Kafka topics until operators confirm no backend still consumes them.

---

## ADDED Requirements

### Requirement: Current Observability Backend Charts
The observability platform MUST deploy Tempo, Loki, and Mimir from current maintained Helm chart sources selected for OSS operation.

#### Scenario: Mimir chart freshness
Given the observability stack is deployed on the pantheon cluster
When Mimir is provisioned
Then the system MUST use a maintained Mimir distributed chart version compatible with the selected Mimir application architecture
And the system MUST NOT pin Mimir to an older patch release when a newer stable patch release is selected for the change

#### Scenario: Loki OSS chart source
Given the observability stack is deployed for OSS Loki
When Loki is provisioned
Then the system MUST use the current OSS-maintained Loki chart source
And the system MUST NOT rely on a chart source that upstream identifies as maintained for Grafana Enterprise Logs only

#### Scenario: Tempo chart freshness
Given the observability stack is deployed on the pantheon cluster
When Tempo is provisioned
Then the system MUST use a maintained Tempo distributed chart source and version that supports the selected Kafka-backed distributed architecture

### Requirement: Shared Observability Kafka Cluster
The observability platform MUST provision one shared Strimzi-managed Kafka cluster for observability backend ingest paths that require Kafka.

#### Scenario: Shared backend dependency
Given the observability stack is deployed on the pantheon cluster
When Kafka-backed observability backends are provisioned
Then the system MUST create a single Kafka cluster for observability ingest
And the system MUST configure both Mimir and Tempo to use that cluster instead of deploying independent Kafka clusters

#### Scenario: Backend-owned topics
Given the shared observability Kafka cluster exists
When Mimir and Tempo are provisioned
Then the system MUST provision or configure distinct Kafka topics for each backend's ingest data
And the system MUST avoid sharing one topic between Mimir and Tempo data paths

#### Scenario: Object storage remains durable backend storage
Given the shared observability Kafka cluster is used for ingest
When Mimir, Tempo, and Loki store durable telemetry data
Then the system MUST continue to use the configured Pantheon object storage buckets for long-term backend storage
And the system MUST NOT replace object storage durability with Kafka retention

### Requirement: Mimir Ingest Storage
The observability platform MUST run Mimir using ingest storage backed by the shared observability Kafka cluster.

#### Scenario: Mimir Kafka ingest path
Given the shared observability Kafka cluster is available
When Mimir is deployed
Then the system MUST enable Mimir ingest storage
And the system MUST configure Mimir distributors and ingesters to use the shared observability Kafka cluster

#### Scenario: Mimir remote write compatibility
Given applications and collectors send metrics through the existing telemetry path
When Mimir is migrated to ingest storage
Then the system MUST preserve the existing Mimir remote write endpoint exposed through Alloy
And the system MUST NOT require telemetry clients to connect directly to Mimir internals or Kafka

### Requirement: Tempo Kafka Write Path
The observability platform MUST run Tempo with the current distributed Kafka write path backed by the shared observability Kafka cluster.

#### Scenario: Tempo Kafka ingestion
Given the shared observability Kafka cluster is available
When Tempo is deployed
Then the system MUST configure Tempo distributors to persist incoming trace data to Kafka before durable block construction
And the system MUST configure the required Tempo consumers for current distributed trace ingestion and query behavior

#### Scenario: Tempo telemetry endpoint compatibility
Given applications and collectors send traces through the existing telemetry path
When Tempo is migrated to the Kafka-backed write path
Then the system MUST preserve OTLP ingestion through the shared Alloy telemetry endpoint
And the system MUST NOT require telemetry clients to connect directly to Tempo internals or Kafka

#### Scenario: Metrics generator continuity
Given Tempo metrics generation is enabled
When Tempo consumes traces through the Kafka-backed write path
Then the system MUST continue to remote write generated metrics to Mimir through the configured Mimir endpoint

### Requirement: Loki Distributed TSDB Storage
The observability platform MUST keep Loki on distributed microservices mode with TSDB object storage while updating it through the selected OSS chart path.

#### Scenario: Loki deployment mode
Given the observability stack is deployed on the pantheon cluster
When Loki is provisioned
Then the system MUST run Loki in distributed microservices mode
And the system MUST keep Loki using TSDB object storage for durable log data

#### Scenario: Loki Kafka exclusion
Given the shared observability Kafka cluster exists
When Loki is provisioned
Then the system MUST NOT require Loki log ingestion, indexing, or storage to depend on Kafka
And the system MUST keep Loki client ingestion available through the existing Alloy log path

### Requirement: Existing Observability Entry Points
The observability platform MUST preserve existing Grafana and telemetry entry points while modernizing backend ingest internals.

#### Scenario: Grafana access remains stable
Given the observability stack is upgraded
When operators access Grafana
Then the system MUST keep Grafana reachable through the configured public Grafana hostname
And the system MUST preserve provisioned datasources for Mimir, Loki, Tempo, and Pyroscope

#### Scenario: Telemetry gateway remains stable
Given applications and cluster collectors send telemetry through the shared telemetry gateway
When backend ingest internals are modernized
Then the system MUST keep accepting metrics, logs, traces, and profiles through the existing telemetry gateway model
And the system MUST NOT expose Kafka as an application-facing telemetry endpoint

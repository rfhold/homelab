# Observability Delta Spec

Delta spec at `docs/specs/changes/defer-tempo-kafka-write-path/specs/observability/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

Tempo 3.0 documentation describes a Kafka-backed write path using block-builders and live-stores, but the maintained `grafana-community/tempo-distributed` chart has not released a Tempo 3 application version yet. The current chart exposes preparatory opt-in values, but deploying those values now would make the homelab operate ahead of the released chart's supported Tempo 3 migration path.

### Impact

- **Breaking changes**: none intended
- **Migration**: keep Tempo on the maintained community chart while reverting Kafka, block-builder, and live-store configuration until a released Tempo 3-capable chart is available
- **Contract surfaces**: `src/components/tempo.ts`, `src/components/strimzi-kafka-cluster.ts`, `src/modules/grafana-stack.ts`, `programs/grafana/index.ts`, `programs/grafana/Pulumi.pantheon.yaml`
- **Cross-change dependencies**: depends on archived change `docs/specs/changes/archive/2026-06-16-modernize-observability-ingest/`

### Non-goals

- Reverting Mimir ingest storage or its Kafka dependency
- Reverting the Strimzi operator program
- Reverting the Loki community chart migration
- Reverting the Tempo community chart source/version
- Deploying the Grafana stack

### Rollback

Revert the follow-up code and spec changes to restore Tempo Kafka write-path configuration after a released Tempo 3-capable chart is available and validated.

---

## MODIFIED Requirements

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
Then the system MUST use a maintained Tempo distributed chart source and version compatible with the currently released Tempo application version
And the system MUST NOT configure Tempo 3-only write-path components before a maintained chart release carries a Tempo 3 application version

### Requirement: Shared Observability Kafka Cluster
The observability platform MUST provision one Strimzi-managed Kafka cluster for observability backend ingest paths that currently require Kafka.

#### Scenario: Shared backend dependency
Given the observability stack is deployed on the pantheon cluster
When Kafka-backed observability backends are provisioned
Then the system MUST create a Kafka cluster for observability ingest
And the system MUST configure Mimir to use that cluster for ingest storage

#### Scenario: Backend-owned topics
Given the observability Kafka cluster exists
When Mimir is provisioned
Then the system MUST provision or configure a Kafka topic for Mimir ingest data
And the system MUST NOT provision a Tempo trace topic until Tempo is migrated to a released Kafka-backed write path

#### Scenario: Object storage remains durable backend storage
Given the observability Kafka cluster is used for ingest
When Mimir, Tempo, and Loki store durable telemetry data
Then the system MUST continue to use the configured Pantheon object storage buckets for long-term backend storage
And the system MUST NOT replace object storage durability with Kafka retention

### Requirement: Tempo Kafka Write Path
The observability platform MUST defer Tempo Kafka write-path configuration until a maintained Tempo distributed chart release carries a Tempo 3 application version.

#### Scenario: Tempo remains on released architecture
Given the maintained Tempo distributed chart release does not carry a Tempo 3 application version
When Tempo is deployed
Then the system MUST keep Tempo on the released ingester-based distributed path
And the system MUST NOT enable Tempo Kafka ingest, block-builder, or live-store chart values

#### Scenario: Tempo telemetry endpoint compatibility
Given applications and collectors send traces through the existing telemetry path
When Tempo Kafka write-path migration is deferred
Then the system MUST preserve OTLP ingestion through the shared Alloy telemetry endpoint
And the system MUST NOT require telemetry clients to connect directly to Tempo internals or Kafka

#### Scenario: Metrics generator continuity
Given Tempo metrics generation is enabled
When Tempo Kafka write-path migration is deferred
Then the system MUST continue to remote write generated metrics to Mimir through the configured Mimir endpoint

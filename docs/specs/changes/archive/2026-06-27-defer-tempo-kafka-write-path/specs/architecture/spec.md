# Architecture Delta Spec

Delta spec at `docs/specs/changes/defer-tempo-kafka-write-path/specs/architecture/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

Change overview lives in `docs/specs/changes/defer-tempo-kafka-write-path/specs/observability/spec.md`.

## MODIFIED Requirements

### Requirement: Observability-Owned Kafka Resources
The platform architecture MUST treat the Kafka cluster used by Mimir as observability-owned infrastructure created by the Grafana observability stack.

#### Scenario: Observability cluster ownership
Given the Grafana observability stack needs Kafka for backend ingest
When the stack is deployed after the Strimzi operator is available
Then the system MUST create the observability Kafka cluster from the Grafana observability stack
And the system MUST keep the cluster's topics scoped to observability backend use

#### Scenario: Operator prerequisite
Given the Grafana observability stack defines Strimzi Kafka resources
When operators apply the stack
Then the system MUST require the Strimzi operator to exist before those resources are reconciled
And the system MUST make the deployment order clear through stack dependency or operator documentation

### Requirement: Kafka Availability Defaults
The platform architecture MUST prefer high-availability Kafka defaults for observability backend ingest over the smallest possible resource footprint.

#### Scenario: Backend ingest durability
Given Mimir depends on Kafka for ingest coordination
When the observability Kafka cluster is provisioned
Then the system MUST configure Kafka with redundant brokers or equivalent availability settings suitable for backend ingest durability
And the system MUST NOT use a single-node Kafka topology as the default production configuration

#### Scenario: Adjustable sizing
Given homelab resource constraints change over time
When operators configure the observability Kafka cluster
Then the system MUST expose sizing inputs for storage and replica-related settings
And the system MUST allow operators to tune those settings without changing telemetry client configuration

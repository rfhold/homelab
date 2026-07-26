# Architecture Delta Spec

Delta spec at `docs/specs/changes/modernize-observability-ingest/specs/architecture/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

See the Change Overview in `docs/specs/changes/modernize-observability-ingest/specs/observability/spec.md`.

## ADDED Requirements

### Requirement: Strimzi Operator Program
The platform architecture MUST manage the Strimzi operator as a standalone Pulumi program that installs the operator without owning application Kafka clusters.

#### Scenario: Operator-only deployment
Given the platform needs Kafka-compatible clusters for workloads
When the Strimzi program is deployed
Then the system MUST install the Strimzi operator into its own namespace
And the system MUST NOT create observability Kafka clusters or topics from the operator program

#### Scenario: Workload-owned Kafka resources
Given the Strimzi operator is installed
When a workload needs a Kafka cluster
Then the workload-owning stack MUST define the Kafka cluster and topics it owns
And the system MUST allow the workload stack to configure cluster sizing and topic names for its own use case

### Requirement: Observability-Owned Kafka Resources
The platform architecture MUST treat the Kafka cluster used by Mimir and Tempo as observability-owned infrastructure created by the Grafana observability stack.

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
Given Mimir and Tempo depend on Kafka for ingest coordination
When the observability Kafka cluster is provisioned
Then the system MUST configure Kafka with redundant brokers or equivalent availability settings suitable for backend ingest durability
And the system MUST NOT use a single-node Kafka topology as the default production configuration

#### Scenario: Adjustable sizing
Given homelab resource constraints change over time
When operators configure the observability Kafka cluster
Then the system MUST expose sizing inputs for storage and replica-related settings
And the system MUST allow operators to tune those settings without changing telemetry client configuration

# Observability Delta

## Modified Requirements

### Requirement: Current Observability Backend Charts
The observability platform MUST deploy Grafana chart 12.8.0 with Grafana 13.1.1 and Tempo distributed chart 3.0.6 with Tempo 3.0.2.

### Requirement: Shared Observability Kafka Cluster
Mimir and Tempo MUST share the Grafana-owned Strimzi cluster while using distinct topics.

#### Scenario: Tempo topic sizing
Given Tempo 3 consumes traces from Kafka
When `tempo-traces` is provisioned
Then the topic MUST have three partitions and three replicas
And block-builder and live-store MUST each run three replicas
And Tempo MUST disable automatic topic creation

### Requirement: Tempo Kafka Write Path
Tempo MUST use the Tempo 3 Kafka-backed distributed write path.

#### Scenario: Tempo 3 components
Given Tempo 3 is deployed in microservices mode
When the chart renders workloads
Then ingesters and the old compactor MUST be disabled
And backend scheduler, backend worker, block-builder, and live-store MUST be enabled
And external object storage MUST remain the durable trace backend

#### Scenario: Entry-point compatibility
Given applications and Grafana use existing trace endpoints
When Tempo is upgraded
Then Alloy MUST continue sending OTLP traces to the Tempo distributor
And Grafana MUST continue querying through the Tempo query frontend

#### Scenario: Metrics generation
Given Tempo metrics generation is enabled
When Tempo consumes traces from Kafka
Then generated service graphs and span metrics MUST continue to remote write to Mimir
And the removed `local-blocks` processor MUST NOT be configured

### Requirement: Tempo In-Place Migration
The Pantheon deployment MUST use an explicitly approved maintenance outage for the Tempo 2 to Tempo 3 migration.

#### Scenario: Forward-only rollout
Given upstream does not support an in-place downgrade
When Tempo 2 is scaled down and Tempo 3 starts
Then recovery MUST proceed by fixing Tempo 3 forward
And operators MUST accept that trace data may be lost during the maintenance window

# Architecture Delta

## Modified Requirements

### Requirement: Observability-Owned Kafka Resources
The Grafana observability stack MUST own the shared Strimzi Kafka cluster and the distinct topics used by Mimir and Tempo.

#### Scenario: Backend-owned topics
Given Mimir and Tempo use Kafka-backed ingest
When the Grafana observability stack is deployed
Then the stack MUST create `mimir-ingest` for Mimir
And the stack MUST create `tempo-traces` for Tempo
And telemetry clients MUST NOT connect directly to Kafka

# Contracts: defer-tempo-kafka-write-path

## Scope

- **Requirements**:
  - `observability` MODIFIED Requirement: Current Observability Backend Charts
  - `observability` MODIFIED Requirement: Shared Observability Kafka Cluster
  - `observability` MODIFIED Requirement: Tempo Kafka Write Path
  - `architecture` MODIFIED Requirement: Observability-Owned Kafka Resources
  - `architecture` MODIFIED Requirement: Kafka Availability Defaults
- **Contract surfaces**:
  - `src/components/tempo.ts` exported `TempoArgs`
  - `src/components/strimzi-kafka-cluster.ts` exported `OBSERVABILITY_KAFKA_TOPICS`
  - `src/modules/grafana-stack.ts` exported `GrafanaStackArgs`
- **Excluded implementation**:
  - Mimir ingest storage behavior
  - Strimzi operator program
  - Loki chart source/version
  - Tempo chart source/version

## Exact Changes

### `src/components/tempo.ts`

- **Change type**: modify exported interface
- **Symbol**: `TempoArgs`
- **Target shape**:
  - Remove optional `kafka?: { bootstrapServers: pulumi.Input<string>; topic: pulumi.Input<string>; }`.
  - Keep `namespace`, `s3`, `metricsGenerator`, `replicas`, and `tolerations` fields unchanged.
- **Compatibility/migration notes**: callers MUST NOT pass Kafka connection details to `Tempo` until a released Tempo 3-capable chart/app version is adopted in a later change.
- **Generated output**: none.
- **Allowed compile-required stubs**: remove any now-invalid `kafka` property passed into `Tempo` constructors.

### `src/components/strimzi-kafka-cluster.ts`

- **Change type**: modify exported constant
- **Symbol**: `OBSERVABILITY_KAFKA_TOPICS`
- **Target shape**:
  - Keep `mimirIngest: "mimir-ingest"`.
  - Remove `tempoTraces: "tempo-traces"`.
- **Compatibility/migration notes**: the observability Kafka cluster MUST NOT expose a Tempo trace topic contract until Tempo's Kafka write path is reintroduced in a later approved change.
- **Generated output**: none.
- **Allowed compile-required stubs**: remove references to `OBSERVABILITY_KAFKA_TOPICS.tempoTraces`.

### `src/modules/grafana-stack.ts`

- **Change type**: modify exported interface
- **Symbol**: `GrafanaStackArgs.observabilityKafka.topics`
- **Target shape**:
  - Keep optional `mimirIngest?: string`.
  - Remove optional `tempoTraces?: string`.
- **Compatibility/migration notes**: Grafana stack Kafka topic configuration is Mimir-only for this release; Tempo topic configuration returns only with a later Tempo 3-capable migration.
- **Generated output**: none.
- **Allowed compile-required stubs**: remove now-invalid Tempo topic construction and now-invalid Tempo Kafka constructor arguments.

## Validation

- **Contract stage verification**:
  ```
  bun run typecheck
  ```
- **Implementation unlock condition**: typecheck passes after the contract surfaces no longer expose Tempo Kafka args or a Tempo Kafka topic contract.

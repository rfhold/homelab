# Contract Changes

## Status

Approved contract boundary for Grafana chart 12.8.0 with Grafana 13.1.1 and Tempo distributed chart 3.0.6 with Tempo 3.0.2.

## `src/components/strimzi-kafka-cluster.ts`

Extend the observability topic constants:

```typescript
export const OBSERVABILITY_KAFKA_TOPICS = {
  mimirIngest: "mimir-ingest",
  tempoTraces: "tempo-traces",
} as const;
```

## `src/components/tempo.ts`

Require the Tempo 3 Kafka ingest connection:

```typescript
kafka: {
  bootstrapServers: pulumi.Input<string>;
  topic: pulumi.Input<string>;
};
```

Replace ingester and compactor replica inputs with:

```typescript
blockBuilder?: number;
liveStore?: number;
backendWorker?: number;
```

The block-builder and live-store values default to three and must match the `tempo-traces` partition count.

## `src/modules/grafana-stack.ts`

Extend `GrafanaStackArgs.observabilityKafka.topics`:

```typescript
tempoTraces?: string;
```

`GrafanaStack` creates `tempo-traces` with three partitions, passes its connection to Tempo, and orders Tempo after the Kafka cluster and topic.

## `programs/grafana/index.ts`

Extend `ObservabilityKafkaConfig.topics`:

```typescript
tempoTraces?: string;
```

## Compatibility

Existing Alloy OTLP ingestion, Tempo distributor service naming, Tempo query-frontend service naming, Grafana datasource configuration, Mimir Kafka ingest, and object-storage buckets remain unchanged.

Tempo 2 rollback is not supported after Tempo 3 starts.

## Generated Artifacts

None.

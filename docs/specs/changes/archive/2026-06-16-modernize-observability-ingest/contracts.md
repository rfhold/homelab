# Contract Changes: modernize-observability-ingest

This file is required because the change introduces Kafka topic contracts and changes exported Pulumi component/module interfaces. It is approved with `tasks.md`; execution applies these exact changes without a second approval gate.

## Scope

- **Requirements covered**: `architecture` ADDED `Strimzi Operator Program`; `architecture` ADDED `Observability-Owned Kafka Resources`; `architecture` ADDED `Kafka Availability Defaults`; `observability` ADDED `Shared Observability Kafka Cluster`; `observability` ADDED `Mimir Ingest Storage`; `observability` ADDED `Tempo Kafka Write Path`
- **Contract surfaces**: `src/components/strimzi.ts`, `src/components/strimzi-kafka-cluster.ts`, `src/components/mimir.ts`, `src/components/tempo.ts`, `src/modules/grafana-stack.ts`, Kafka topic names for observability ingest
- **Non-contract implementation excluded**: Helm value bodies, Pulumi resource implementation internals, chart version updates, application telemetry behavior, Grafana datasource implementation, and integration wiring beyond inert compile-required stubs

## Exact Changes

### `src/components/strimzi.ts`

- **Change type**: add
- **Symbols/objects**: `StrimziArgs`, `Strimzi`
- **Exact target shape**:
  ```ts
  export interface StrimziArgs extends WorkloadLabelArgs {
    namespace: pulumi.Input<string>;
    watchAnyNamespace?: pulumi.Input<boolean>;
    resources?: {
      requests?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
      limits?: {
        cpu?: pulumi.Input<string>;
        memory?: pulumi.Input<string>;
      };
    };
  }

  export class Strimzi extends pulumi.ComponentResource {
    public readonly chart: k8s.helm.v4.Chart;
    public readonly namespace: pulumi.Output<string>;
  }
  ```
- **Compatibility/migration notes**: none; new operator component surface only
- **Generated output expected**: none
- **Allowed compile-required stubs**: constructor may register outputs without full Helm values until the implementation stage fills behavior

### `src/components/strimzi-kafka-cluster.ts`

- **Change type**: add
- **Symbols/objects**: `KafkaTopicConfig`, `KafkaConnectionConfig`, `StrimziKafkaClusterArgs`, `StrimziKafkaCluster`
- **Exact target shape**:
  ```ts
  export interface KafkaTopicConfig {
    name: string;
    partitions?: pulumi.Input<number>;
    replicas?: pulumi.Input<number>;
    config?: pulumi.Input<Record<string, pulumi.Input<string>>>;
  }

  export interface KafkaConnectionConfig {
    bootstrapServers: pulumi.Output<string>;
    topics: Record<string, string>;
  }

  export interface StrimziKafkaClusterArgs {
    namespace: pulumi.Input<string>;
    clusterName?: pulumi.Input<string>;
    replicas?: pulumi.Input<number>;
    storage?: {
      size?: pulumi.Input<string>;
      class?: pulumi.Input<string>;
    };
    topics: Record<string, KafkaTopicConfig>;
    tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
    nodeSelector?: pulumi.Input<Record<string, pulumi.Input<string>>>;
  }

  export class StrimziKafkaCluster extends pulumi.ComponentResource {
    public readonly cluster: k8s.apiextensions.CustomResource;
    public readonly topics: Record<string, k8s.apiextensions.CustomResource>;
    public readonly connection: KafkaConnectionConfig;
  }
  ```
- **Compatibility/migration notes**: Kafka remains internal to observability; no client-facing telemetry endpoint changes
- **Generated output expected**: none
- **Allowed compile-required stubs**: constructor may create no custom resources until the implementation stage fills behavior, but exported properties must satisfy the declared types

### Kafka Topic Contracts

- **Change type**: add
- **Symbols/objects**: observability Kafka topic names
- **Exact target shape**:
  ```text
  mimir-ingest
  tempo-traces
  ```
- **Compatibility/migration notes**: topics are internal backend contracts. Mimir and Tempo must not share a topic. Loki must not depend on either topic.
- **Generated output expected**: none
- **Allowed compile-required stubs**: none

### `src/components/mimir.ts`

- **Change type**: modify
- **Symbols/objects**: `MimirArgs`
- **Exact target shape**:
  ```ts
  kafka?: {
    bootstrapServers: pulumi.Input<string>;
    topic: pulumi.Input<string>;
  };
  ```
- **Compatibility/migration notes**: optional field preserves current callers until the Grafana stack passes the shared Kafka connection
- **Generated output expected**: none
- **Allowed compile-required stubs**: field may be accepted without Helm value usage until the implementation stage

### `src/components/tempo.ts`

- **Change type**: modify
- **Symbols/objects**: `TempoArgs`
- **Exact target shape**:
  ```ts
  kafka?: {
    bootstrapServers: pulumi.Input<string>;
    topic: pulumi.Input<string>;
  };
  ```
- **Compatibility/migration notes**: optional field preserves current callers until the Grafana stack passes the shared Kafka connection
- **Generated output expected**: none
- **Allowed compile-required stubs**: field may be accepted without Helm value usage until the implementation stage

### `src/modules/grafana-stack.ts`

- **Change type**: modify
- **Symbols/objects**: `GrafanaStackArgs`
- **Exact target shape**:
  ```ts
  observabilityKafka?: {
    enabled?: pulumi.Input<boolean>;
    replicas?: pulumi.Input<number>;
    storage?: {
      size?: pulumi.Input<string>;
      class?: pulumi.Input<string>;
    };
    topics?: {
      mimirIngest?: string;
      tempoTraces?: string;
    };
  };
  ```
- **Compatibility/migration notes**: optional field preserves current stack construction while allowing the Grafana stack to own observability Kafka resources
- **Generated output expected**: none
- **Allowed compile-required stubs**: field may be accepted without resource usage until the implementation stage

## Validation

- **Contract stage verification**: `bun run typecheck` must pass after the contract surfaces are added or modified, and the changed exported symbols/topic names must match this file.
- **Implementation unlock condition**: Stage 1 complete and evidence shows changed contract surfaces match this file.

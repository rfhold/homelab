# Platform Architecture

This page describes tracked repository structure. It does not prove that any program has been applied.

## Ownership Layers

| Layer | Tracked owner | Source evidence |
| --- | --- | --- |
| Host provisioning | PyInfra deploys read host data and configure operating systems | [`../../deploys/README.md`](../../deploys/README.md) |
| Kubernetes services | Independently configured Pulumi programs compose shared components and modules | [`../../programs/strimzi/index.ts`](../../programs/strimzi/index.ts), [`../../programs/grafana/index.ts`](../../programs/grafana/index.ts) |
| Reusable infrastructure | `src/components/` owns individual resource abstractions; `src/modules/` composes them | [`../../src/components/strimzi-kafka-cluster.ts`](../../src/components/strimzi-kafka-cluster.ts), [`../../src/modules/grafana-stack.ts`](../../src/modules/grafana-stack.ts) |

## Kafka Boundary

The tracked Strimzi program creates the `strimzi` namespace and installs only the operator chart. It watches all namespaces but does not construct a Kafka cluster or topic.

The tracked Grafana module constructs the observability Kafka cluster and its Mimir and Tempo topics. It passes the resulting internal bootstrap address and topic names to those backends and orders each backend after its required Kafka resources.

The intended cross-program order is:

1. Reconcile the Strimzi operator program.
2. Confirm the operator is available to reconcile Strimzi custom resources.
3. Reconcile the Grafana observability program.

The repository does not encode that cross-program order as a Pulumi stack reference. See [`verification.md`](verification.md).

# Platform Architecture

This page describes tracked repository structure. It does not prove that any program has been applied.

## Ownership Layers

| Layer | Tracked owner | Source evidence |
| --- | --- | --- |
| Host provisioning | PyInfra deploys read host data and configure operating systems | [`../../deploys/README.md`](../../deploys/README.md) |
| Kubernetes services | Independently configured Pulumi programs compose shared components and modules | [`../../programs/strimzi/index.ts`](../../programs/strimzi/index.ts), [`../../programs/grafana/index.ts`](../../programs/grafana/index.ts) |
| Grafana content | Three Pulumi programs own dashboards, alert rules, recording rules, and shared domain folders | [`../../programs/grafana-dashboards/`](../../programs/grafana-dashboards/), [`../../programs/grafana-alerts/`](../../programs/grafana-alerts/), [`../../programs/grafana-recording-rules/`](../../programs/grafana-recording-rules/) |
| Reusable infrastructure | `src/components/` owns individual resource abstractions; `src/modules/` composes them | [`../../src/components/strimzi-kafka-cluster.ts`](../../src/components/strimzi-kafka-cluster.ts), [`../../src/modules/grafana-stack.ts`](../../src/modules/grafana-stack.ts) |

## Kafka Boundary

The tracked Strimzi program creates the `strimzi` namespace and installs only the operator chart. It watches all namespaces but does not construct a Kafka cluster or topic.

The tracked Grafana module constructs the observability Kafka cluster and its Mimir and Tempo topics. It passes the resulting internal bootstrap address and topic names to those backends and orders each backend after its required Kafka resources.

The intended cross-program order is:

1. Reconcile the Pantheon storage program.
2. Confirm the required RBD pool and StorageClass are available.
3. Reconcile the Strimzi operator program.
4. Confirm the operator is available to reconcile Strimzi custom resources.
5. Reconcile the Grafana observability program.

The repository does not encode that cross-program order as a Pulumi stack reference. The Grafana program names the required StorageClass as an environment-specific input. See [`verification.md`](verification.md).

## Grafana Content Boundary

The Grafana runtime exports its API endpoint and secret administrator credentials. Each content program constructs its own provider from those outputs. The dashboard program owns shared folders and therefore precedes the alert and recording-rule programs; that order is operator-controlled rather than an automatic deployment workflow.

# Architecture Verification

Tracked source establishes resource ownership but not live state.

| Question | Repository evidence | Required verification |
| --- | --- | --- |
| Is the Strimzi operator available before observability resources reconcile? | The operator and Grafana are separate programs, with no cross-stack dependency in [`../../programs/strimzi/index.ts`](../../programs/strimzi/index.ts) or [`../../programs/grafana/index.ts`](../../programs/grafana/index.ts). | Inspect the authorized delivery order and the target cluster before an apply. |
| Are the observability Kafka cluster and both topics deployed and ready? | [`../../src/modules/grafana-stack.ts`](../../src/modules/grafana-stack.ts) defines them when Kafka is enabled. | Use an authorized live inspection of the intended cluster. |
| Do live broker count, storage, and replication match the intended availability contract? | [`../../programs/grafana/Pulumi.pantheon.yaml`](../../programs/grafana/Pulumi.pantheon.yaml) and the component defaults describe desired inputs. | Compare an authorized preview and live Strimzi resources with the intended stack. |

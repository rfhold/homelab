# Architecture Verification

Tracked source establishes resource ownership but not live state.

| Question | Repository evidence | Required verification |
| --- | --- | --- |
| Are storage and the Strimzi operator available before observability resources reconcile? | Storage, Strimzi, and Grafana are separate programs, with no cross-stack dependency in their entry points. The authorized 2026-07-27 rollout applied and verified storage, then Strimzi, then Grafana. | Preserve this operator-controlled order because Pulumi does not encode it across programs. |
| Are the observability Kafka cluster and both topics deployed and ready? | Post-cutover Pantheon inspection on 2026-07-27 found Kafka `4.1.0`, three RBD-backed combined broker/controllers, and both RF3 topics ready with all replicas in sync. | Treat the dated observation as point-in-time evidence and continue normal readiness monitoring. |
| Do live broker count, storage, resources, heap, replication, and metrics match the intended contract? | The 2026-07-27 inspection confirmed three `database` claims, tracked resources and heap, RF3 topics, and all five intended Strimzi jobs in Mimir. | Continue drift detection and verify a future authorized preview before subsequent changes. |
| Are Grafana content projects applied after the runtime and shared folders? | The authorized 2026-07-27 cutover applied the runtime, dashboard, alert, and recording stacks in order. Final previews were no-op, and the ruler API reported all 427 rules without evaluation errors. | Preserve operator-controlled ordering and use separately authorized previews for future drift checks. |

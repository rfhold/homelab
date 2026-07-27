# Architecture

Architecture specifications define intended ownership and dependency boundaries. The implementation overview describes tracked repository source only; it does not establish deployment or live health.

| Document | Covers |
| --- | --- |
| [`overview.md`](overview.md) | Source-verified platform layers, Kafka ownership, and dependency flow |
| [`spec/strimzi-operator.md`](spec/strimzi-operator.md) | Intended Strimzi operator and workload ownership contract |
| [`spec/observability-kafka.md`](spec/observability-kafka.md) | Intended observability Kafka ownership and availability contract |
| [`verification.md`](verification.md) | Deployment ordering and live-state questions not answered by source |

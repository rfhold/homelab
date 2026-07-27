# Kubernetes Workloads

Specifications define intended workload contracts. The implementation summary describes tracked source only, and the verification ledger records where source, approval, or live evidence is incomplete.

| Document | Covers |
| --- | --- |
| [`implementation.md`](implementation.md) | Source-backed workload, inference, gateway, and registry configuration |
| [`verification.md`](verification.md) | GPU allocation, label coverage, Zot approval, experiment, and live-state gaps |
| [`decisions/gemma-serving.md`](decisions/gemma-serving.md) | Historical rationale for serving Gemma with llama.cpp instead of vLLM |
| [`spec/workload-labels.md`](spec/workload-labels.md) | Generic metadata labels and stack coverage |
| [`spec/planned-node-reboots.md`](spec/planned-node-reboots.md) | Label-selected drains and Ceph safety gates |
| [`spec/model-gateway.md`](spec/model-gateway.md) | Agent Gateway, provider routing, Codex Proxy, and local model aliases |
| [`spec/standalone-inference.md`](spec/standalone-inference.md) | vLLM and llama.cpp configuration, scheduling, storage, credentials, and internal services |

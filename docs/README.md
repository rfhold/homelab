# Documentation

Repository source and configuration establish tracked implementation. Feature specifications state intended contracts. Neither proves that a stack is deployed, healthy, or current in a live environment unless separately recorded as verified evidence.

| Document | Covers |
| --- | --- |
| [`architecture/README.md`](architecture/README.md) | Platform ownership, layers, dependencies, and deployment boundaries |
| [`deployment/README.md`](deployment/README.md) | CI, Tekton, BuildKit, images, and reconciliation workflows |
| [`edge-networking/README.md`](edge-networking/README.md) | Gateway API, DNS, certificates, aliases, and edge routing |
| [`host-provisioning/README.md`](host-provisioning/README.md) | Inventory, K3s lifecycle, host configuration, and verification |
| [`kubernetes-workloads/README.md`](kubernetes-workloads/README.md) | Workload conventions, scheduling, inference, and registries |
| [`observability/README.md`](observability/README.md) | Metrics, logs, traces, profiles, dashboards, and alerts |
| [`secrets-management/README.md`](secrets-management/README.md) | Authentik, OpenBao, secret delivery, and operational boundaries |
| [`storage/README.md`](storage/README.md) | Ceph, object storage, backups, and recovery evidence |
| [`voice-satellites/README.md`](voice-satellites/README.md) | Supported satellite provisioning and unresolved deployment state |
| [`operations/README.md`](operations/README.md) | Cross-feature operational runbooks and command safety |
| [`quality/README.md`](quality/README.md) | Testing, documentation validation, and evidence expectations |
| [`research/README.md`](research/README.md) | Non-authoritative research and evaluation records |

## Authority

1. Root and scoped `AGENTS.md` files govern contributor and agent behavior.
2. Approved feature specifications define intended behavior.
3. Tracked source, tests, and configuration establish repository implementation.
4. Runbooks describe supported operations but do not prove live execution.
5. Research and Git history preserve evidence without governing current behavior.

Conflicts between intended contracts and tracked implementation remain explicit verification gaps until an approved change resolves them.

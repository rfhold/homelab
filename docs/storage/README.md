# Storage

Storage specifications define intended Ceph behavior. Tracked Pulumi source establishes repository configuration, while history preserves point-in-time evidence without representing current health.

| Document | Covers |
| --- | --- |
| [`implementation.md`](implementation.md) | Source-verified Pantheon Ceph placement and OSD memory configuration |
| [`spec/control-daemon-placement.md`](spec/control-daemon-placement.md) | Intended monitor and manager separation |
| [`spec/osd-memory.md`](spec/osd-memory.md) | Intended Pantheon OSD memory request, limit, and Ceph target |
| [`spec/osd-rollout-safety.md`](spec/osd-rollout-safety.md) | Intended one-at-a-time OSD rollout safeguards |
| [`operations/osd-memory-rollout.md`](operations/osd-memory-rollout.md) | Guarded procedure for introducing OSD memory controls |
| [`history/2026-07-26-apollo-memory-incident.md`](history/2026-07-26-apollo-memory-incident.md) | Historical Apollo memory incident and recovery evidence |
| [`verification.md`](verification.md) | Live Ceph state that remains unverified |

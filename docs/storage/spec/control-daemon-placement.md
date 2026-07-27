# Ceph Control Daemon Placement

- Pantheon MUST prevent Rook from intentionally placing multiple Ceph monitors on one node when at least three schedulable storage nodes are available.
- Pantheon MUST prevent Rook from intentionally placing multiple Ceph managers on one node when at least two schedulable nodes are available.

This contract governs eligible placement. It does not claim that a live scheduler can satisfy the topology when nodes are unavailable.

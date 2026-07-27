# Pantheon OSD Memory

## Controls

- Every Pantheon Ceph OSD MUST request 8 GiB of Kubernetes memory.
- Every Pantheon Ceph OSD MUST have a 16 GiB Kubernetes memory limit.
- Every Pantheon Ceph OSD MUST use an 8 GiB Ceph OSD memory target.

## Scope

- The resource request and limit MUST apply only to OSD containers.
- The change MUST NOT add CPU controls or apply the OSD memory values to monitors, managers, CSI components, or the Rook operator.
- The Pantheon-specific settings MUST NOT be applied to Romulus implicitly.
- OSD placement MUST retain the toleration required for each configured Pantheon storage node to remain eligible for Rook reconciliation.

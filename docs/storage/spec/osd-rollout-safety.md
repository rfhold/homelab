# OSD Memory Rollout Safety

- Persistent OSD memory controls MUST NOT be introduced while Ceph placement groups are degraded.
- An OSD above the new limit MUST be confirmed safe to stop before it is restarted.
- No more than one OSD MUST be unavailable at a time.
- The operator MUST wait for the restarted OSD and all placement groups to recover before proceeding to another OSD.
- Persistent controls MUST preserve the Rook-managed disruption budget that permits at most one unavailable OSD.
- Any loss of OSD availability or active-and-clean placement-group state MUST stop the rollout.

# OSD Memory Control Rollout

This procedure mutates a Ceph cluster. It requires explicit authorization for the named Pulumi stack, Kubernetes context, namespace, and OSDs. Historical completion evidence does not authorize repeating it.

## Preconditions

1. Confirm every OSD is available and every placement group is active and clean.
2. Confirm no unrelated recovery, rebalance, or storage rollout is in progress.
3. Identify only the OSDs exceeding the intended limit and map each one to its managed deployment.
4. Confirm the Rook disruption budget allows no more than one unavailable OSD.

## Oversized OSDs

1. Set Ceph `noout` for the bounded maintenance window.
2. Ask Ceph whether the single target OSD is safe to stop.
3. Stop if Ceph does not approve the target.
4. Restart only that OSD's managed deployment.
5. Wait for the deployment, OSD availability, and all placement groups to recover.
6. Recheck cluster health before selecting another OSD.
7. Unset `noout` after the final OSD recovers, including during recovery from an aborted procedure.

## Persistent Controls

1. Preview the storage stack and require the diff to remain limited to the intended CephCluster OSD resources, Ceph target, and OSD placement.
2. Confirm all OSDs and placement groups are healthy immediately before apply.
3. Apply only after the preview is accepted for the explicit target.
4. Monitor Rook reconciliation and stop if more than one OSD becomes unavailable or data health degrades.
5. Verify the rendered request, limit, target, toleration, OSD availability, placement-group state, and absence of `noout` before declaring the operation complete.

The intended controls are defined in [`../spec/osd-memory.md`](../spec/osd-memory.md), and unresolved live checks remain in [`../verification.md`](../verification.md).

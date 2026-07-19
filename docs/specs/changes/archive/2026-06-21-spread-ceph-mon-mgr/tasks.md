## AGENTS.md Notes

- Root `AGENTS.md` applies: no comments unless explicitly requested, follow neighboring file patterns, never commit secrets, use Bun instead of npm/yarn/node.
- No nested `AGENTS.md` exists under `docs/specs/` or `programs/storage/`.

## Contract Boundary Assessment

- **Status**: not applicable
- **Rationale**: This change updates Pulumi stack configuration only. It does not change API schemas, database schemas, generated code, event payloads, public interfaces, or persisted data contracts.

## Stage 1: Pantheon Storage Placement Flags

### Task 1.1: Disable multi-node co-location for Ceph control daemons
- **Implements**: `storage` ADDED Requirement: Pantheon Ceph Control Daemon Separation
- **Depends on**: approved `tasks.md`
- **Files**: `programs/storage/Pulumi.pantheon.yaml`
- **Approach**: Change `allowMultipleMonPerNode` and `allowMultipleMgrPerNode` from `true` to `false`, leaving OSD node/device selection unchanged.
- **Dispatch**: inline

### Stage Verification

- **Commands**:
  ```bash
  pulumi preview --stack pantheon
  ```
- **Expected outcome**: Preview shows an in-place update to the Pantheon `CephCluster` monitor and manager `allowMultiplePerNode` fields, with no storage class, filesystem, pool, OSD device, or destructive replacement changes.
- **Evidence artifact**: Record normalized preview evidence in this stage's Evidence block. Store raw output only if the preview contains unexpected replacement/delete changes or ambiguous output.

- [x] Stage 1 complete

### Evidence

#### Evidence

- **Date**: 2026-06-21
- **Commands**:
  ```bash
  pulumi preview --stack pantheon
  ```
- **Exit status**: 0
- **Result summary**:
  ```text
  Preview showed only in-place updates:
  - homelab:modules:Storage storage update [diff: ~cephCluster]
  - homelab:components:RookCephCluster storage-cluster update [diff: ~allowMultipleMgrPerNode,allowMultipleMonPerNode]
  - kubernetes:ceph.rook.io/v1:CephCluster storage-cluster-cluster update [diff: ~spec]
  Resources: 3 to update, 99 unchanged.
  No replacements, deletes, storage class changes, filesystem changes, pool changes, OSD device changes, or destructive changes were shown.
  ```
- **Meaningful warnings/errors**: none
- **Raw output**: omitted; passing preview output contained only routine Pulumi progress and the summarized resource diff above.
- **Files changed across the stage**:
  - `programs/storage/Pulumi.pantheon.yaml`
  - `docs/specs/changes/spread-ceph-mon-mgr/tasks.md`
- **AGENTS.md notes applied**: Root `AGENTS.md` followed; no comments added, neighboring YAML pattern preserved, no secrets touched.
- **Subagent statuses**: none; Task 1.1 ran inline.

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| `storage` ADDED Requirement: Pantheon Ceph Control Daemon Separation | Task 1.1 |

## Review Summary Appendix

- **CRITICAL**: None.
- **WARNING**: None.
- **SUGGESTION**: None.

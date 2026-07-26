# Protect Apollo Memory Implementation Plan

## Change Summary

Contain Pantheon Ceph OSD memory with an 8 GiB request, 16 GiB limit, and 8 GiB Ceph target; safely recycle currently oversized OSDs; and add warning alerts for OSD growth, node memory, swap, and OOM kills.

## Contract Boundary Assessment

- **Status**: required
- **Surfaces**: `RookCephClusterArgs`, `StorageModuleArgs.cephCluster`, and `CephClusterConfig`
- **Rationale**: The Pantheon stack needs typed configuration fields carried across the program, module, and component layers before implementation can render `CephCluster.spec.resources`, `CephCluster.spec.cephConfig`, and the OSD toleration required for Rook to reconcile the existing Mars OSD.
- **Contract file**: `docs/specs/changes/protect-apollo-memory/contracts.md`

## AGENTS.md Notes

- The repository root `AGENTS.md` applies to every task. Do not add code comments, follow neighboring patterns, verify imports, expose no secrets, specify return types for public functions, avoid refactoring terminology, and use Bun rather than npm, Yarn, or Node.
- No more specific `AGENTS.md` files exist under `docs/`, `src/`, `programs/`, or `grafana/`.
- The worktree contains unrelated in-progress observability changes. Tasks MUST NOT revert or modify those changes except for the alert-rule files explicitly listed below.

## Stage 1: Contract Boundaries

Wait for the results from prior tasks before starting dependent sub agent tasks.

- **Depends on**: approved `contracts.md`

### Task 1.1: Add storage configuration contract fields
- **Implements**: `storage` ADDED Requirement: Pantheon OSD Memory Containment
- **Depends on**: approved `contracts.md`
- **Files**: `src/components/rook-ceph-cluster.ts`, `src/modules/storage.ts`, `programs/storage/index.ts`
- **Approach**: Add only the optional `resources` and `cephConfig` properties with the exact types in `contracts.md`. Do not wire the values into constructors or rendered resources in this stage.
- **Dispatch**: inline
- **Dispatch rationale**: This is a small mechanical contract edit that must match the approved signatures exactly.

### Task 1.2: Add the OSD placement contract field
- **Implements**: `storage` ADDED Requirement: Pantheon OSD Memory Containment
- **Depends on**: approved revised `contracts.md`
- **Files**: `src/components/rook-ceph-cluster.ts`, `src/modules/storage.ts`, `programs/storage/index.ts`
- **Approach**: Add only the optional `osdTolerations` property with the exact types in `contracts.md`. Do not wire it into constructors or rendered resources in this stage.
- **Dispatch**: inline
- **Dispatch rationale**: This is a small mechanical contract correction discovered when Rook filtered tainted Mars from its valid-storage set.

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  git diff --check -- src/components/rook-ceph-cluster.ts src/modules/storage.ts programs/storage/index.ts
  ```
- **Expected outcome**: TypeScript exits successfully, the diff has no whitespace errors, and all optional fields match the revised `contracts.md`.
- **Evidence artifact**: Record normalized results in this stage's Evidence block; retain raw output only on failure or ambiguity.

- [x] Stage 1 complete

### Prior Evidence

- **Date**: 2026-07-26
- **Commands**: `bun run typecheck`; `git diff --check -- src/components/rook-ceph-cluster.ts src/modules/storage.ts programs/storage/index.ts`
- **Exit status**: 0 for both commands
- **Result summary**: TypeScript passed, the scoped diff passed whitespace validation, and the three optional interface fields match `contracts.md` without implementation wiring.
- **Meaningful warnings/errors**: none
- **Raw output**: omitted; passing output contained only the TypeScript command banner.
- **Files changed (across the stage)**: `src/components/rook-ceph-cluster.ts`, `src/modules/storage.ts`, `programs/storage/index.ts`, `docs/specs/changes/protect-apollo-memory/tasks.md`
- **AGENTS.md notes applied**: no code comments added; existing imports and neighboring interface patterns reused; Bun used for TypeScript verification.
- **Subagent statuses**: none; Task 1.1 executed inline.

### Evidence

- **Date**: 2026-07-26
- **Commands**: `bun run typecheck`; `git diff --check -- src/components/rook-ceph-cluster.ts src/modules/storage.ts programs/storage/index.ts`
- **Exit status**: 0 for both commands
- **Result summary**: TypeScript and scoped whitespace validation passed. The optional `osdTolerations` field matches the revised `contracts.md` across the component, module, and program interfaces without implementation wiring.
- **Meaningful warnings/errors**: none
- **Raw output**: omitted; passing output contained only the TypeScript command banner.
- **Files changed (across the revised stage)**: `src/components/rook-ceph-cluster.ts`, `src/modules/storage.ts`, `programs/storage/index.ts`, `docs/specs/changes/protect-apollo-memory/contracts.md`, `docs/specs/changes/protect-apollo-memory/tasks.md`
- **AGENTS.md notes applied**: no code comments added; neighboring optional interface patterns and existing Kubernetes imports reused; Bun used for TypeScript verification.
- **Subagent statuses**: none; Task 1.2 executed inline.

---

## Stage 2: Oversized OSD Recovery

- **Depends on**: Stage 1 complete

### Task 2.1: Recycle oversized OSDs sequentially
- **Implements**: `storage` ADDED Requirement: OSD Memory Control Rollout Safety
- **Depends on**: Stage 1 complete
- **Files**: none; live Pantheon `storage` namespace operations only
- **Approach**: Confirm all PGs are active and clean, set Ceph `noout`, and use `ceph osd ok-to-stop` before restarting OSD2 on Mars. Wait for its deployment, OSD availability, and PG health to recover before repeating the same process for OSD0 on Athena. Unset `noout` after both recover. Do not restart OSD3 on Apollo because its post-reboot memory is already below the new limit.
- **Dispatch**: inline
- **Dispatch rationale**: The operation requires guarded live-cluster decisions and immediate recovery handling.

### Stage Verification

- **Commands**:
  ```bash
  kubectl get pods --context=pantheon -n storage -l app=rook-ceph-osd -o wide
  kubectl exec --context=pantheon -n storage deploy/rook-ceph-tools -- ceph status
  kubectl exec --context=pantheon -n storage deploy/rook-ceph-tools -- ceph osd tree
  kubectl exec --context=pantheon -n storage deploy/rook-ceph-tools -- ceph osd dump
  kubectl top pods --context=pantheon -n storage -l app=rook-ceph-osd
  ```
- **Expected outcome**: OSDs 0, 2, and 3 are up and in; all PGs are active and clean; `noout` is absent from OSD flags; and OSD0 and OSD2 memory has returned below 16 GiB.
- **Evidence artifact**: Record normalized OSD availability, PG state, flags, and memory values in this stage's Evidence block; retain raw output only on failure or ambiguity.

- [x] Stage 2 complete

### Evidence

- **Date**: 2026-07-26
- **Commands**: planned Pantheon pod, Ceph status/tree/dump, and OSD memory checks; guarded `ceph osd ok-to-stop`, `ceph osd set noout`, and sequential `kubectl rollout restart/status` operations for OSD2 then OSD0; `ceph osd unset noout`.
- **Exit status**: 0 for all commands
- **Result summary**: OSD2 was approved safe to stop and fell from 18.5 GiB to 2.3 GiB after restart; after full PG recovery, OSD0 was approved safe to stop and fell from 26.3 GiB to 2.35 GiB. OSD3 remained running at 13.9 GiB. Ceph finished `HEALTH_OK` with monitors d/e/f in quorum, OSDs 0/2/3 up and in, all 106 PGs active and clean, and no `noout` flag.
- **Meaningful warnings/errors**: The preflight health warning for OSD2 BlueStore slow operations cleared after its restart.
- **Raw output**: omitted; normalized health, topology, flags, and memory values are recorded above.
- **Files changed (across the stage)**: `docs/specs/changes/protect-apollo-memory/tasks.md`; live OSD2 and OSD0 pods were recreated by their existing deployments.
- **AGENTS.md notes applied**: all namespaced kubectl operations used explicit `-n storage`, and every command used `--context=pantheon` in the required position.
- **Subagent statuses**: none; Task 2.1 executed inline.

---

## Stage 3: Persistent OSD Memory Controls

Wait for the results from prior tasks before starting dependent sub agent tasks.

- **Depends on**: Stage 2 complete

### Task 3.1: Render Pantheon OSD memory controls
- **Implements**: `storage` ADDED Requirement: Pantheon OSD Memory Containment; `storage` ADDED Requirement: OSD Memory Control Rollout Safety
- **Depends on**: Stage 2 complete and approved `contracts.md`
- **Files**: `src/components/rook-ceph-cluster.ts`, `src/modules/storage.ts`, `programs/storage/index.ts`, `programs/storage/Pulumi.pantheon.yaml`
- **Approach**: Pass `resources`, `cephConfig`, and `osdTolerations` through the program, module, and component layers; render the fields on the CephCluster; and configure only Pantheon OSDs with the exact values in `contracts.md`. Preserve `disruptionManagement.managePodBudgets: true` and do not alter Romulus or other Ceph daemon resources. The OSD-only toleration must match Mars's existing GPU taint so Rook includes OSD2 in reconciliation.
- **Dispatch**: subagent
- **Dispatch rationale**: The bounded storage file set benefits from implementation context isolated from the earlier incident investigation.

### Task 3.2: Deploy the Pantheon storage stack
- **Implements**: `storage` ADDED Requirement: Pantheon OSD Memory Containment; `storage` ADDED Requirement: OSD Memory Control Rollout Safety
- **Depends on**: Task 3.1
- **Files**: none beyond Pulumi-managed live resources
- **Approach**: Run `PULUMI_K8S_ENABLE_PATCH_FORCE=true pulumi preview -C programs/storage --stack pantheon --non-interactive --diff`, verify the diff is limited to the intended CephCluster resource and resulting Rook reconciliation, then run the equivalent `pulumi up` with `--yes`. Monitor the Rook-managed rollout and stop if more than one OSD becomes unavailable or PGs cease to be active and clean.
- **Dispatch**: inline
- **Dispatch rationale**: Live deployment requires review of the concrete Pulumi diff and guarded cluster monitoring.

### Stage Verification

- **Commands**:
  ```bash
  bun run typecheck
  pulumi preview -C programs/storage --stack pantheon --non-interactive --expect-no-changes
  kubectl get cephcluster storage-cluster --context=pantheon -n storage -o jsonpath='{.spec.resources.osd}'
  kubectl get cephcluster storage-cluster --context=pantheon -n storage -o jsonpath='{.spec.placement.osd.tolerations}'
  kubectl get deployment --context=pantheon -n storage -l app=rook-ceph-osd -o jsonpath='{range .items[*]}{.metadata.name}{" request="}{.spec.template.spec.containers[?(@.name=="osd")].resources.requests.memory}{" limit="}{.spec.template.spec.containers[?(@.name=="osd")].resources.limits.memory}{"\n"}{end}'
  kubectl exec --context=pantheon -n storage deploy/rook-ceph-tools -- ceph config get osd.0 osd_memory_target
  kubectl exec --context=pantheon -n storage deploy/rook-ceph-tools -- ceph config get osd.2 osd_memory_target
  kubectl exec --context=pantheon -n storage deploy/rook-ceph-tools -- ceph config get osd.3 osd_memory_target
  kubectl exec --context=pantheon -n storage deploy/rook-ceph-tools -- ceph status
  ```
- **Expected outcome**: TypeScript and no-change preview pass; the CephCluster has the exact OSD-only Mars taint toleration; every OSD deployment requests `8Gi` and limits memory to `16Gi`; all three OSDs report target `8589934592`; all OSDs are up/in and all PGs are active and clean.
- **Evidence artifact**: Record normalized preview, rendered resource, target, and Ceph health results in this stage's Evidence block; retain raw output only on failure or ambiguity.

- [x] Stage 3 complete

### Evidence

- **Date**: 2026-07-26
- **Commands**: `bun run typecheck`; scoped `git diff --check`; guarded Pulumi preview and apply; `kubectl wait` and `kubectl rollout status` for OSD2; the planned no-change preview, CephCluster resource/toleration queries, OSD deployment resource query, three OSD target queries, and `ceph status`.
- **Exit status**: 0 for all commands
- **Result summary**: Pulumi applied only the approved CephCluster OSD memory target, resources, and OSD-only Mars taint toleration, then reported 102 unchanged resources on the no-change preview. OSD0, OSD2, and OSD3 each request `8Gi`, limit `16Gi`, and resolve target `8589934592`. Ceph finished `HEALTH_OK` with monitors d/e/f, all three OSDs up and in, and all 106 PGs active and clean.
- **Meaningful warnings/errors**: The initial deployment omitted OSD2 because Rook filtered tainted Mars from its runtime valid-storage set. The approved narrow OSD toleration made Mars eligible; Rook then reconciled and rolled OSD2 successfully.
- **Raw output**: omitted; normalized Pulumi, resource, target, and Ceph health results are recorded above.
- **Files changed (across the stage)**: `src/components/rook-ceph-cluster.ts`, `src/modules/storage.ts`, `programs/storage/index.ts`, `programs/storage/Pulumi.pantheon.yaml`, `docs/specs/changes/protect-apollo-memory/contracts.md`, `docs/specs/changes/protect-apollo-memory/tasks.md`; live `storage-cluster` and all Rook OSD deployments reconciled.
- **AGENTS.md notes applied**: no code comments added; existing storage configuration and Kubernetes input-type patterns preserved; Bun used for TypeScript verification; explicit Pantheon context and storage namespace used for Kubernetes operations.
- **Subagent statuses**: Task 3.1: DONE; Task 3.2 executed inline.

---

## Stage 4: Memory Exhaustion Alerts

Wait for the results from prior tasks before starting dependent sub agent tasks.

- **Depends on**: Stage 3 complete

### Task 4.1: Define OSD, node memory, swap, and OOM alerts
- **Implements**: `observability` ADDED Requirement: Ceph OSD Memory Growth Alert; `observability` ADDED Requirement: Cluster Node Memory Exhaustion Alerts
- **Depends on**: Stage 3 complete
- **Files**: `grafana/alert-rules/ceph/alerts/cephosdmemoryhigh-ar-45769a185d9b35b89fb8dd03.yaml`, `grafana/alert-rules/node/alerts/nodememoryhighutilization-ar-c24b2972a5625afbb718ffcc.yaml`, `grafana/alert-rules/node/alerts/nodeswaphighutilization-ar-12ef97bede19a0e958f89648.yaml`, `grafana/alert-rules/node/alerts/nodeoomkilldetected-ar-2684fb6d521f3a5e3f8edca8.yaml`
- **Approach**: Add a Pantheon storage OSD working-set warning above 12 GiB for 10 minutes; change the existing node memory warning from 90 percent for 15 minutes to 85 percent for 10 minutes; add node swap utilization above 50 percent for 10 minutes; and add a warning when `node_vmstat_oom_kill` increases within five minutes. Preserve the repository's Grafana-native YAML structure, Mimir datasource, warning labels, one-minute evaluation interval, and existing notification routing.
- **Dispatch**: subagent
- **Dispatch rationale**: The alert files are disjoint from storage implementation and form a bounded observability task with established neighboring patterns.

### Task 4.2: Reconcile alert rules to Grafana
- **Implements**: `observability` ADDED Requirement: Ceph OSD Memory Growth Alert; `observability` ADDED Requirement: Cluster Node Memory Exhaustion Alerts
- **Depends on**: Task 4.1
- **Files**: none beyond Grafana-managed live resources
- **Approach**: Run the repository alert-rule reconciliation script with the existing Grafana credentials and organization ID. Confirm the four rule titles are accepted without adding contact points or notification policies.
- **Dispatch**: inline
- **Dispatch rationale**: Reconciliation is a mechanical live operation after the rule definitions are complete.

### Stage Verification

- **Commands**:
  ```bash
  bun -e 'import { parse } from "yaml"; for (const path of process.argv.slice(1)) parse(await Bun.file(path).text())' grafana/alert-rules/ceph/alerts/cephosdmemoryhigh-ar-45769a185d9b35b89fb8dd03.yaml grafana/alert-rules/node/alerts/nodememoryhighutilization-ar-c24b2972a5625afbb718ffcc.yaml grafana/alert-rules/node/alerts/nodeswaphighutilization-ar-12ef97bede19a0e958f89648.yaml grafana/alert-rules/node/alerts/nodeoomkilldetected-ar-2684fb6d521f3a5e3f8edca8.yaml
  GRAFANA_ORG_ID=1 ./scripts/apply-grafana-alert-rules.sh
  ```
- **Expected outcome**: All four YAML files parse successfully; Grafana reconciliation exits successfully; `CephOSDMemoryHigh`, `NodeMemoryHighUtilization`, `NodeSwapHighUtilization`, and `NodeOOMKillDetected` are managed through existing routing with warning severity.
- **Evidence artifact**: Record normalized parse and reconciliation results in this stage's Evidence block; retain reconciliation output only on failure or ambiguity.

- [x] Stage 4 complete

### Evidence

- **Date**: 2026-07-26
- **Commands**: planned Bun YAML parse; `GRAFANA_ORG_ID=1 ./scripts/apply-grafana-alert-rules.sh` with managed credentials and the external Grafana endpoint; Grafana provisioning API title query; direct Mimir evaluation of the three new PromQL expressions.
- **Exit status**: 0 for YAML parsing, reconciliation, provisioning query, and all PromQL evaluations
- **Result summary**: All four YAML files parsed, Grafana reconciled 436 managed rule resources, and the provisioning API returned `CephOSDMemoryHigh` at 10m/warning, `NodeMemoryHighUtilization` at 10m/warning, `NodeSwapHighUtilization` at 10m/warning, and `NodeOOMKillDetected` at 0s/warning. All three new PromQL expressions returned success from Mimir; OSD and OOM had zero active series, while the cluster-wide swap rule identified Luna at 50.65 percent.
- **Meaningful warnings/errors**: The managed secret's cluster-internal Grafana URL was not resolvable from the workstation, so reconciliation used `https://grafana.holdenitdown.net` with the same credentials. The script's intentionally ignored deletion of the absent legacy `alert-rules` folder returned 404 before the successful 436-resource push.
- **Raw output**: omitted; normalized reconciliation, rule metadata, and query evaluation results are recorded above.
- **Files changed (across the stage)**: `grafana/alert-rules/ceph/alerts/cephosdmemoryhigh-ar-45769a185d9b35b89fb8dd03.yaml`, `grafana/alert-rules/node/alerts/nodememoryhighutilization-ar-c24b2972a5625afbb718ffcc.yaml`, `grafana/alert-rules/node/alerts/nodeswaphighutilization-ar-12ef97bede19a0e958f89648.yaml`, `grafana/alert-rules/node/alerts/nodeoomkilldetected-ar-2684fb6d521f3a5e3f8edca8.yaml`, `docs/specs/changes/protect-apollo-memory/tasks.md`; Grafana-managed alert and recording rules were reconciled.
- **AGENTS.md notes applied**: no comments added; neighboring Grafana-native YAML, Mimir datasource, warning labels, and one-minute trigger patterns preserved; no secrets were written or printed.
- **Subagent statuses**: Task 4.1: DONE; Task 4.2 executed inline.

## Coverage Matrix

| Requirement | Tasks |
| --- | --- |
| `storage` ADDED Requirement: Pantheon OSD Memory Containment | 1.1, 1.2, 3.1, 3.2 |
| `storage` ADDED Requirement: OSD Memory Control Rollout Safety | 2.1, 3.1, 3.2 |
| `observability` ADDED Requirement: Ceph OSD Memory Growth Alert | 4.1, 4.2 |
| `observability` ADDED Requirement: Cluster Node Memory Exhaustion Alerts | 4.1, 4.2 |

## Review Summary

- **CRITICAL**: None.
- **WARNING**: None.
- **SUGGESTION**: None.
- All ADDED requirement names are absent from the current stable specs, every requirement has testable Given/When/Then scenarios, and RFC 2119 language is consistent.

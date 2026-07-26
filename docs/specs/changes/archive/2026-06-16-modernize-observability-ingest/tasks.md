# Tasks: modernize-observability-ingest

**Status**: approved

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `observability` ADDED: `Current Observability Backend Charts` | 3.1, 4.1 |
| `observability` ADDED: `Shared Observability Kafka Cluster` | 1.1, 3.1 |
| `observability` ADDED: `Mimir Ingest Storage` | 1.1, 3.1 |
| `observability` ADDED: `Tempo Kafka Write Path` | 1.1, 3.1 |
| `observability` ADDED: `Loki Distributed TSDB Storage` | 4.1 |
| `observability` ADDED: `Existing Observability Entry Points` | 3.1, 4.1 |
| `architecture` ADDED: `Strimzi Operator Program` | 1.1, 2.1 |
| `architecture` ADDED: `Observability-Owned Kafka Resources` | 1.1, 3.1 |
| `architecture` ADDED: `Kafka Availability Defaults` | 1.1, 3.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: do not add comments unless explicitly requested, follow existing neighboring patterns, check imports before using libraries, never expose secrets, specify return types for public functions, avoid refactoring language in code, and use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/`, `src/`, or `programs/` for this plan's affected paths.

---

## Contract Boundary Assessment

- **Status**: required
- **Surfaces**: exported Pulumi component/module interfaces in `src/components/strimzi.ts`, `src/components/strimzi-kafka-cluster.ts`, `src/components/mimir.ts`, `src/components/tempo.ts`, `src/modules/grafana-stack.ts`; Kafka topic names `mimir-ingest` and `tempo-traces`
- **Rationale**: the change adds layer interfaces consumed by the Grafana stack and defines internal Kafka topic contracts used by Mimir and Tempo.
- **Contract file**: `docs/specs/changes/modernize-observability-ingest/contracts.md`

If status is `required`, `contracts.md` MUST contain the exact approved contract changes and Stage 1 MUST be contract-boundary-only. Implementation stages depend on Stage 1 evidence proving the changed contract surfaces match `contracts.md`.

---

## Stage 1: Contract Boundaries

### Task 1.1: Add observability ingest contracts

- **Implements**: `observability` ADDED Requirement: `Shared Observability Kafka Cluster`; `observability` ADDED Requirement: `Mimir Ingest Storage`; `observability` ADDED Requirement: `Tempo Kafka Write Path`; `architecture` ADDED Requirement: `Strimzi Operator Program`; `architecture` ADDED Requirement: `Observability-Owned Kafka Resources`; `architecture` ADDED Requirement: `Kafka Availability Defaults`
- **Depends on**: approved `contracts.md`
- **Files**: `src/components/strimzi.ts`, `src/components/strimzi-kafka-cluster.ts`, `src/components/mimir.ts`, `src/components/tempo.ts`, `src/modules/grafana-stack.ts`
- **Approach**: Add only the exported interfaces, class surfaces, optional args, and topic-name constants described in `contracts.md`. Keep implementation inert except for compile-required stubs so later stages can fill Helm values and custom resources after the contract boundary is verified.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: command exits successfully; changed exported symbols and Kafka topic names match `docs/specs/changes/modernize-observability-ingest/contracts.md`.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path.

#### Evidence

- **Date**: 2026-06-16
- **Commands**:
  ```
  bun run typecheck
  ```
- **Exit status**: 0
- **Result summary**:
  ```
  tsc --noEmit completed successfully.
  Exported Strimzi, StrimziKafkaCluster, MimirArgs.kafka, TempoArgs.kafka, GrafanaStackArgs.observabilityKafka, and topic names match contracts.md.
  ```
- **Meaningful warnings/errors**: none
- **Raw output**: omitted; passing output contained only the invoked `tsc --noEmit` command.
- **Files changed (across the stage)**:
  - `src/components/strimzi.ts`
  - `src/components/strimzi-kafka-cluster.ts`
  - `src/components/mimir.ts`
  - `src/components/tempo.ts`
  - `src/modules/grafana-stack.ts`
- **AGENTS.md notes applied**: root `AGENTS.md` notes from this plan: no comments unless requested, follow neighboring patterns, check imports, avoid secrets, specify return types for public functions, avoid refactoring language, use Bun.
- **Subagent statuses**:
  - Task 1.1: DONE_WITH_CONCERNS. Concern accepted because stage verification is intentionally run at the stage boundary, and the untracked change folder was created by this change.

- [x] Stage 1 complete

---

## Stage 2: Strimzi Operator Program

### Task 2.1: Add Strimzi operator stack

- **Implements**: `architecture` ADDED Requirement: `Strimzi Operator Program`
- **Depends on**: Stage 1 complete
- **Files**: `src/components/strimzi.ts`, `src/helm-charts.ts`, `programs/strimzi/index.ts`, `programs/strimzi/Pulumi.pantheon.yaml`
- **Approach**: Implement the Strimzi Helm component following the CloudNativePG operator-only pattern, add the chart pin, create the `programs/strimzi` Pulumi entrypoint and pantheon stack config, and ensure it installs the operator without creating Kafka clusters or topics.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/strimzi --stack pantheon --non-interactive
  ```
- **Expected outcome**: both commands exit successfully; preview renders the Strimzi operator resources without observability Kafka cluster or topic resources.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path.

#### Evidence

- **Date**: 2026-06-16
- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/strimzi --stack pantheon --non-interactive
  ```
- **Exit status**: 0 after initializing the new `pantheon` stack for `programs/strimzi`.
- **Result summary**:
  ```
  tsc --noEmit completed successfully.
  Pulumi preview completed successfully for stack strimzi-pantheon with 31 resources to create.
  Preview rendered the Strimzi namespace, Helm chart, operator Deployment, CRDs, RBAC, ServiceAccount, and ConfigMap.
  Preview did not render Kafka or KafkaTopic custom resources from the operator program.
  ```
- **Meaningful warnings/errors**: the first preview attempt failed with `no stack named 'pantheon' found`; `pulumi stack init pantheon -C programs/strimzi --non-interactive` created the new stack, and the approved preview command then passed.
- **Raw output**: omitted; passing output was a routine Pulumi preview resource list.
- **Files changed (across the stage)**:
  - `src/components/strimzi.ts`
  - `src/helm-charts.ts`
  - `programs/strimzi/index.ts`
  - `programs/strimzi/Pulumi.yaml`
  - `programs/strimzi/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: root `AGENTS.md` notes from this plan: no comments unless requested, follow neighboring patterns, check imports, avoid secrets, specify return types for public functions, avoid refactoring language, use Bun.
- **Subagent statuses**:
  - Task 2.1: DONE_WITH_CONCERNS. Concern accepted because `programs/strimzi/Pulumi.yaml` is required for the planned new Pulumi program and contains only standard project metadata.

- [x] Stage 2 complete

---

## Stage 3: Mimir And Tempo Kafka Ingest

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 3.1: Wire shared Kafka into Mimir and Tempo

- **Implements**: `observability` ADDED Requirement: `Current Observability Backend Charts`; `observability` ADDED Requirement: `Shared Observability Kafka Cluster`; `observability` ADDED Requirement: `Mimir Ingest Storage`; `observability` ADDED Requirement: `Tempo Kafka Write Path`; `observability` ADDED Requirement: `Existing Observability Entry Points`; `architecture` ADDED Requirement: `Observability-Owned Kafka Resources`; `architecture` ADDED Requirement: `Kafka Availability Defaults`
- **Depends on**: Stage 1 complete; Stage 2 complete
- **Files**: `src/components/strimzi-kafka-cluster.ts`, `src/components/mimir.ts`, `src/components/tempo.ts`, `src/modules/grafana-stack.ts`, `src/helm-charts.ts`, `programs/grafana/index.ts`, `programs/grafana/Pulumi.pantheon.yaml`
- **Approach**: Implement the Strimzi Kafka cluster and topic resources inside the Grafana observability stack, add HA-oriented defaults with configurable replicas/storage, enable Mimir ingest storage using the `mimir-ingest` topic, configure Tempo's current Kafka-backed distributed write path using the `tempo-traces` topic, and preserve existing Alloy-facing Mimir remote write and Tempo OTLP endpoints.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/grafana --stack pantheon --non-interactive
  ```
- **Expected outcome**: both commands exit successfully; preview renders observability-owned Strimzi Kafka resources, Mimir ingest-storage configuration, and Tempo Kafka write-path configuration without changing public Grafana or telemetry hostnames.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path.

#### Evidence

- **Date**: 2026-06-16
- **Commands**:
  ```
  bun run typecheck
  PULUMI_K8S_ENABLE_PATCH_FORCE=true pulumi preview -C programs/grafana --stack pantheon --non-interactive
  ```
- **Exit status**: 0
- **Result summary**:
  ```
  tsc --noEmit completed successfully.
  Pulumi preview completed successfully for stack grafana-pantheon.
  Preview rendered observability-owned Strimzi Kafka resources: StrimziKafkaCluster, Kafka, and KafkaTopic resources for mimir-ingest and tempo-traces.
  Preview rendered Mimir updates with kafka ingest storage configuration.
  Preview rendered Tempo updates with kafka ingest configuration, block-builder and live-store Services/StatefulSets, and removal of the ingester path.
  Public Grafana and telemetry hostnames were not changed.
  ```
- **Meaningful warnings/errors**: initial preview without patch-force failed on a Kubernetes server-side apply field conflict for `tempo/grafana-stack-tempo-chart-query-frontend`; the documented one-time `PULUMI_K8S_ENABLE_PATCH_FORCE=true` override resolved the preview conflict. Pulumi preview showed `grafanaServiceUrl` output changing from `http://grafana-stack-grafana-chart-grafana.grafana:80` to `http://grafana-stack-grafana-chart.grafana:80`; public ingress hostname remains unchanged.
- **Raw output**: omitted; passing output was a routine Pulumi preview resource list.
- **Files changed (across the stage)**:
  - `src/components/strimzi-kafka-cluster.ts`
  - `src/components/mimir.ts`
  - `src/components/tempo.ts`
  - `src/modules/grafana-stack.ts`
  - `src/helm-charts.ts`
  - `programs/grafana/index.ts`
  - `programs/grafana/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: root `AGENTS.md` notes from this plan: no comments unless requested, follow neighboring patterns, check imports, avoid secrets, specify return types for public functions, avoid refactoring language, use Bun.
- **Subagent statuses**:
  - Task 3.1: DONE_WITH_CONCERNS. Concern about Tempo chart support was resolved by verifying chart values for `ingest.kafka`, `blockBuilder`, and `liveStore`, then updating `src/components/tempo.ts` to use those values.

- [x] Stage 3 complete

---

## Stage 4: Loki OSS Chart Path

### Task 4.1: Update Loki while keeping TSDB storage

- **Implements**: `observability` ADDED Requirement: `Current Observability Backend Charts`; `observability` ADDED Requirement: `Loki Distributed TSDB Storage`; `observability` ADDED Requirement: `Existing Observability Entry Points`
- **Depends on**: Stage 3 complete
- **Files**: `src/components/loki.ts`, `src/helm-charts.ts`, `programs/grafana/Pulumi.pantheon.yaml`
- **Approach**: Move Loki to the current OSS-maintained chart source/version, keep `deploymentMode: Distributed`, keep TSDB object storage and existing Alloy log ingestion paths, and avoid introducing Kafka dependencies for Loki.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi preview -C programs/grafana --stack pantheon --non-interactive
  ```
- **Expected outcome**: both commands exit successfully; preview keeps Loki distributed with TSDB object storage and does not add Loki Kafka dependencies.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path.

#### Evidence

- **Date**: 2026-06-16
- **Commands**:
  ```
  bun run typecheck
  PULUMI_K8S_ENABLE_PATCH_FORCE=true pulumi preview -C programs/grafana --stack pantheon --non-interactive
  ```
- **Exit status**: 0
- **Result summary**:
  ```
  tsc --noEmit completed successfully.
  Pulumi preview completed successfully for stack grafana-pantheon.
  Preview kept Loki in Distributed mode with TSDB object storage and existing S3 bucket configuration.
  Preview did not render Loki Kafka resources or Loki Kafka dependencies.
  Loki chart source moved to grafana-community with chart version 6.55.0, the OSS migration fork point, avoiding the 17.x chart layout replacement that hit an immutable ruler StatefulSet preview failure.
  ```
- **Meaningful warnings/errors**: preview uses `PULUMI_K8S_ENABLE_PATCH_FORCE=true` because the Stage 3 Tempo upgrade requires the documented one-time Kubernetes server-side apply conflict override. A trial with the latest community Loki chart `17.4.4` failed preview because it attempted an immutable Loki ruler StatefulSet replacement; the implemented community fork point `6.55.0` passed preview.
- **Raw output**: omitted; passing output was a routine Pulumi preview resource list.
- **Files changed (across the stage)**:
  - `src/components/loki.ts`
  - `src/helm-charts.ts`
  - `programs/grafana/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: root `AGENTS.md` notes from this plan: no comments unless requested, follow neighboring patterns, check imports, avoid secrets, specify return types for public functions, avoid refactoring language, use Bun.
- **Subagent statuses**:
  - Task 4.1: inline completion. No subagent dispatched for this stage; the required edit was limited to the Loki chart source/version and verification-driven adjustment from `17.4.4` to `6.55.0`.

- [x] Stage 4 complete

---

## Follow-ups

None.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: (none — CRITICAL findings return the change to `writing-specs` before planning)
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan and required `contracts.md` (written). Execution starts with the contract-boundary stage and implementation stages remain blocked until Stage 1 evidence proves the changed contract surfaces match `contracts.md`.

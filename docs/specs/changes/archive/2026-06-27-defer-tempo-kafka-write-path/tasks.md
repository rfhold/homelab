# Tasks: defer-tempo-kafka-write-path

**Status**: approved

## Coverage Matrix

| Requirement | Task(s) |
| --- | --- |
| `observability` MODIFIED Requirement: Current Observability Backend Charts | 2.1 |
| `observability` MODIFIED Requirement: Shared Observability Kafka Cluster | 1.1, 2.1 |
| `observability` MODIFIED Requirement: Tempo Kafka Write Path | 1.1, 2.1 |
| `architecture` MODIFIED Requirement: Observability-Owned Kafka Resources | 1.1, 2.1 |
| `architecture` MODIFIED Requirement: Kafka Availability Defaults | 2.1 |

## AGENTS.md Notes

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: no comments unless explicitly requested; follow existing neighboring patterns; check imports before using libraries; never commit secrets or expose sensitive data; always specify return types for public functions; avoid refactoring language in code; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/`, `src/`, or `programs/` paths touched by this plan.

## Contract Boundary Assessment

- **Status**: required
- **Surfaces**: `src/components/tempo.ts` exported `TempoArgs`, `src/components/strimzi-kafka-cluster.ts` exported `OBSERVABILITY_KAFKA_TOPICS`, `src/modules/grafana-stack.ts` exported `GrafanaStackArgs.observabilityKafka.topics`
- **Rationale**: this change removes the Tempo Kafka topic and Tempo Kafka connection from exported Pulumi component/module interfaces.
- **Contract file**: `docs/specs/changes/defer-tempo-kafka-write-path/contracts.md`

---

## Stage 1: Contract Boundaries

Wait for the results from prior tasks before starting dependent sub agent tasks.

- **Depends on**: approved `contracts.md`

### Task 1.1: Remove Tempo Kafka contract surfaces

- **Implements**: `observability` MODIFIED Requirement: `Shared Observability Kafka Cluster`; `observability` MODIFIED Requirement: `Tempo Kafka Write Path`; `architecture` MODIFIED Requirement: `Observability-Owned Kafka Resources`
- **Depends on**: approved `contracts.md`
- **Files**: `src/components/tempo.ts`, `src/components/strimzi-kafka-cluster.ts`, `src/modules/grafana-stack.ts`
- **Approach**: Apply `contracts.md` exactly by removing Tempo Kafka args/topic fields from exported surfaces, plus only compile-required call-site stubs that reference those removed fields.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: command exits successfully; exported Tempo/Kafka/GrafanaStack contract surfaces match `contracts.md` and no removed Tempo Kafka contract references remain.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path.

#### Evidence

- **Date**: 2026-06-27
- **Commands**:
  ```
  bun run typecheck
  ```
- **Exit status**: 0
- **Result summary**:
  ```
  tsc --noEmit completed successfully.
  Exported TempoArgs no longer exposes kafka.
  OBSERVABILITY_KAFKA_TOPICS no longer exposes tempoTraces.
  GrafanaStackArgs.observabilityKafka.topics no longer exposes tempoTraces.
  Mimir Kafka support remains intact.
  ```
- **Meaningful warnings/errors**: none
- **Raw output**: omitted; passing output contained only the invoked `tsc --noEmit` command.
- **Files changed (across the stage)**:
  - `src/components/tempo.ts`
  - `src/components/strimzi-kafka-cluster.ts`
  - `src/modules/grafana-stack.ts`
- **AGENTS.md notes applied**: root `AGENTS.md` notes from this plan: no comments unless requested, follow neighboring patterns, check imports, avoid secrets, specify return types for public functions, avoid refactoring language, use Bun.
- **Subagent statuses**:
  - Task 1.1: DONE_WITH_CONCERNS. Concern accepted because remaining `programs/grafana/index.ts` config cleanup is outside the contract-boundary file set and is assigned to Stage 2.

- [x] Stage 1 complete

---

## Stage 2: Implementation

Wait for the results from prior tasks before starting dependent sub agent tasks.

- **Depends on**: Stage 1 complete

### Task 2.1: Defer Tempo Kafka write path while keeping Mimir Kafka

- **Implements**: `observability` MODIFIED Requirement: `Current Observability Backend Charts`; `observability` MODIFIED Requirement: `Shared Observability Kafka Cluster`; `observability` MODIFIED Requirement: `Tempo Kafka Write Path`; `architecture` MODIFIED Requirement: `Observability-Owned Kafka Resources`; `architecture` MODIFIED Requirement: `Kafka Availability Defaults`
- **Depends on**: Stage 1 complete
- **Files**: `src/components/tempo.ts`, `src/components/strimzi-kafka-cluster.ts`, `src/modules/grafana-stack.ts`, `programs/grafana/index.ts`, `programs/grafana/Pulumi.pantheon.yaml`
- **Approach**: Remove Tempo `ingest.kafka`, `blockBuilder`, `liveStore`, and ingester-disable chart values; keep Tempo on the community chart and released ingester-based distributed path; keep Mimir Kafka ingest storage and one observability Kafka cluster/topic for `mimir-ingest`; ensure Grafana preview does not render `tempo-traces`, Tempo block-builder, or Tempo live-store resources.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  PULUMI_K8S_ENABLE_PATCH_FORCE=true pulumi preview -C programs/grafana --stack pantheon --non-interactive
  ```
- **Expected outcome**: both commands exit successfully; preview keeps Mimir Kafka ingest and the `mimir-ingest` topic, does not render a `tempo-traces` topic, does not render Tempo block-builder/live-store resources, and keeps Tempo OTLP plus metrics-generator remote write paths.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path.

#### Evidence

- **Date**: 2026-06-27
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
  Preview creates the observability StrimziKafkaCluster, Strimzi Kafka cluster, and only the mimir-ingest KafkaTopic.
  Preview keeps Mimir Kafka ingest storage enabled.
  Preview does not render a tempo-traces KafkaTopic.
  Preview does not render Tempo block-builder or live-store resources.
  Tempo remains on the existing ingester-based path while preserving OTLP and metrics-generator remote_write configuration.
  ```
- **Meaningful warnings/errors**: Pulumi reported a newer version is available. The preview still uses documented `PULUMI_K8S_ENABLE_PATCH_FORCE=true` because earlier chart updates require the Kubernetes server-side apply conflict override. Preview continues to show `grafanaServiceUrl` changing from `http://grafana-stack-grafana-chart-grafana.grafana:80` to `http://grafana-stack-grafana-chart.grafana:80`; public hostnames remain unchanged.
- **Raw output**: omitted; passing output was a routine Pulumi preview resource list.
- **Files changed (across the stage)**:
  - `src/components/tempo.ts`
  - `src/components/strimzi-kafka-cluster.ts`
  - `src/modules/grafana-stack.ts`
  - `programs/grafana/index.ts`
  - `programs/grafana/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: root `AGENTS.md` notes from this plan: no comments unless requested, follow neighboring patterns, check imports, avoid secrets, specify return types for public functions, avoid refactoring language, use Bun.
- **Subagent statuses**:
  - Task 2.1: DONE

- [x] Stage 2 complete

---

## Follow-ups

- Track `grafana-community/helm-charts` Tempo 3 chart migration and reintroduce Tempo Kafka write-path requirements after a maintained chart release carries a Tempo 3 application version.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan and required `contracts.md` (written). Execution starts with the contract-boundary stage and implementation stages remain blocked until Stage 1 evidence proves the changed contract surfaces match `contracts.md`.

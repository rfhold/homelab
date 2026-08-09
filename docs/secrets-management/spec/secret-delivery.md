# Secret Delivery

## Purpose

This specification governs how OpenBao-backed values reach Pulumi automation and Kubernetes workloads during the initial adoption period.

## Requirements

### Requirement: Pulumi Workload Delivery Boundary

Pulumi MUST remain the mechanism that renders Kubernetes `Secret` resources for workloads. A workload MAY source its value through an approved OpenBao workflow, but direct pod-side OpenBao injection is outside the first-rollout contract.

#### Scenario: A workload consumes a Kubernetes Secret

- Given an approved value is held in OpenBao
- When a Pulumi program reconciles the workload
- Then Pulumi materializes the Kubernetes Secret expected by that workload without committing the value to source

#### Scenario: Direct injection is proposed

- Given a proposal uses External Secrets Operator, CSI, or an injector sidecar
- When it is evaluated against the first-rollout boundary
- Then it is deferred to a separate specification and approval

### Requirement: Transit Secrets Provider

A migrated Pulumi stack MUST use the configured OpenBao Transit key through Pulumi's Vault-compatible `hashivault://` provider. Migration MUST be performed and verified one stack at a time with an approved recovery path.

#### Scenario: A stack changes providers

- Given OpenBao is initialized and unsealed, Transit and its key exist, and a least-privilege token is available
- When an authorized operator changes the stack secrets provider
- Then the stack can read its configuration through the new provider before the migration is considered complete

### Requirement: Tekton Credential Prerequisites

Before Tekton reconciles OpenBao-backed Pulumi credentials, operators MUST provide a non-empty least-privilege OpenBao token and Pulumi backend URL through the approved environment. The initial root token MUST NOT be used for pipeline automation.

#### Scenario: Required environment is absent

- Given `OPENBAO_PULUMI_TOKEN` or its compatibility fallback is empty, or `PULUMI_BACKEND_URL` is empty
- When a Tekton update is prepared
- Then the operator stops before applying the resulting credential Secret

### Requirement: Secret Handling

Root tokens, unseal or recovery material, OIDC client secrets, Transit automation tokens, Pulumi secret values, and Kubernetes Secret data MUST NOT appear in repository files, command transcripts, screenshots, or operational evidence.

#### Scenario: An operator records bootstrap evidence

- Given bootstrap or migration succeeds
- When evidence is written
- Then it contains status, identifiers, timestamps, and sanitized outcomes only

### Requirement: Pipeline Grafana Credentials

The Tekton Pulumi program MUST use Grafana administrator credentials only as provider inputs to provision a dedicated Admin service account for pipeline automation. It MUST deliver a non-expiring service-account token through the `pipelines-as-code/grafana-credentials` Kubernetes Secret with `GRAFANA_URL` and `GRAFANA_TOKEN` keys, and MUST NOT materialize the Grafana administrator username or password in that Secret.

#### Scenario: Grafana pipeline credentials reconcile

- Given the Grafana runtime stack exports its API URL and administrator credentials
- When the Tekton stack reconciles
- Then it provisions the dedicated pipeline service account and writes only its URL and token contract to the pipeline Secret

#### Scenario: A pipeline uses Grafana credentials

- Given a PipelineRun needs Grafana API access
- When its task is defined
- Then the task explicitly references the approved Secret keys rather than receiving Grafana credentials globally

## References

- [`programs/tekton/index.ts`](../../../programs/tekton/index.ts)
- [`src/components/tekton.ts`](../../../src/components/tekton.ts)
- [OpenBao operations](../../operations/openbao.md)
- [Unresolved migration state](../verification.md)

# Secret Delivery

## Purpose

This specification governs Pulumi and Tekton secret delivery, including Kuri's task-local OpenBao access.

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

OpenBao MUST expose Transit at mount `transit` with key `pulumi`. The `openbao/pantheon` stack MUST remain the sole Pulumi owner for the mount, key, `pulumi-transit` policy, and `cyber` CLI OIDC role. The role MUST receive only the required Transit encrypt and decrypt operations for that key.

Before creation or import, an authorized inventory MUST inspect each mount, key, auth method, policy, and role. Operators MUST stop on unmanaged ownership, incompatible configuration, or ambiguous identity. An exact current object MUST use a checkpoint-backed import under separate state-mutation authorization.

#### Scenario: A stack changes providers

- Given OpenBao is initialized and unsealed and the `transit/pulumi` key exists
- When an authorized Pulumi operator uses Transit
- Then its token can encrypt and decrypt through that key without unrelated OpenBao access

### Requirement: Isolated Secrets-Provider Canary

Only the no-infrastructure `openbao-secrets-canary` stack MUST use `hashivault://pulumi` under this contract. The stack MUST own no cloud, Kubernetes, Authentik, S3, or OpenBao resource. It MUST store one non-displayed secret value only to test checkpoint encryption and decryption.

The canary MUST read `VAULT_SERVER_URL` and `VAULT_SERVER_TOKEN` from the trusted runtime environment. The token MUST NOT enter stack configuration, source, checkpoint output, or evidence. A no-change preview MAY verify that Pantheon Transit can decrypt the canary configuration without displaying its value.

The canary proves only the Pantheon Transit provider path. It does not prove snapshot creation, backup, restoration, failover, or disaster recovery. Any migration beyond the canary requires a separate specification and approval.

#### Scenario: The canary uses Transit

- Given Transit and a least-privilege runtime token are available
- When an operator receives separate state-mutation authorization
- Then only the canary uses `hashivault://pulumi` and its secret remains undisclosed

#### Scenario: A broader migration is proposed

- Given any other stack is proposed for OpenBao-backed state encryption
- When an operator proposes a secrets-provider change
- Then the operator rejects the migration under this contract

### Requirement: Current Tekton Credential Prerequisites

Tekton MUST continue to receive a non-empty `PULUMI_CONFIG_PASSPHRASE` and `PULUMI_BACKEND_URL` through the approved environment until a separate change migrates its Pulumi secrets provider. Tekton MUST NOT receive an OpenBao root token.

#### Scenario: Required environment is absent

- Given `PULUMI_CONFIG_PASSPHRASE` or `PULUMI_BACKEND_URL` is empty
- When a Tekton update is prepared
- Then the operator stops before applying the resulting credential Secret

### Requirement: Kuri Release Secret Delivery

The `openbao/pantheon` stack MUST own a KV v2 mount at `kv`. Pulumi MUST manage only the mount configuration. Pulumi MUST NOT manage, read, export, or persist any Kuri secret payload.

An authorized operator MUST import Android signing material at logical path `ci/kuri/android-signing`. The payload MUST contain only `keystore-base64`, `store-password`, `key-alias`, and `key-password`. The operator MUST import the repository-scoped Forgejo token at logical path `ci/kuri/forgejo-release` under field `token`.

The `tekton/pantheon` stack MUST consume the OpenBao URL, Kubernetes auth path, and KV mount path through the current attachment gate. It MUST own separate build and publication identities. Each identity MUST use one exact ServiceAccount, namespace, audience, role, and policy. Each role MUST issue non-renewable batch tokens with no `default` policy and a 900-second TTL and maximum TTL.

Build policy `kuri-tauri-build-v1` MUST grant only `read` on `kv/data/ci/kuri/android-signing` plus `read` on `auth/token/lookup-self`. Publication policy `kuri-forgejo-release-v1` MUST grant only `read` on `kv/data/ci/kuri/forgejo-release` plus `read` on `auth/token/lookup-self`. Neither policy MUST grant list, metadata, sibling-secret, write, delete, token-renewal, or token-revocation capabilities.

The current `pipelines-as-code/android-keystore` Kubernetes Secret MUST remain for finance and cuthulu compatibility. Kuri MUST NOT use that compatibility Secret under this contract.

#### Scenario: A Kuri build reads signing material

- Given a task uses `pipelines-as-code/kuri-tauri-build-v1` and projects audience `kuri-tauri-build-v1`
- When it authenticates to role `kuri-tauri-build-v1`
- Then its batch token can read only the Android signing payload and its own token metadata

#### Scenario: A Kuri publication task reads its token

- Given a task uses `pipelines-as-code/kuri-forgejo-release-v1` and projects audience `kuri-forgejo-release-v1`
- When it authenticates to role `kuri-forgejo-release-v1`
- Then its batch token can read only the Forgejo publication payload and its own token metadata

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

- [`programs/openbao-secrets-canary/index.ts`](../../../programs/openbao-secrets-canary/index.ts)
- [`programs/tekton/index.ts`](../../../programs/tekton/index.ts)
- [`src/components/tekton.ts`](../../../src/components/tekton.ts)
- [OpenBao operations](../../operations/openbao.md)
- [Kuri release secret bootstrap](../../operations/kuri-release-secret-bootstrap.md)
- [Unresolved migration state](../verification.md)

# OpenBao

## Purpose

This specification governs the Pantheon OpenBao deployment, operator authentication, approved Transit use, and the explicit absence of an OpenBao backup or disaster-recovery deployment.

## Requirements

### Requirement: Pantheon Raft Deployment

OpenBao MUST target Pantheon as a three-voter integrated Raft cluster. Each voter MUST use an independent `10Gi` `ReadWriteOnce` volume on the `database` storage class, and scheduling MUST prevent voters from sharing a Kubernetes hostname.

#### Scenario: The Pantheon stack is rendered

- Given the Pantheon stack configuration is selected
- When OpenBao resources are constructed
- Then the chart renders three Raft replicas, one persistent claim per voter, active and standby Services, and a disruption budget that preserves quorum during one voluntary disruption

### Requirement: Canonical Internal Route

The Pantheon deployment MUST own `openbao.holdenitdown.net` through the internal Gateway's matching HTTPS listener. The route MUST select only the active OpenBao pod and MUST NOT attach to a plaintext HTTP listener. No Romulus OpenBao deployment MUST own a route.

#### Scenario: A client uses the canonical hostname

- Given the Pantheon Raft cluster has an active leader
- When an internal client connects to `openbao.holdenitdown.net`
- Then the Gateway terminates TLS and routes the request to the active OpenBao pod

### Requirement: Manual Initialization And Unseal

The Pantheon cluster MUST be initialized exactly once with five Shamir shares and a threshold of three. Every Raft voter MUST be unsealed manually after it starts. Initialization output and the initial root token MUST be transferred directly to approved secure storage outside the repository.

#### Scenario: Fresh Pantheon storage is initialized

- Given an authorized operator confirms every Pantheon voter uses fresh storage and OpenBao reports `Initialized: false`
- When the operator follows the [guarded runbook](../../operations/openbao.md)
- Then one cryptographic domain is initialized and all three unsealed voters join the same Raft cluster

#### Scenario: A voter restarts sealed

- Given an initialized Raft voter returns in a sealed state
- When service restoration is authorized
- Then operators supply three distinct unseal shares interactively before returning the voter to service

### Requirement: Authentik Operator Authentication

Authentik OIDC MUST be the primary human login path after OpenBao is initialized and unsealed. Authentik MUST own its platform and shared flows, while the `openbao/pantheon` Pulumi stack MUST own `AuthentikOIDCApp("openbao-oidc")`, its random client secret, OAuth2 provider, application, group policy binding, and a dedicated OpenBao RSA certificate key pair. The key MUST use RSA-4096 and RS256 signing, MUST NOT be shared with another application, MUST remain Pulumi-secret-tainted, and MUST NOT be exported. Authentik registration MUST be enabled explicitly only for Pantheon.

The application MUST use a confidential client, policy engine mode `all`, and strict redirect matching for only the canonical OpenBao UI callback and localhost CLI callback. Its policy binding MUST look up and authorize the existing Authentik group named exactly `cyber`; the OpenBao stack MUST NOT create or mutate that group.

OpenBao API management MUST default to disabled and be enabled only for Pantheon. An explicit Vault-compatible Pulumi provider MUST manage the `oidc` backend and `operator` role at the canonical OpenBao HTTPS address. Program evaluation MUST require a non-empty runtime `VAULT_TOKEN` and MUST NOT fall back to `~/.vault-token`. The role MUST use `sub`, both approved callbacks, and only OpenBao's `default` policy. Provider authentication and the OIDC client secret MUST remain runtime secrets and MUST NOT enter stack configuration or non-secret outputs.

The write-only OIDC client secret MUST have an explicit positive integer `oidc-client-secret-version`. A client-secret rotation or replacement MUST atomically increment that version. Existing unmanaged API resources require separately authorized inventory, checkpoint-backed import when applicable, and a validated preview.

#### Scenario: An operator signs in

- Given the operator belongs to `cyber` and the Authentik application, OpenBao auth method, role, redirects, and `default` policy are configured
- When an operator starts UI or CLI login
- Then Authentik permits application access, issues an RS256-signed ID token, and OpenBao proves authentication without granting operator permissions

### Requirement: Transit Secrets Provider

The `openbao/pantheon` stack MUST own Transit mount `transit`, key `pulumi`, policy `pulumi-transit`, and the `cyber` CLI OIDC role. The key MUST remain AES256-GCM96, non-exportable, non-deletable, and unavailable for plaintext backup. The policy and role MUST grant only encrypt and decrypt updates for that key. Mounts, policies, or roles outside this boundary require a separately approved change.

#### Scenario: The Pulumi Transit key is used

- Given Transit is enabled at mount `transit` and key `pulumi` exists
- When an authorized `cyber` operator or the isolated canary uses Transit
- Then access is limited to encrypt and decrypt operations for that key

### Requirement: No OpenBao Backup Or DR Deployment

The repository MUST NOT maintain OpenBao snapshot workloads, snapshot API policy or authentication, backup object storage, backup image or pipeline source, backup alerts, age-custody tooling, a Romulus recovery route, or a Romulus DR workload. Pantheon Raft and Ceph-backed volumes provide availability, not backup or restoration.

The Transit canary MUST prove only that Pulumi can use Pantheon Transit as its secrets provider. It MUST NOT be described as backup, restoration, failover, or disaster-recovery evidence. No OpenBao backup or DR readiness claim is permitted under this contract.

#### Scenario: Availability is reviewed

- Given Pantheon has three healthy Raft voters on Ceph-backed volumes
- When an operator evaluates data recovery
- Then the operator records that HA is not backup and makes no restoration or disaster-recovery claim

### Requirement: Legacy Romulus Retirement

The legacy `openbao/romulus` deployment MUST remain retired. The repository MUST NOT retain a Romulus OpenBao stack configuration, deployment, route, or PVC. The empty Pulumi stack history and configuration record MAY remain until `pulumi stack rm romulus` receives separate explicit authorization; that record MUST NOT be described as managing resources.

#### Scenario: The retired target is reviewed

- Given the legacy resources were intentionally destroyed on 2026-08-13
- When an operator reviews the current Pantheon-only target
- Then no Romulus OpenBao deployment or PVC is expected, and removal of the empty stack record remains separately gated

### Requirement: Scope Boundary

This rollout MUST NOT add OpenBao backup or DR resources, auto-unseal, operator-managed PKI, dynamic credentials, public internet exposure, External Secrets Operator, CSI-mounted secrets, or injector sidecars. The Gateway backend and OpenBao API listener MAY remain HTTP, but that limitation MUST remain explicit until end-to-end API TLS is implemented. OpenBao's built-in mutually authenticated TLS cluster channel MUST remain enabled for server-to-server Raft traffic.

#### Scenario: A deferred capability is proposed

- Given an operator proposes backup, restoration, DR, auto-unseal, operator-managed end-to-end API TLS, or workload migration
- When the proposal changes the approved risk or delivery model
- Then it requires a separately approved change before implementation

## References

- [`src/components/openbao.ts`](../../../src/components/openbao.ts)
- [`programs/openbao/index.ts`](../../../programs/openbao/index.ts)
- [`programs/openbao/Pulumi.pantheon.yaml`](../../../programs/openbao/Pulumi.pantheon.yaml)
- [`src/components/authentik-oidc-app.ts`](../../../src/components/authentik-oidc-app.ts)
- [Tracked implementation](../implementation.md)
- [Verification state](../verification.md)

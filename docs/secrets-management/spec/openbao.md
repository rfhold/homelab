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

OpenBao API management MUST default to disabled and be enabled only for Pantheon. An explicit Vault-compatible Pulumi provider MUST manage the `oidc` backend and human roles at the canonical OpenBao HTTPS address. Program evaluation MUST require a non-empty runtime `VAULT_TOKEN` and MUST NOT fall back to `~/.vault-token`. The default `operator` role MUST remain unchanged: it MUST use `sub`, both approved callbacks, and only OpenBao's `default` policy. Provider authentication and the OIDC client secret MUST remain runtime secrets and MUST NOT enter stack configuration or non-secret outputs.

The non-default `admin` role MUST be available to the same Authentik `cyber` application audience, use `sub`, support both approved UI and CLI callbacks, and attach only the existing `openbao-pulumi-admin` policy without the automatic `default` policy. It MUST issue service tokens with a 30-minute TTL, maximum TTL, and explicit maximum TTL. This broad role retains the policy's explicit denies, but its allowed configuration surface can persist or expand privilege beyond the issuing token's lifetime.

The non-default `ssh` role MUST be available to the same Authentik `cyber` application audience, use `sub`, and support only the approved CLI callback. It MUST attach only policy `homelab-ssh-client-sign`, without the automatic `default` policy, and issue service tokens with an eight-hour TTL, maximum TTL, and explicit maximum TTL. That policy MUST grant only `update` on exact path `homelab-ssh-client/sign/homelab`, `read` on `auth/token/lookup-self`, and `update` on `auth/token/revoke-self`. It MUST NOT grant broader SSH or token-administration access. The cached token creates a fixed eight-hour exposure window unless it is revoked early; SSH certificates MUST remain limited to 15 minutes. The OpenBao program MUST NOT own the consumer-managed `homelab-ssh-client` mount or `homelab` signing role.

The write-only OIDC client secret MUST have an explicit positive integer `oidc-client-secret-version`. A client-secret rotation or replacement MUST atomically increment that version. Existing unmanaged API resources require separately authorized inventory, checkpoint-backed import when applicable, and a validated preview.

#### Scenario: An operator signs in

- Given the operator belongs to `cyber` and the Authentik application, OpenBao auth method, role, redirects, and `default` policy are configured
- When an operator starts UI or CLI login
- Then Authentik permits application access, issues an RS256-signed ID token, and OpenBao proves authentication without granting operator permissions

#### Scenario: A cyber member requests human administration

- Given the member is authorized for the existing Authentik application and explicitly selects role `admin`
- When the member completes UI or CLI login
- Then OpenBao returns a service token lasting no more than 30 minutes with only `openbao-pulumi-admin`

#### Scenario: A cyber member requests SSH signing access

- Given the member is authorized for the existing Authentik application and explicitly selects role `ssh`
- When the member completes CLI login
- Then OpenBao returns a service token fixed at eight hours whose only policy permits the exact homelab SSH signing route, self lookup, and self revocation
- And every signed SSH certificate remains limited to 15 minutes

### Requirement: OpenCode Bundle Grants

OpenCode API management MUST default to disabled and require the current OIDC API owner and exact Authentik authorization group `cyber`.
Pantheon MUST explicitly enable `openbao:opencode-api-management-enabled`.
The stack MUST NOT read or create KV payloads.

The dedicated CLI OIDC role `opencode` MUST use `sub`, policy `opencode-parent`, no automatic `default`, and service tokens.
Its TTL, maximum TTL, and explicit maximum TTL MUST each equal 604800 seconds.
Its only callback MUST be `http://localhost:8250/oidc/callback`.
The parent policy MUST grant only self lookup, self revocation, and exact named token-create endpoints for `opencode-env-catalog` and `opencode-env-read`.
It MUST NOT grant direct secret access, list access, generic token creation, orphan creation, renewal, `sudo`, or policy/role administration.
The current `operator`, `admin`, `ssh`, and `cyber` roles MUST retain their current configuration.
The OIDC mount tune MUST remain unchanged unless separately approved live inventory establishes a necessary increase.

The enabled feature MUST always declare two child roles and their same-named policies.
Policy `opencode-env-catalog` MUST grant only `list` on exact path `kv/metadata/env`, self lookup, and self revocation.
It MUST NOT grant recursive metadata access or secret data access.
Policy `opencode-env-read` MUST grant only `read` on `kv/data/env/*`, self lookup, and self revocation.
That read grant covers every bundle within the prefix, including paths absent from the picker.
The picker MUST control session injection only; it MUST NOT represent a per-bundle authorization boundary.
The plugin MUST validate flat catalog names dynamically before session injection.
Additional bundle names MUST NOT require infrastructure changes.
Each named token role MUST allow only that policy, disallow `default`, use no policy globs, and suppress automatic `default`.
The role MUST enforce non-orphan, non-renewable service tokens with an explicit maximum TTL of 60 seconds and no period.
The plugin requests a 60-second TTL; the role's explicit maximum MUST cap even a larger direct request.
Named role `allowed_policies` supplies the child policy without parent secret privileges or `sudo`.

Output `openbaoOpencodePluginConfig` MUST contain only `address`, `mount`, `prefix`, `oidc`, `catalogRole`, `readRole`, `parentTokenPolicies`, and `parentIdentityPolicies`.
The mount MUST equal `kv`; the prefix MUST equal `env`.
The child role fields MUST equal `opencode-env-catalog` and `opencode-env-read`, respectively.
It MUST omit tokens, keys, credentials, and workstation-specific executable paths.
Its expected parent token policies MUST equal `[opencode-parent]`; expected identity policies MUST equal `[]`.
Source MUST NOT imply that actual identity policy inheritance matches those expectations.
An authorized live canary MUST verify exact token and identity policies before plugin use.
When disabled, the output MUST equal `null` and the program MUST declare no OpenCode resources.

#### Scenario: Pantheon enables prefix grants

- Given the feature gate is enabled
- When the program constructs OpenCode resources
- Then it declares the parent policy, dedicated OIDC role, and both fixed child policies and token roles
- And the plugin configuration contains the catalog and read role names without a bundle map

#### Scenario: An operator adds a bundle

- Given an operator adds a valid flat bundle under `kv/env`
- When the plugin next requests the catalog
- Then the catalog grant can list its name without an infrastructure change
- And the read grant can read every bundle within the prefix, not only the session selection
- And direct requests for other policies or longer lifetimes cannot exceed the named role ceiling

### Requirement: Transit Secrets Provider

The `openbao/pantheon` stack MUST own Transit mount `transit`, key `pulumi`, policy `pulumi-transit`, and the `cyber` CLI OIDC role. The key MUST remain AES256-GCM96, non-exportable, non-deletable, and unavailable for plaintext backup. The policy and role MUST grant only encrypt and decrypt updates for that key. Mounts, policies, or roles outside this boundary require a separately approved change.

#### Scenario: The Pulumi Transit key is used

- Given Transit is enabled at mount `transit` and key `pulumi` exists
- When an authorized `cyber` operator or the isolated canary uses Transit
- Then access is limited to encrypt and decrypt operations for that key

### Requirement: Kubernetes-Authenticated CI Administration

OpenBao Kubernetes API management MUST default to disabled and MUST be enabled only for `openbao/pantheon`. When enabled, the OpenBao stack MUST enable the chart's TokenReview delegation for the OpenBao server ServiceAccount, mount Kubernetes auth at `auth/kubernetes`, and configure `https://kubernetes.default.svc:443` with OpenBao's pod-local ServiceAccount token and CA. The configuration MUST NOT persist a reviewer JWT in Pulumi state, stack configuration, outputs, or a Kubernetes Secret.

The OpenBao stack MUST own policy `openbao-pulumi-admin` and MUST NOT create a ServiceAccount in `pipelines-as-code` or the Kubernetes auth role that binds Tekton's identity. It MUST export its canonical URL, Kubernetes-auth enabled state, auth mount path, and administrator policy name as durable cross-stack contracts. The `tekton/pantheon` stack MUST consume those outputs and own ServiceAccount `pipelines-as-code/openbao-pulumi-admin-v1` plus Kubernetes auth role `openbao-pulumi-admin-v1`. The role MUST bind exactly that ServiceAccount, namespace, and audience `openbao-pulumi-admin-v1`. Successful login MUST issue a non-renewable batch token with a 30-minute TTL, 30-minute maximum TTL, policy `openbao-pulumi-admin`, and no automatic `default` policy.

Policy `openbao-pulumi-admin` is a general OpenBao administrator policy, not a least-privilege policy. It MUST permit broad management of mounts, auth methods and their configuration and roles, ACL policies, secrets engines, and secrets-engine configuration. Explicit deny rules MUST block raw storage, initialization, seal, standard rekey at exact path `sys/rekey` and all descendants, recovery-key rekey at exact path `sys/rekey-recovery-key` and all descendants, root-token generation, barrier-key rotation, every `sys/storage/raft/*` operation, and leader step-down. The role MUST NOT manage Raft membership, snapshots, bootstrap, restore, promote or demote operations, join operations, or Raft autopilot and configuration. The allowed non-Raft configuration surface lets this identity persist privilege, including by creating or changing auth methods, policies, and credentials. A short token lifetime limits one token's duration but does not make an untrusted pipeline safe.

The `openbao/pantheon` program MUST require a non-empty runtime `VAULT_TOKEN` whenever Kubernetes API management is enabled. One canonical-address Vault-compatible provider with `skipChildToken: true` MUST be shared by enabled OIDC, Transit, and Kubernetes API resources. The Tekton attachment gate MUST also default to disabled and require a non-empty runtime `VAULT_TOKEN` when enabled so its canonical-address provider cannot fall back to `~/.vault-token`. OpenBao MUST be reconciled before Tekton so the exported backend and policy contract exists before role attachment. Consumer repository PipelineRuns MAY later select the ServiceAccount, project its dedicated-audience token, and log in, but this rollout MUST NOT modify a consumer pipeline or create a static `openbao-pulumi-credentials` Secret.

#### Scenario: A trusted CI job authenticates

- Given the platform resources have been separately reviewed, applied, and bootstrapped
- And a trusted job runs as `pipelines-as-code/openbao-pulumi-admin-v1` with a projected token for audience `openbao-pulumi-admin-v1`
- When it logs in to role `openbao-pulumi-admin-v1` at `auth/kubernetes`
- Then OpenBao validates the token through TokenReview and returns only a non-renewable 30-minute batch token carrying `openbao-pulumi-admin`

#### Scenario: A different identity attempts login

- Given a token has a different ServiceAccount, namespace, or audience
- When it attempts the administrator role login
- Then OpenBao denies authentication

### Requirement: Least-Privilege Release Identities

The `openbao/pantheon` stack MUST own KV v2 mount `kv` without any secret payload resource. A current compatible `kv` mount requires a checkpoint-backed import before reconciliation. Operators MUST reject mount replacement, a version change, payload adoption, or an ambiguous live object.

The `tekton/pantheon` stack MUST consume `openbaoUrl`, `openbaoKubernetesAuthMountPath`, and `openbaoKvMountPath` through `openbao-administration-attachment-enabled`. It MUST reject disabled Kubernetes or KV API management and incomplete producer outputs.

Tekton MUST own ServiceAccounts `pipelines-as-code/kuri-tauri-build-v1` and `pipelines-as-code/kuri-forgejo-release-v1`. Both ServiceAccounts MUST set `automountServiceAccountToken: false`. Their roles and audiences MUST exactly match their ServiceAccount names. Each role MUST bind one exact ServiceAccount and namespace, attach one task policy, suppress `default`, and issue non-renewable batch tokens with 900-second TTL and maximum TTL.

Policy `kuri-tauri-build-v1` MUST grant only `read` on `kv/data/ci/kuri/android-signing` and `read` on `auth/token/lookup-self`. Policy `kuri-forgejo-release-v1` MUST grant only `read` on `kv/data/ci/kuri/forgejo-release`, `read` on `kv/data/ci/esp-wifi-cam/firmware-signing`, and `read` on `auth/token/lookup-self`. Self lookup supports sanitized login validation. Batch tokens cannot renew, and the policies MUST NOT grant self revocation.

The build identity MUST NOT read the Forgejo token or ESP firmware signing key. The publication identity MUST NOT read Android signing material. Neither identity MUST list KV metadata or access other adjacent paths. The current broad administrator identity and `pipelines-as-code/android-keystore` compatibility Secret MUST remain unchanged.

#### Scenario: The identities remain isolated

- Given both Kuri roles authenticate successfully
- When each token checks its allowed path and the other task's path
- Then each allowed path reports only `read` and each cross-task path reports `deny`

#### Scenario: A mount already exists

- Given live inventory finds a compatible KV v2 mount at `kv`
- When an operator prepares the first OpenBao reconciliation
- Then the operator imports that exact mount into `openbao/pantheon` under separate state-mutation authorization

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

This rollout MUST NOT add OpenBao backup or DR resources, auto-unseal, operator-managed PKI, workload identities beyond the approved CI administrator and Kuri roles, public internet exposure, External Secrets Operator, CSI-mounted secrets, or injector sidecars. The Gateway backend and OpenBao API listener MAY remain HTTP, but that limitation MUST remain explicit until end-to-end API TLS is implemented. OpenBao's built-in mutually authenticated TLS cluster channel MUST remain enabled for server-to-server Raft traffic.

#### Scenario: A deferred capability is proposed

- Given an operator proposes backup, restoration, DR, auto-unseal, operator-managed end-to-end API TLS, or workload migration
- When the proposal changes the approved risk or delivery model
- Then it requires a separately approved change before implementation

## References

- [`src/components/openbao.ts`](../../../src/components/openbao.ts)
- [`programs/openbao/index.ts`](../../../programs/openbao/index.ts)
- [`programs/tekton/index.ts`](../../../programs/tekton/index.ts)
- [`programs/openbao/Pulumi.pantheon.yaml`](../../../programs/openbao/Pulumi.pantheon.yaml)
- [`src/components/authentik-oidc-app.ts`](../../../src/components/authentik-oidc-app.ts)
- [Tracked implementation](../implementation.md)
- [Verification state](../verification.md)

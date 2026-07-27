# OpenBao

## Purpose

This specification governs the approved first OpenBao adoption boundary for operator and workload secrets on Romulus.

## Requirements

### Requirement: Romulus Standalone Deployment

OpenBao MUST target Romulus, use persistent storage, and be exposed only through internal homelab access paths. The first rollout MUST remain single-node and MUST NOT require HA or Raft.

#### Scenario: The OpenBao stack is rendered

- Given the Romulus stack configuration is selected
- When OpenBao resources are constructed
- Then one standalone server uses persistent storage and internal Service and Gateway API paths

### Requirement: Manual Initialization And Unseal

The first rollout MUST use manual initialization and manual unseal. It MUST NOT depend on a second OpenBao deployment or an external KMS for auto-unseal.

#### Scenario: New storage is initialized

- Given an authorized operator confirms OpenBao is not initialized
- When the operator follows the [guarded runbook](../../operations/openbao.md)
- Then recovery material is generated once and transferred directly to approved secure storage

#### Scenario: A server restarts sealed

- Given initialized OpenBao storage returns in a sealed state
- When service restoration is authorized
- Then operators supply the required unseal shares interactively before using the service

### Requirement: Authentik Operator Authentication

Authentik OIDC MUST be the primary human login path after OpenBao is initialized and unsealed. Local users and the initial root token MUST NOT be the routine operator path.

#### Scenario: An operator signs in

- Given the Authentik application, OpenBao auth method, role, redirect URIs, and policy are configured
- When an operator starts UI or CLI login
- Then OpenBao delegates authentication to Authentik OIDC

### Requirement: Approved Secret Engines

The first rollout MUST provide KV v2 for approved operator and workload values and Transit for Pulumi secrets-provider encryption. Mounts outside that boundary require a separately approved change.

#### Scenario: A Pulumi Transit key is prepared

- Given Transit is enabled at the configured mount
- When the approved key is created
- Then Pulumi can address it through a compatible `hashivault://` provider path

### Requirement: Initial Scope Boundary

The first rollout MUST NOT add PKI, dynamic credentials, public internet exposure, HA, auto-unseal, External Secrets Operator, CSI-mounted secrets, or injector sidecars.

#### Scenario: An additional capability is proposed

- Given an operator proposes a capability outside KV, Transit, OIDC, and manual bootstrap
- When the proposal changes the approved risk or delivery model
- Then it requires a new specification and approval before implementation

## References

- [`src/components/openbao.ts`](../../../src/components/openbao.ts)
- [`programs/openbao/index.ts`](../../../programs/openbao/index.ts)
- [`programs/openbao/Pulumi.romulus.yaml`](../../../programs/openbao/Pulumi.romulus.yaml)
- [`programs/authentik/index.ts`](../../../programs/authentik/index.ts)
- [Unresolved live state](../verification.md)

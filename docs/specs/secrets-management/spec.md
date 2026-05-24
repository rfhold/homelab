# Secrets Management Capability Spec

Stable spec at `docs/specs/secrets-management/spec.md`. Source of truth. Edited only by the `code-review` skill during delta merge.

## Purpose

Defines how the homelab stores, protects, and delivers operator and workload secrets across clusters and automation systems.

## Requirements

### Requirement: Romulus OpenBao Deployment
The system MUST support an internal-only OpenBao deployment on `romulus` as the homelab secrets-management service for operator and workload secrets.

#### Scenario: Internal OpenBao service is configured for romulus
Given the homelab deploys OpenBao for the first time
When the OpenBao service is defined for production use
Then the system MUST target the `romulus` cluster
And the system MUST expose OpenBao only through internal homelab access paths
And the system MUST provision persistent storage for OpenBao data

#### Scenario: First rollout stays single-node
Given the initial OpenBao rollout is being planned
When the deployment topology is defined
Then the system MUST use a single-node OpenBao deployment for v1
And the system MUST NOT require high-availability clustering for initial adoption

### Requirement: OpenBao Operator Authentication
The system MUST authenticate human OpenBao operators through Authentik OIDC.

#### Scenario: Operator signs in to OpenBao
Given OpenBao is deployed on `romulus`
And Authentik is available as the homelab identity provider
When an operator authenticates to the OpenBao UI or CLI
Then the system MUST use Authentik OIDC for the operator login flow

#### Scenario: Local operator users are not the primary v1 path
Given the v1 authentication model is configured
When operator access is granted
Then the system MUST treat Authentik OIDC as the primary human authentication path

### Requirement: OpenBao Secret Engines For V1
The system MUST provide OpenBao KV storage for application and operator secrets and OpenBao Transit for Pulumi secrets-provider integration.

#### Scenario: Workload or operator secret is stored in OpenBao
Given a secret is intended for an internal application or operator workflow
When the secret is written to OpenBao in v1
Then the system MUST store that secret in an OpenBao KV engine

#### Scenario: Pulumi stack uses OpenBao-backed encryption
Given a Pulumi stack is migrated away from passphrase-based secret encryption
When the stack is configured to use OpenBao as its secrets provider
Then the system MUST use an OpenBao Transit path compatible with Pulumi's `hashivault://` secrets provider

### Requirement: OpenBao Bootstrap And Unseal
The system MUST support manual initialization and manual unseal for the v1 OpenBao deployment.

#### Scenario: New OpenBao cluster is bootstrapped
Given OpenBao has been deployed for the first time on `romulus`
When operators initialize the cluster
Then the system MUST support a documented initialization workflow that produces the required recovery or unseal material for operators

#### Scenario: OpenBao restarts in v1
Given the v1 OpenBao deployment has restarted or lost its active process
When OpenBao returns in a sealed state
Then the system MUST require manual operator unseal to restore service
And the system MUST NOT depend on self-hosted or external auto-unseal in v1

### Requirement: Pulumi Secret Delivery Boundary
The system MUST keep Pulumi as the v1 mechanism that renders Kubernetes `Secret` resources for workloads even when OpenBao becomes the source of truth for secret values.

#### Scenario: Workload needs a Kubernetes Secret
Given a workload still consumes configuration through a Kubernetes `Secret`
When that workload is managed in the v1 OpenBao adoption period
Then the system MUST allow Pulumi to read or receive the required secret value from the approved OpenBao workflow
And the system MUST allow Pulumi to materialize the Kubernetes `Secret` for that workload

#### Scenario: Direct pod-side secret injection is proposed in v1
Given an operator evaluates workload secret consumption patterns for the initial rollout
When the proposed approach uses External Secrets Operator, CSI, or agent sidecars
Then the system MUST treat that approach as out of scope for v1

### Requirement: OpenBao Adoption Scope Boundaries
The system MUST limit the initial OpenBao rollout to internal secret management concerns that were explicitly approved during planning.

#### Scenario: Additional OpenBao capabilities are considered
Given the v1 OpenBao rollout is being scoped
When an operator proposes PKI, dynamic credentials, or public internet exposure
Then the system MUST treat those capabilities as separate future changes

#### Scenario: Self-hosted auto-unseal is reconsidered
Given an operator requests auto-unseal after the v1 scope is approved
When that request would add a second OpenBao deployment or an external KMS dependency
Then the system MUST require a new spec change before altering the approved v1 design

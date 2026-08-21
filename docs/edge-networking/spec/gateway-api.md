# Gateway API

## Purpose

This specification governs the general Gateway API implementation and its ownership boundary from the model-specific Agent Gateway program.

## Requirements

### Requirement: kgateway Release

The ingress implementation MUST use kgateway CRD and controller charts at `v2.3.1` and MUST install a Gateway API CRD release compatible with that controller.

#### Scenario: The ingress stack renders kgateway

- Given Gateway API is enabled for a cluster
- When Helm and CRD resources are selected
- Then both kgateway charts use `v2.3.1` and the configured Gateway API CRDs are installed before them

### Requirement: Agent Gateway Decoupling

The ingress module MUST NOT enable Agent Gateway integration or create Agent Gateway CRDs and controllers. The dedicated Agent Gateway program MUST own model-gateway resources.

#### Scenario: General ingress is reconciled

- Given the ingress stack deploys kgateway
- When its chart values and child resources are rendered
- Then no Agent Gateway controller or model backend is created by that stack

### Requirement: Pantheon Gateway API Prerequisite

Pantheon ingress/kgateway MUST own the shared experimental Gateway API CRDs at `v1.6.0`. It MUST reconcile those CRDs before Agent Gateway. The Agent Gateway program MUST NOT install another Gateway API CRD release. This Pantheon-specific requirement MUST NOT change the Romulus compatibility contract.

#### Scenario: Pantheon reconciles Agent Gateway prerequisites

- Given Pantheon ingress and Agent Gateway stacks are selected
- When their dependencies are reconciled
- Then ingress/kgateway installs experimental Gateway API CRDs at `v1.6.0`
- And those CRDs reconcile before Agent Gateway resources
- And Agent Gateway does not install a separate Gateway API CRD release

### Requirement: Default Cluster Gateways

Romulus and Pantheon MUST each support a `default-gateway` in namespace `ingress` with TLS listeners for their configured hostname sets and the managed default certificate. Routes MAY attach across namespaces where the listener allows them.

#### Scenario: A route targets a cluster default gateway

- Given its hostname matches a configured listener
- When the HTTPRoute references `ingress/default-gateway`
- Then the route can attach through the matching listener and use the default TLS Secret

## References

- [`src/components/kgateway.ts`](../../../src/components/kgateway.ts)
- [`src/modules/ingress.ts`](../../../src/modules/ingress.ts)
- [`programs/ingress/Pulumi.romulus.yaml`](../../../programs/ingress/Pulumi.romulus.yaml)
- [`programs/ingress/Pulumi.pantheon.yaml`](../../../programs/ingress/Pulumi.pantheon.yaml)

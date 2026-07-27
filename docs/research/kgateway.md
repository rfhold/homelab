# kgateway Adoption Research Evidence

This is a non-authoritative research record. It does not define the repository's gateway versions, APIs, routes, migration status, or live behavior.

## Provenance

- The evaluation used kgateway chart `v2.1.0` and Gateway API `v1.4.0`; no research or retrieval date was recorded.
- The source did not include a final reference list or pin upstream documents. Its extensive manifests and proposed TypeScript were exploratory.

## Evidence Retained

- kgateway was evaluated as an Envoy-based Gateway API implementation with traffic management, extension policies, observability, and AI gateway capabilities.
- The proposed decision was phased coexistence with the prior ingress path, beginning with non-critical or AI workloads before migration.
- cert-manager, ExternalDNS, MetalLB, cross-namespace route attachment, and a separate control/data plane were identified as integration boundaries.

## Repository Relevance

This evaluation captures why kgateway and Gateway API were considered and the risks of a staged migration. Proposed source code and third-party CRDs were removed because they were never repository implementation evidence.

## Disposition

The approved current contract is [Gateway API specifications](../edge-networking/spec/gateway-api.md), with tracked behavior in [edge implementation](../edge-networking/implementation.md) and unresolved state in [edge verification](../edge-networking/verification.md).

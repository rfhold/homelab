# DNS

## Purpose

This specification governs authoritative DNS ownership, Technitium catalog replication, and ExternalDNS update authorization. It does not assert live server or zone health.

## Requirements

### Requirement: Primary And Secondary Topology

Romulus MUST define the primary Technitium node at `172.16.4.8`, and Pantheon MUST define the secondary at `172.16.3.8`. The primary MUST own `holdenitdown.net`, `rholden.dev`, and `rholden.me`; the secondary MUST obtain managed member zones through cluster catalog replication.

#### Scenario: DNS stacks are configured

- Given the Romulus and Pantheon DNS stack files are rendered
- When node and zone settings are inspected
- Then they declare distinct primary and secondary identities and share cluster domain `dns.holdenitdown.net`

### Requirement: Catalog Transfer Authorization

The primary catalog zone `cluster-catalog.dns.holdenitdown.net` MUST allow zone transfer only with its configured catalog TSIG key. Recovery MUST NOT replace this with a source-IP-only ACL because Kubernetes egress can differ from the secondary LoadBalancer identity.

#### Scenario: A secondary requests catalog transfer

- Given the request carries the configured catalog TSIG identity
- When the primary evaluates transfer authorization
- Then the catalog transfer is allowed without requiring the request source to equal `172.16.3.8`

### Requirement: RFC 2136 Updates

ExternalDNS MUST update the managed zones on the Romulus primary through RFC 2136 using the generated `external-dns` HMAC-SHA256 TSIG Secret. The credential MUST remain in secret-bearing Pulumi and Kubernetes values and MUST NOT be placed in documentation or non-secret outputs.

#### Scenario: An HTTPRoute exposes a hostname

- Given ExternalDNS watches Gateway API HTTPRoutes
- When an eligible hostname in a managed zone is observed
- Then ExternalDNS can submit a TSIG-authenticated update to the primary and maintain its ownership TXT record

### Requirement: Recovery Preserves Source Ownership

Operational recovery MAY restore catalog transfer options, rejoin the secondary, and resync its catalog, but it MUST preserve the Pulumi-owned topology and MUST NOT delete the primary cluster.

#### Scenario: Secondary state is corrupt

- Given read-only diagnosis isolates failure to the Pantheon secondary
- When an authorized operator performs recovery
- Then the operator follows the [secondary recovery runbook](../operations/technitium-secondary-recovery.md) and verifies authoritative answers on both servers

## References

- [`programs/dns/index.ts`](../../../programs/dns/index.ts)
- [`src/modules/dns.ts`](../../../src/modules/dns.ts)
- [`src/providers/technitium/cluster-secondary.ts`](../../../src/providers/technitium/cluster-secondary.ts)
- [`src/providers/technitium/catalog-zone-options.ts`](../../../src/providers/technitium/catalog-zone-options.ts)
- [`src/components/external-dns.ts`](../../../src/components/external-dns.ts)

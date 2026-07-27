# Technitium DNS Historical Evidence

This is a non-authoritative research and incident record. It does not prove current DNS topology, synchronization, zone contents, deployment, or health.

## Provenance

- The external research covered Technitium DNS Server `v13+` catalog zones; no exact server version, research date, or retrieval date was recorded.
- Consulted sources: [Technitium DNS Server](https://github.com/TechnitiumSoftware/DnsServer), [2024 catalog-zone article](https://blog.technitium.com/2024/10/how-to-configure-catalog-zones-for.html), [API documentation](https://github.com/TechnitiumSoftware/DnsServer/blob/master/APIDOCS.md), and [container environment variables](https://github.com/TechnitiumSoftware/DnsServer/blob/master/DockerEnvironmentVariables.md).

## Evidence Retained

- The homelab used a primary and secondary catalog-zone design with TSIG-authenticated transfers.
- A narrowed source-IP transfer ACL caused historical secondary catalog synchronization failure because requests could originate from a hosting node address rather than the LoadBalancer address.
- The recorded recovery rationale was to preserve the Pulumi-aligned `Allow` transfer mode with the catalog TSIG key, then verify catalog type, serial, `syncFailed`, and `isExpired` before resynchronization.

## Repository Relevance

This is genuine decision and failure evidence for why source-IP-only catalog transfer ACLs are unsafe in this topology. Old addresses, copied tokens-in-URLs scripts, generic deployment examples, and stale zone claims were removed.

## Disposition

Current topology and policy are authoritative in [DNS specifications](../edge-networking/spec/dns.md). Guarded diagnosis and recovery moved to [Technitium secondary recovery](../edge-networking/operations/technitium-secondary-recovery.md). Unverified replication state remains in [edge verification](../edge-networking/verification.md).

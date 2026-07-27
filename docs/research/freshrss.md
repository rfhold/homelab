# FreshRSS Research Evidence

This is a non-authoritative research record. It does not establish an approved FreshRSS image, database, identity integration, deployment, feed data, or live service.

## Provenance

- The source referenced FreshRSS `1.27.0` only as an example version tag and recorded PHP and database compatibility ranges; no research or retrieval date was recorded.
- Consulted sources: [FreshRSS](https://freshrss.org), [repository](https://github.com/FreshRSS/FreshRSS), [documentation](https://freshrss.github.io/FreshRSS/), [container image](https://hub.docker.com/r/freshrss/freshrss), and [extensions](https://github.com/FreshRSS/Extensions).

## Evidence Retained

- FreshRSS was evaluated as a lightweight RSS and Atom service with SQLite or external PostgreSQL or MySQL, scheduled refresh, mobile APIs, WebSub, and optional OIDC.
- Persistent application data, database backups, extension compatibility, reverse-proxy trust, registration controls, API passwords, and image pinning were identified as concerns.
- No database choice, image variant, or authentication path was recorded as an approved homelab decision.

## Repository Relevance

This is workload-evaluation evidence only. Generic container stacks, default passwords, and operational commands were removed.

## Disposition

No canonical FreshRSS contract exists. Any future deployment must be documented under [Kubernetes workloads](../kubernetes-workloads/README.md) and use the current [secrets-management](../secrets-management/README.md) boundaries.

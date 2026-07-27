# TRMNL Self-Hosting Research Evidence

This is a non-authoritative research record. It does not establish a BYOS server, device registration, application key, database, cloud proxy, deployment, or live display.

## Provenance

- The source referenced BYOS Laravel, PHP `8.2+`, and device firmware `1.4.6+`; no BYOS release, research date, or retrieval date was recorded.
- Consulted sources: [BYOS Laravel](https://github.com/usetrmnl/byos_laravel), [BYOS documentation](https://docs.usetrmnl.com/go/diy/byos), [community recipes](https://bnussbau.github.io/trmnl-recipe-catalog/), [official recipes](https://usetrmnl.com/recipes), [design framework](https://usetrmnl.com/framework), and [private API documentation](https://docs.usetrmnl.com/go/private-api/introduction).

## Evidence Retained

- BYOS Laravel was evaluated for self-hosted TRMNL device management, screen generation, auto-join, recipes, and an optional cloud proxy.
- SQLite persistence, generated image storage, queue processing, application-key custody, registration shutdown, HTTPS, device firmware support, and database backup were identified as concerns.
- Cloud proxy functionality was recorded as dependent on TRMNL Developer Edition.

## Repository Relevance

This is IoT workload evaluation only; it records no approved device or deployment. Generic Compose, package installation, API authorization, and update commands were removed.

## Disposition

No canonical TRMNL contract exists. Any future service belongs in [Kubernetes workloads](../kubernetes-workloads/README.md), with secrets governed by [secrets management](../secrets-management/README.md).

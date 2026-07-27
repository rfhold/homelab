# MKTXP Monitoring Research Evidence

This is a non-authoritative research record. It does not establish that MKTXP, RouterOS API access, a dashboard, or any MikroTik scrape target is configured or live.

## Provenance

- No MKTXP or RouterOS version, research date, or retrieval date was recorded.
- Consulted sources: [MKTXP repository](https://github.com/akpw/mktxp), [container package](https://github.com/akpw/mktxp/pkgs/container/mktxp), [MKTXP stack](https://github.com/akpw/mktxp-stack), [Grafana dashboard 13679](https://grafana.com/grafana/dashboards/13679), and [RouterOS API documentation](https://wiki.mikrotik.com/wiki/Manual:API).

## Evidence Retained

- MKTXP was evaluated as a multi-router Prometheus exporter using the RouterOS API and exposing metrics on a configurable HTTP endpoint.
- A dedicated least-privilege API user, encrypted transport, constrained network access, scrape timeouts, collector selection, and secret storage were identified as design concerns.
- The source proposed Luna placement and many specific collectors, but recorded no implementation or approval evidence for either.

## Repository Relevance

The topic is relevant to infrastructure observability. The speculative Kubernetes manifests, credentials, dashboard import, and complete container stack were removed.

## Disposition

No canonical MKTXP deployment contract exists. Use [observability documentation](../observability/README.md) for implemented collectors and record any future adoption gap in [observability verification](../observability/verification.md).

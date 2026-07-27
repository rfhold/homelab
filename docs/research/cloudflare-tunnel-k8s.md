# Cloudflare Tunnel Kubernetes Research Evidence

This is a non-authoritative research record. It does not establish a tunnel management mode, credentials, routes, replicas, deployment, or live connectivity.

## Provenance

- No cloudflared or controller version, research date, or retrieval date was recorded.
- Consulted sources: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), [Kubernetes guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/deployment-guides/kubernetes/), [run parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/cloudflared-parameters/run-parameters/), [Access applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/), and the [STRRL ingress controller](https://github.com/STRRL/cloudflare-tunnel-ingress-controller).

## Evidence Retained

- The evaluation compared remotely managed token-based connectors, a per-node DaemonSet, an ingress controller, and locally managed configuration.
- Outbound-only connectivity, multiple connectors, readiness metrics, protocol fallback, fixed image tags, secret storage, and Access policies were identified as concerns.
- No approach was recorded as an approved homelab decision.

## Repository Relevance

This research supplied alternatives for exposing cluster services without inbound firewall rules. Generic token creation, manifests, and dashboard procedures were removed.

## Disposition

Current tunnel, DNS, and route behavior is described in [edge implementation](../edge-networking/implementation.md); unresolved live tunnel state belongs in [edge verification](../edge-networking/verification.md).

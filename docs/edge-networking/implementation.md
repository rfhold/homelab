# Tracked Edge Implementation

This document describes tracked repository source. It does not prove that an edge component, DNS record, certificate, route, CRD, or tunnel is live.

## Gateway API

The ingress program configures Traefik and kgateway side by side. [`src/helm-charts.ts`](../../src/helm-charts.ts) pins the kgateway CRD and controller charts to `v2.3.1`. [`src/components/kgateway.ts`](../../src/components/kgateway.ts) owns Gateway API CRD installation and the `kgateway` GatewayClass; it contains no Agent Gateway installation path.

Pantheon ingress configuration selects the experimental Gateway API CRDs at `v1.6.0`. The Agent Gateway Pantheon configuration disables its own Gateway API CRD installation. These settings assign the shared CRDs to ingress/kgateway. The [Gateway API specification](spec/gateway-api.md) defines reconciliation order. Romulus retains its separate default compatibility configuration.

Both cluster stack files request a `default-gateway` in namespace `ingress` with private LoadBalancer infrastructure. Romulus configures listeners for `*.holdenitdown.net` and `*.romulus.holdenitdown.net`. Pantheon additionally configures `*.pantheon.holdenitdown.net` and `*.rholden.dev` listeners. The default TLS Secret is populated by a cert-manager Certificate using Cloudflare DNS-01 issuers.

Agent Gateway has a separate Pantheon program and renders its own `agentgateway` Gateway, provider backends, and `agent-gateway.holdenitdown.net` routes. Its model route targets provider backends. For the administratively sensitive Admin UI, tracked source attaches a namespaced `AgentgatewayParameters` to the Gateway with `ADMIN_ADDR=0.0.0.0:15000`, binding the admin listener to pod interfaces for its dedicated ClusterIP Service. The Admin UI route sends exact `/`, exact `/config_dump`, and prefixes `/ui` and `/api` unchanged to that Service. Exact `/config_dump` supplies the UI with a read-only xDS route inventory. These source facts do not prove live listener or route reachability. The Gateway-level PreRouting model policy condition excludes those administrative paths, including exact `/config_dump`, from body-derived model extraction. Codex Proxy instead attaches its administrative route to Pantheon's `default-gateway`.

## DNS

[`programs/dns/Pulumi.romulus.yaml`](../../programs/dns/Pulumi.romulus.yaml) configures the primary Technitium server as `primary.dns.holdenitdown.net` at the DNS LoadBalancer address `172.16.4.8`. It declares primary zones for `holdenitdown.net`, `rholden.dev`, and `rholden.me` and initializes cluster domain `dns.holdenitdown.net`.

[`programs/dns/Pulumi.pantheon.yaml`](../../programs/dns/Pulumi.pantheon.yaml) configures `secondary.dns.holdenitdown.net` at `172.16.3.8` and references the Romulus DNS stack for cluster join credentials and the primary URL. [`src/providers/technitium/cluster-secondary.ts`](../../src/providers/technitium/cluster-secondary.ts) implements the full rejoin sequence used by the recovery runbook.

The DNS module creates an `external-dns` HMAC-SHA256 TSIG key, stores its generated value in a Kubernetes Secret, and applies TSIG update policies to the managed primary zones. Primary zones join `cluster-catalog.dns.holdenitdown.net`. [`TechnitiumCatalogZoneOptions`](../../src/providers/technitium/catalog-zone-options.ts) sets catalog transfer mode to `Allow` while requiring the catalog TSIG key; it does not rely on a source-IP-only transfer ACL.

The ingress stacks reference Romulus DNS outputs and configure ExternalDNS's RFC 2136 provider to update the three managed zones at `172.16.4.8`. [`src/components/external-dns.ts`](../../src/components/external-dns.ts) watches Gateway API routes, Ingresses, and Services and reads the TSIG value from a Secret.

## Certificates And Aliases

Both ingress stacks define Let's Encrypt production and staging ClusterIssuers using Cloudflare DNS-01. The Pantheon default certificate includes `*.rholden.dev`, allowing local alias routes to use the existing gateway certificate.

Tracked local and public route configuration currently separates these concerns:

| Alias | Local route source | Public tunnel source |
| --- | --- | --- |
| `overseerr.rholden.dev` | The media stack attaches it to the route whose primary hostname is `seerr.holdenitdown.net`, alongside `overseerr.holdenitdown.net` | The Romulus tunnel retains `overseerr.rholden.dev` and its existing origin |
| `home.rholden.dev` | The Pantheon reverse-proxy route attaches it alongside `home.holdenitdown.net` | The Romulus tunnel retains `home.rholden.dev` and its existing origin |

The current media source is intentionally described as the Seerr route rather than the older lifecycle term "Overseerr route." Both route components combine one primary hostname with explicitly configured aliases on a single HTTPRoute.

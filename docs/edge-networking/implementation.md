# Tracked Edge Implementation

This document describes tracked repository source. It does not prove that an edge component, DNS record, certificate, route, CRD, or tunnel is live.

## Gateway API

The ingress program configures Traefik and kgateway side by side. [`src/helm-charts.ts`](../../src/helm-charts.ts) pins the kgateway CRD and controller charts to `v2.3.1`. [`src/components/kgateway.ts`](../../src/components/kgateway.ts) owns Gateway API CRD installation and the `kgateway` GatewayClass; it contains no Agent Gateway installation path.

Pantheon ingress configuration selects the experimental Gateway API CRDs at `v1.6.0`. Agent Gateway does not install Gateway API CRDs. These settings assign the shared CRDs to ingress/kgateway. The [Gateway API specification](spec/gateway-api.md) defines reconciliation order. Romulus retains its separate default compatibility configuration.

Both cluster stack files request a `default-gateway` in namespace `ingress` with private LoadBalancer infrastructure. Romulus configures listeners for `*.holdenitdown.net` and `*.romulus.holdenitdown.net`. Pantheon additionally configures `*.pantheon.holdenitdown.net` and `*.rholden.dev` listeners. The default TLS Secret is populated by a cert-manager Certificate using Cloudflare DNS-01 issuers.

Tracked Agent Gateway desired source creates only standalone v1.7.0 and its production HTTPRoute. HTTPRoute `agentgateway-system/agent-gateway` serves `agent-gateway.holdenitdown.net` through `ingress/default-gateway` and targets Service `agentgateway-system/agent-gateway` on port `4000`. The program creates no Agent Gateway GatewayClass, Gateway, controller, CRDs, Backends, or policies.

The internal standalone listener accepts the Host value from the HTTPRoute. Generated bootstrap configuration exposes the normal UI and configuration API through the Service, binds debug administration to loopback, and creates no `/config_dump` route. The private LoadBalancer Gateway forms the network access boundary. The fronting HTTPRoute sets a `600s` request timeout so kgateway does not truncate long streaming responses. Raw `/api/config` remains the read-only file-backed view, while persistent UI and Pulumi resource changes use `/api/config/resources/*`. Pantheon tracked source selects route storage `database` and representation `first-class`: eleven providers, twenty-one concrete models, two virtual models, and one legacy Bifrost route. Embedding phase 2 and local-small phase 1 remain selected. The first-class bootstrap attaches the fixed LLM route surface to gateway `default`, disables model discovery, and owns the internal `600s` timeout. Bifrost retains native legacy `openAI`, exact `/openai/v1/chat/completions`, and `bifrost/` prefix removal. First-class `/v1/models` returns the configured inventory with literal wildcard entries instead of upstream discovery. Host-derived first-class `baseUrl` values include `/v1`; custom provider formats follow the [model gateway contract](../kubernetes-workloads/spec/model-gateway.md#requirement-first-class-routing-representation). Source scopes retries to `local-embedding` on `POST /v1/embeddings`, with `attempts: 1` for at most two total attempts. These source facts do not establish a v1.7 rollout or live upstream capabilities. The [upgrade and recovery runbook](../kubernetes-workloads/operations/agent-gateway-upgrade.md) defines the separate rollout prerequisites. Claude Proxy and Codex Proxy also attach their administrative routes to Pantheon's internal `default-gateway`.

Homelab does not render audio HTTPRoutes. The tracked edge contract assigns ordinary Service-backed routes on the shared Agent Gateway hostname to `rfhold/whisperx-server` and `rfhold/kokoro-server`. Those routes attach to `ingress/default-gateway`. The contract preserves their direct `whisperx.holdenitdown.net` and `kokoro.holdenitdown.net` hostnames. It uses Service EndpointSlices as the future-balanced backend pool and retains private-network access without gateway client authentication. Workload-repository and live route state remain unverified.

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

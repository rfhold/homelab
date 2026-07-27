# Edge Networking

Specifications define intended routing, DNS, and certificate contracts. Tracked source implementation and unresolved live verification are documented separately.

| Document | Covers |
| --- | --- |
| [`implementation.md`](implementation.md) | Source-backed gateway, DNS, certificate, ExternalDNS, and tunnel configuration |
| [`verification.md`](verification.md) | Unverified route, certificate, DNS replication, and public-tunnel state |
| [`spec/gateway-api.md`](spec/gateway-api.md) | kgateway ownership, versions, CRDs, and default Gateways |
| [`spec/dns.md`](spec/dns.md) | Technitium topology, catalog replication, RFC 2136, and TSIG boundaries |
| [`spec/routes.md`](spec/routes.md) | Agent Gateway, Codex Proxy, multi-hostname routes, aliases, and certificates |
| [`operations/technitium-secondary-recovery.md`](operations/technitium-secondary-recovery.md) | Guarded diagnosis and recovery for the Pantheon DNS secondary |

# Edge Verification

No live DNS, Kubernetes, certificate, network, or Cloudflare query was performed during this conversion.

| Topic | Tracked evidence | Unresolved verification |
| --- | --- | --- |
| kgateway and default Gateways | Chart versions, GatewayClass, listeners, and certificates are declared in source | Confirm installed CRD and controller versions, accepted Gateway conditions, listener status, and LoadBalancer addresses in each cluster. |
| Agent Gateway and Codex routes | Both HTTPRoutes and their backend references are represented in source | Confirm route acceptance, TLS termination, backend health, and the absence of a LiteLLM compatibility hostname. |
| Technitium clustering | Source declares Romulus primary, Pantheon secondary, catalog membership, and TSIG-authorized transfer options | Confirm both nodes report the expected cluster relationship, the secondary catalog is current, SOA serials converge, and both servers answer authoritatively. |
| ExternalDNS | Ingress source points RFC 2136 updates at the primary and watches Gateway API routes | Confirm expected A/TXT records exist, ownership records are not conflicting, and updates are accepted with the configured TSIG key. |
| Certificates | cert-manager resources request wildcard coverage including `*.rholden.dev` | Confirm issued certificate readiness, Secret freshness, and the certificate served for each local alias. |
| Tunnel parity | Source retains the two Romulus Cloudflare Tunnel routes while Pantheon adds local aliases | Confirm public DNS and tunnel origins were not changed outside tracked source, and verify local and public resolution from their intended client networks. |

Use [Technitium secondary recovery](operations/technitium-secondary-recovery.md) only after read-only checks identify the secondary or catalog as the failing boundary.

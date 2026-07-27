# Edge Routes

## Purpose

This specification governs client-facing AI routes, administrative proxy routes, parent-owned reverse-proxy routes, pinned media-server integration outcomes, local tunnel aliases, and their certificate boundary. The media-server submodule owns its route implementation; this parent repository owns only the pinned revision and expected integration outcome.

## Requirements

### Requirement: Agent Gateway Endpoint

Agent Gateway MUST expose `agent-gateway.holdenitdown.net` through its Gateway API route and `agentgateway.dev` backend references. It MUST NOT expose `litellm.holdenitdown.net` as a compatibility hostname.

#### Scenario: A model client connects

- Given the client uses the Agent Gateway hostname
- When its request reaches the route
- Then the request is evaluated by Agent Gateway model routing rather than a LiteLLM endpoint

### Requirement: Client And Provider Authentication Boundary

The initial Agent Gateway endpoint MUST NOT require a LiteLLM master key or Agent Gateway client API key. Credentials for upstream providers MUST remain in Kubernetes Secrets and MUST be used only for the corresponding upstream authentication.

#### Scenario: An unauthenticated client reaches a configured provider

- Given no client-key policy is configured
- When Agent Gateway forwards the request to a credentialed upstream
- Then client admission does not require a gateway key and the upstream credential comes from its provider Secret

### Requirement: Codex Administrative Route

Codex Proxy MAY expose `codex-proxy.holdenitdown.net` on the internal default gateway for administration, while Codex-backed model clients MUST continue to use Agent Gateway and the `codex/` model prefix.

#### Scenario: A Codex model is requested

- Given a model client uses `agent-gateway.holdenitdown.net`
- When the requested model starts with `codex/`
- Then Agent Gateway forwards to the internal Codex Proxy Service rather than redirecting the client to its administrative hostname

### Requirement: Parent-Owned Multi-Hostname Reverse Proxies

Parent-owned reverse-proxy route configuration MUST support one primary hostname plus explicit aliases on the same HTTPRoute and backend. Reverse proxies without configured aliases MUST retain their existing hostname set.

#### Scenario: A local alias is configured

- Given a parent-owned reverse proxy declares a primary hostname and one or more aliases
- When the HTTPRoute is rendered
- Then all declared hostnames use the same backend rules

### Requirement: Pinned Media-Server Route Integration

The parent repository MUST pin `programs/media-server` at revision `d555b207d774be6565c24074a05d93301f7c9976`. At that integration revision, the Pantheon media route is expected to expose `seerr.holdenitdown.net`, `overseerr.holdenitdown.net`, and `overseerr.rholden.dev` through the same route and backend. Changes to how the submodule constructs that route require authority in the media-server repository.

#### Scenario: The pinned media-server revision is integrated

- Given the parent repository initializes its pinned media-server submodule
- When the Pantheon media route output is evaluated
- Then the Seerr and Overseerr hostnames share the configured media backend
- And the parent repository does not redefine the submodule's route implementation

### Requirement: Local Tunnel Aliases

Parent-owned local route aliases MUST be limited to services intentionally represented in Cloudflare Tunnel configuration. The parent-owned contract covers `home.rholden.dev` on the Pantheon Home Assistant reverse proxy; the pinned media-server integration expectation separately covers `overseerr.rholden.dev`.

#### Scenario: ExternalDNS observes a local alias

- Given an approved parent-owned alias or pinned media integration alias is present on an HTTPRoute
- When ExternalDNS processes the route
- Then it can publish local Technitium records for that alias

### Requirement: Alias Certificate And Public-Tunnel Preservation

Pantheon local aliases under `rholden.dev` MUST attach to a gateway listener covered by the managed `*.rholden.dev` certificate. Adding or retaining local aliases MUST NOT alter the Romulus Cloudflare Tunnel hostnames, origins, or Cloudflare-managed public DNS behavior.

#### Scenario: A local client uses an approved alias

- Given the alias resolves to the local Pantheon edge
- When TLS terminates at the default gateway
- Then wildcard certificate coverage is used without a service-specific certificate

## References

- [`src/components/agent-gateway.ts`](../../../src/components/agent-gateway.ts)
- [`programs/codex-proxy/Pulumi.pantheon.yaml`](../../../programs/codex-proxy/Pulumi.pantheon.yaml)
- [`programs/media-server/service.ts`](../../../programs/media-server/service.ts) (pinned submodule evidence)
- [`programs/media-server/Pulumi.prod.yaml`](../../../programs/media-server/Pulumi.prod.yaml) (pinned submodule evidence)
- [`src/components/gateway-reverse-proxy.ts`](../../../src/components/gateway-reverse-proxy.ts)
- [`programs/reverse-proxy/Pulumi.home-assistant.yaml`](../../../programs/reverse-proxy/Pulumi.home-assistant.yaml)
- [`programs/ingress/Pulumi.romulus.yaml`](../../../programs/ingress/Pulumi.romulus.yaml)
- [`programs/ingress/Pulumi.pantheon.yaml`](../../../programs/ingress/Pulumi.pantheon.yaml)

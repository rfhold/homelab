## Change Overview

Why: Cloudflare Tunnel hostnames under `rholden.dev` are reachable publicly through Cloudflare, but local clients also need those same names to resolve through Technitium and terminate with managed local certificate coverage.

Impact: Adds local Gateway API and ExternalDNS behavior for Cloudflare Tunnel aliases. Known contract surfaces include route hostname configuration in `programs/media-server/service.ts`, `src/components/gateway-reverse-proxy.ts`, `programs/media-server/Pulumi.prod.yaml`, and `programs/reverse-proxy/Pulumi.home-assistant.yaml`.

Non-goals: This change does not change Cloudflare Tunnel public routing, Cloudflare DNS records, the tunnel origin services, or unrelated service hostnames.

Rollback: Remove the added `rholden.dev` hostnames from the service and proxy route configuration; ExternalDNS will remove the matching Technitium records and public Cloudflare Tunnel routing remains unchanged.

## ADDED Requirements

### Requirement: Local Tunnel Alias Resolution
The system MUST publish local DNS records in Technitium for Cloudflare Tunnel `rholden.dev` service aliases by exposing those aliases through Gateway API resources watched by ExternalDNS.

#### Scenario: Overseerr alias is published locally
Given the Cloudflare Tunnel exposes `overseerr.rholden.dev`
When the media server routing resources are rendered
Then the system MUST expose `overseerr.rholden.dev` on the existing Overseerr HTTPRoute
And ExternalDNS MUST be able to publish `overseerr.rholden.dev` to Technitium from that HTTPRoute

#### Scenario: Home Assistant alias is published locally
Given the Cloudflare Tunnel exposes `home.rholden.dev`
When the Home Assistant reverse proxy routing resources are rendered
Then the system MUST expose `home.rholden.dev` on the existing Home Assistant HTTPRoute
And ExternalDNS MUST be able to publish `home.rholden.dev` to Technitium from that HTTPRoute

### Requirement: Local Tunnel Alias Certificate Coverage
The system MUST serve local Cloudflare Tunnel `rholden.dev` aliases through Gateway API routes that are covered by the managed `*.rholden.dev` certificate.

#### Scenario: Local aliases use managed wildcard coverage
Given a local client requests a Cloudflare Tunnel service alias under `rholden.dev`
When the request reaches the local Gateway API edge
Then the system MUST use certificate coverage that includes `*.rholden.dev`
And the system MUST NOT require a service-specific certificate for that alias

### Requirement: Public Tunnel Behavior Preservation
The system MUST preserve existing public Cloudflare Tunnel behavior while adding local access for the same service aliases.

#### Scenario: Tunnel route remains unchanged
Given a Cloudflare Tunnel route exists for a service alias under `rholden.dev`
When local Gateway API and Technitium coverage is added for that alias
Then the system MUST keep the Cloudflare Tunnel hostname and origin configuration unchanged
And the system MUST keep Cloudflare-managed public DNS behavior unchanged

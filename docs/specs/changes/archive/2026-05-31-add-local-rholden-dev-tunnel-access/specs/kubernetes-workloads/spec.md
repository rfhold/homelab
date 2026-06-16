## Change Overview

See `../edge-networking/spec.md` for Why, Impact, Non-goals, and Rollback.

## ADDED Requirements

### Requirement: Multi-Hostname HTTPRoute Configuration
The system MUST allow workload and reverse-proxy HTTPRoute configuration to attach more than one hostname to the same route when a service has both primary and alias hostnames.

#### Scenario: Service route has primary and alias hostnames
Given a workload service has a primary `holdenitdown.net` hostname and a local `rholden.dev` alias
When its HTTPRoute is rendered
Then the system MUST include both hostnames on the same HTTPRoute
And the system MUST route both hostnames to the same backend service

#### Scenario: Reverse proxy route has primary and alias hostnames
Given a reverse proxy has a primary `holdenitdown.net` hostname and a local `rholden.dev` alias
When its HTTPRoute is rendered
Then the system MUST include both hostnames on the same HTTPRoute
And the system MUST route both hostnames to the same backend endpoint

### Requirement: Tunnel Alias Scope
The system MUST add `rholden.dev` route aliases only for services that are intentionally exposed through Cloudflare Tunnel aliases.

#### Scenario: Unrelated services keep existing hostnames
Given a service does not have a Cloudflare Tunnel alias under `rholden.dev`
When workload routing resources are rendered
Then the system MUST preserve that service's existing hostname set
And the system MUST NOT add a new `rholden.dev` alias to that service

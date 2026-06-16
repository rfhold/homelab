# Edge Networking Capability Spec

Stable spec at `docs/specs/edge-networking/spec.md`. Source of truth. Edited only by the `code-review` skill during delta merge.

## Purpose

## Requirements

### Requirement: kgateway Edge Gateway Upgrade
The system MUST deploy kgateway `v2.3.1` as the general Gateway API implementation for homelab ingress.

#### Scenario: kgateway chart versions are upgraded
Given the ingress stack is configured for the kgateway implementation
When the stack renders kgateway Helm releases
Then the system MUST use kgateway CRD and controller chart version `v2.3.1`

#### Scenario: Gateway API compatibility is updated
Given the ingress stack installs Gateway API CRDs
When kgateway is upgraded to `v2.3.1`
Then the system MUST install Gateway API CRDs compatible with kgateway `v2.3.1`

### Requirement: kgateway Agent Gateway Decoupling
The system MUST NOT install or configure Agent Gateway through the kgateway ingress component.

#### Scenario: ingress stack renders kgateway
Given the ingress stack deploys kgateway
When the stack renders kgateway Helm values and related resources
Then the system MUST NOT enable Agent Gateway-specific kgateway integration
And the system MUST NOT create Agent Gateway CRDs or controller resources from the ingress stack

#### Scenario: dedicated Agent Gateway stack owns Agent Gateway resources
Given Agent Gateway resources are required for AI traffic
When Pulumi resources are rendered
Then the system MUST create those resources only from the dedicated Agent Gateway program

### Requirement: Agent Gateway Edge Endpoint
The system MUST expose Agent Gateway client traffic on `agent-gateway.holdenitdown.net` through Gateway API routing.

#### Scenario: Agent Gateway hostname is routed
Given the dedicated Agent Gateway program is deployed to Pantheon
When Gateway API resources are rendered
Then the system MUST create an HTTPRoute for `agent-gateway.holdenitdown.net`
And the route MUST target Agent Gateway backends through `agentgateway.dev` backend references

#### Scenario: LiteLLM hostname is not preserved
Given the Agent Gateway replacement is deployed
When external hostnames are rendered for the replacement gateway
Then the system MUST NOT expose `litellm.holdenitdown.net` as an Agent Gateway compatibility hostname

### Requirement: Agent Gateway Client Authentication Posture
The system MUST expose the initial Agent Gateway endpoint without client API-key enforcement.

#### Scenario: client request reaches Agent Gateway
Given a client sends a request to `agent-gateway.holdenitdown.net`
When the request reaches the Agent Gateway route
Then the system MUST NOT require a LiteLLM master key or Agent Gateway client API key

#### Scenario: provider credentials remain protected
Given Agent Gateway forwards traffic to upstream model providers
When provider credentials are rendered
Then the system MUST store provider credentials in Kubernetes Secrets
And the system MUST use those secrets only for upstream provider authentication

### Requirement: Codex Proxy Internal Edge Route
The system MUST expose Codex Proxy on the internal edge for dashboard and administrative access.

#### Scenario: Codex Proxy has an internal hostname
Given the Codex Proxy program is deployed to Pantheon
When Gateway API routing resources are rendered
Then the system MUST create an HTTPRoute for `codex-proxy.holdenitdown.net`
And the system MUST route that hostname to the Codex Proxy Service

#### Scenario: Agent Gateway remains the model endpoint
Given Codex-backed models are made available to clients
When public model gateway hostnames are inspected
Then the system MUST expose Codex-backed model access through Agent Gateway
And the system MUST preserve `agent-gateway.holdenitdown.net` as the client-facing route for the `codex/` provider prefix

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

# Edge Networking Delta Spec

Delta spec at `docs/specs/changes/add-codex-proxy-provider/specs/edge-networking/spec.md`. Declares operations against the stable spec. Merged wholesale by `code-review`.

## Change Overview

### Why

Codex Proxy must remain an internal upstream behind Agent Gateway so Codex-backed models share the existing public model gateway instead of adding a direct public service endpoint.

### Impact

- **Breaking changes**: none
- **Migration**: clients use `agent-gateway.holdenitdown.net` with the `codex/` model prefix
- **Cross-change dependencies**: see `docs/specs/changes/add-codex-proxy-provider/specs/kubernetes-workloads/spec.md`

### Non-goals

- Creating a public Codex Proxy hostname
- Replacing Agent Gateway as the public model endpoint

### Rollback

Rollback removes the Codex Proxy edge exclusion requirement alongside the Codex Proxy program and Agent Gateway provider configuration.

## ADDED Requirements

### Requirement: Codex Proxy Public Route Exclusion
The system MUST keep Codex Proxy off direct public edge routing.

#### Scenario: Codex Proxy has no public hostname
Given the Codex Proxy program is deployed to Pantheon
When Gateway API routing resources are rendered
Then the system MUST NOT create an HTTPRoute for a Codex Proxy public hostname
And the system MUST NOT expose Codex Proxy as a direct public client endpoint

#### Scenario: Agent Gateway remains the public model endpoint
Given Codex-backed models are made available to clients
When public model gateway hostnames are inspected
Then the system MUST expose Codex-backed model access through Agent Gateway
And the system MUST preserve `agent-gateway.holdenitdown.net` as the client-facing route for the `codex/` provider prefix

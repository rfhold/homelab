# Tasks: add-local-rholden-dev-tunnel-access

**Status**: approved

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `edge-networking` ADDED: `Local Tunnel Alias Resolution` | 2.1, 2.2, 2.3 |
| `edge-networking` ADDED: `Local Tunnel Alias Certificate Coverage` | 2.2, 2.3 |
| `edge-networking` ADDED: `Public Tunnel Behavior Preservation` | 2.1, 2.2 |
| `kubernetes-workloads` ADDED: `Multi-Hostname HTTPRoute Configuration` | 1.1, 2.1, 2.2 |
| `kubernetes-workloads` ADDED: `Tunnel Alias Scope` | 2.1, 2.2 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: no comments unless explicitly requested; follow existing neighboring patterns; check imports before using libraries; never commit secrets; always specify return types for public functions; use Bun instead of npm/yarn/node.
- No additional `AGENTS.md` files were found under `docs/specs/`, `docs/specs/edge-networking/`, `docs/specs/kubernetes-workloads/`, `src/components/`, `programs/media-server/`, or `programs/reverse-proxy/`.

---

## Contract Boundary Assessment

- **Status**: required
- **Surfaces**: TypeScript Pulumi component/config interfaces and stack configuration surfaces for HTTPRoute hostname aliases: `programs/media-server/service.ts`, `programs/media-server/index.ts`, `src/components/gateway-reverse-proxy.ts`, `programs/reverse-proxy/index.ts`, `programs/media-server/Pulumi.prod.yaml`, `programs/reverse-proxy/Pulumi.home-assistant.yaml`, `programs/ingress/Pulumi.pantheon.yaml`
- **Rationale**: The change expands shared route configuration contracts from a single primary hostname to primary-plus-alias hostnames and adds `*.rholden.dev` to the Pantheon default gateway hostname contract.
- **Contract file**: `docs/specs/changes/add-local-rholden-dev-tunnel-access/contracts.md`

If status is `required`, `contracts.md` MUST contain the exact approved contract changes and Stage 1 MUST be contract-boundary-only. Implementation stages depend on Stage 1 evidence proving the changed contract surfaces match `contracts.md`.

---

## Stage 1: Contract Boundaries

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Add route alias contract surfaces

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Multi-Hostname HTTPRoute Configuration`; `edge-networking` ADDED Requirement: `Local Tunnel Alias Resolution`; `edge-networking` ADDED Requirement: `Local Tunnel Alias Certificate Coverage`
- **Depends on**: approved `contracts.md`
- **Files**: `programs/media-server/service.ts`, `programs/media-server/index.ts`, `src/components/gateway-reverse-proxy.ts`, `programs/reverse-proxy/index.ts`, `programs/media-server/Pulumi.prod.yaml`, `programs/reverse-proxy/Pulumi.home-assistant.yaml`, `programs/ingress/Pulumi.pantheon.yaml`
- **Approach**: Apply only the exact contract surface changes listed in `contracts.md`: optional alias hostname fields/config keys, the Overseerr/Home Assistant alias config entries, and the Pantheon default gateway `*.rholden.dev` hostname entry. Do not change HTTPRoute rendering behavior in this stage beyond compile-required wiring explicitly listed in `contracts.md`.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: TypeScript compilation exits 0, and changed contract surfaces match `docs/specs/changes/add-local-rholden-dev-tunnel-access/contracts.md`.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path

#### Evidence

- **Date**: 2026-05-31
- **Commands**:
  ```
  bun run typecheck
  ```
- **Exit status**: 0
- **Result summary**:
  ```
  bun run typecheck invoked tsc --noEmit and passed.
  Changed contract surfaces match contracts.md: optional route alias fields/config were added, Overseerr/Home Assistant alias config was added, and Pantheon defaultGateway.hostnames now includes *.rholden.dev without adding a listener.
  ```
- **Meaningful warnings/errors**: none
- **Raw output**: omitted; passing output only showed `tsc --noEmit`.
- **Files changed (across the stage)**:
  - `programs/media-server/service.ts`
  - `programs/media-server/index.ts`
  - `programs/media-server/Pulumi.prod.yaml`
  - `src/components/gateway-reverse-proxy.ts`
  - `programs/reverse-proxy/index.ts`
  - `programs/reverse-proxy/Pulumi.home-assistant.yaml`
  - `programs/ingress/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: root `AGENTS.md` notes from this plan: no comments, follow neighboring patterns, check imports before using libraries, never commit secrets, public functions need return types, use Bun.
- **Subagent statuses**:
  - Task 1.1: DONE

- [x] Stage 1 complete

---

## Stage 2: Route Rendering and Local Alias Wiring

Wait for the results from prior tasks before starting dependent sub agent tasks.

- **Depends on**: Stage 1 complete

### Task 2.1: Render service route aliases

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Multi-Hostname HTTPRoute Configuration`; `kubernetes-workloads` ADDED Requirement: `Tunnel Alias Scope`; `edge-networking` ADDED Requirement: `Local Tunnel Alias Resolution`; `edge-networking` ADDED Requirement: `Public Tunnel Behavior Preservation`
- **Depends on**: Stage 1 complete
- **Files**: `programs/media-server/service.ts`, `programs/media-server/index.ts`, `programs/media-server/Pulumi.prod.yaml`
- **Approach**: Render HTTPRoute `spec.hostnames` from the primary `hostname` plus optional alias `hostnames`, preserving the existing backend rule. Add only `overseerr.rholden.dev` to Overseerr's existing route config and leave Cloudflare Tunnel config unchanged.
- **Dispatch**: subagent

### Task 2.2: Render reverse proxy route aliases

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Multi-Hostname HTTPRoute Configuration`; `kubernetes-workloads` ADDED Requirement: `Tunnel Alias Scope`; `edge-networking` ADDED Requirement: `Local Tunnel Alias Resolution`; `edge-networking` ADDED Requirement: `Local Tunnel Alias Certificate Coverage`; `edge-networking` ADDED Requirement: `Public Tunnel Behavior Preservation`
- **Depends on**: Stage 1 complete
- **Files**: `src/components/gateway-reverse-proxy.ts`, `programs/reverse-proxy/index.ts`, `programs/reverse-proxy/Pulumi.home-assistant.yaml`
- **Approach**: Render reverse-proxy HTTPRoute `spec.hostnames` from the primary `hostname` plus optional alias `hostnames`, preserving the existing backend endpoint and timeout/websocket behavior. Add only `home.rholden.dev` to the Home Assistant reverse-proxy stack config and leave Cloudflare Tunnel config unchanged.
- **Dispatch**: subagent

### Task 2.3: Add rholden.dev to the local gateway hostname list

- **Implements**: `edge-networking` ADDED Requirement: `Local Tunnel Alias Resolution`; `edge-networking` ADDED Requirement: `Local Tunnel Alias Certificate Coverage`
- **Depends on**: Stage 1 complete
- **Files**: `programs/ingress/Pulumi.pantheon.yaml`
- **Approach**: Add `*.rholden.dev` to the Pantheon default gateway hostname list so the local `overseerr.rholden.dev` and `home.rholden.dev` HTTPRoutes can attach and use the existing default TLS secret that already covers `*.rholden.dev`. Do not add a separate listener.
- **Dispatch**: inline
- **Dispatch rationale**: This is a small config-only follow-through to the approved contract surface and shares a file with Stage 1, so keeping it inline avoids unnecessary coordination.

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  ```
- **Expected outcome**: TypeScript compilation exits 0; rendered route code includes primary and alias hostnames on the same HTTPRoute; stack config includes only `overseerr.rholden.dev` and `home.rholden.dev` as new local aliases; Cloudflare Tunnel route config remains unchanged.
- **Evidence artifact**: normalized evidence inline in this stage's Evidence block; raw output omitted unless failure, ambiguity, or output-as-artifact checks require an artifact path

#### Evidence

- **Date**: 2026-05-31
- **Commands**:
  ```
  bun run typecheck
  git diff --exit-code -- "programs/ingress/Pulumi.romulus.yaml"
  ```
- **Exit status**: 0
- **Result summary**:
  ```
  bun run typecheck invoked tsc --noEmit and passed.
  HTTPRoute rendering now combines the primary hostname with optional aliases for media-server services and the reverse proxy.
  New alias config is limited to overseerr.rholden.dev and home.rholden.dev.
  Pantheon defaultGateway.hostnames includes *.rholden.dev without adding a listener.
  Cloudflare Tunnel route config in programs/ingress/Pulumi.romulus.yaml is unchanged.
  ```
- **Meaningful warnings/errors**: none
- **Raw output**: omitted; passing output only showed `tsc --noEmit`, and the tunnel-config diff check produced no output.
- **Files changed (across the stage)**:
  - `programs/media-server/service.ts`
  - `programs/media-server/index.ts`
  - `programs/media-server/Pulumi.prod.yaml`
  - `src/components/gateway-reverse-proxy.ts`
  - `programs/reverse-proxy/index.ts`
  - `programs/reverse-proxy/Pulumi.home-assistant.yaml`
  - `programs/ingress/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: root `AGENTS.md` notes from this plan: no comments, follow neighboring patterns, check imports before using libraries, never commit secrets, public functions need return types, use Bun.
- **Subagent statuses**:
  - Task 2.1: DONE
  - Task 2.2: DONE
  - Task 2.3: inline complete

- [x] Stage 2 complete

---

## Follow-ups

None.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan and any required `contracts.md` (written). If Contract Boundary Assessment is `required`, execution starts with the contract-boundary stage and implementation stages remain blocked until Stage 1 evidence proves the changed contract surfaces match `contracts.md`.

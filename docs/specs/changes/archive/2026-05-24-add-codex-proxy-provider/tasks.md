# Tasks: add-codex-proxy-provider

**Status**: approved

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `kubernetes-workloads` MODIFIED: `Provider Prefix Model Routing` | 2.1 |
| `kubernetes-workloads` ADDED: `Dedicated Codex Proxy Program` | 1.1 |
| `kubernetes-workloads` ADDED: `Codex Proxy Internal Workload` | 1.1 |
| `kubernetes-workloads` ADDED: `Codex Proxy Conservative Runtime Defaults` | 1.1 |
| `kubernetes-workloads` ADDED: `Agent Gateway Codex Provider` | 1.1, 2.1 |
| `edge-networking` ADDED: `Codex Proxy Public Route Exclusion` | 1.1, 2.1 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `AGENTS.md`: NO comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets or expose sensitive data; always specify return types for public functions; use Bun instead of Yarn/NPM/Node.
- `programs/`, `src/components/`, and `docs/specs/` have no nested `AGENTS.md` files. `docker/AGENTS.md` exists but is not relevant because this change does not modify `docker/`.

---

## Stage 1: Codex Proxy Program

### Task 1.1: Add internal Codex Proxy deployment

- **Implements**: `kubernetes-workloads` ADDED Requirement: `Dedicated Codex Proxy Program`; `kubernetes-workloads` ADDED Requirement: `Codex Proxy Internal Workload`; `kubernetes-workloads` ADDED Requirement: `Codex Proxy Conservative Runtime Defaults`; `edge-networking` ADDED Requirement: `Codex Proxy Public Route Exclusion`
- **Depends on**: (none)
- **Files**: `src/components/codex-proxy.ts`, `src/docker-images.ts`, `programs/codex-proxy/Pulumi.yaml`, `programs/codex-proxy/Pulumi.pantheon.yaml`, `programs/codex-proxy/index.ts`
- **Approach**: Add a reusable Codex Proxy component with Deployment, ClusterIP Service, PVC mounted at `/app/data`, and ConfigMap-mounted conservative `local.yaml` that leaves `server.proxy_api_key` unset. Add a Pantheon-only program and stack config using the pinned internal image `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76`, no HTTPRoute/Ingress, and workload labels consistent with neighboring programs.
- **Dispatch**: subagent
- **Dispatch rationale**: This is a well-bounded new Pulumi program and component with isolated files, and context isolation is useful because prior conversation includes upstream repository research.

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/codex-proxy preview --stack pantheon --non-interactive
  ```
- **Expected outcome**: TypeScript compilation succeeds; Pulumi preview for `codex-proxy.pantheon` succeeds and renders only internal Kubernetes workload resources with image `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76`, no public route, and no proxy API key Secret.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/codex-proxy preview --stack pantheon --non-interactive
  pulumi -C programs/codex-proxy stack init pantheon --non-interactive
  pulumi -C programs/codex-proxy preview --stack pantheon --non-interactive
  ```
- **Output**:
  ```
  $ tsc --noEmit

  error: no stack named 'pantheon' found

  Created stack 'pantheon'

  Previewing update (pantheon):

   +  pulumi:pulumi:Stack codex-proxy-pantheon create
  @ previewing update.....
   +  kubernetes:core/v1:Namespace codex-proxy-namespace create
   +  kubernetes:core/v1:Namespace codex-proxy-namespace create
   +  homelab:components:CodexProxy codex-proxy create
   +  kubernetes:core/v1:ConfigMap codex-proxy-config create
   +  kubernetes:core/v1:PersistentVolumeClaim codex-proxy-data create
   +  kubernetes:core/v1:Service codex-proxy-service create
   +  kubernetes:apps/v1:Deployment codex-proxy-deployment create
   +  pulumi:pulumi:Stack codex-proxy-pantheon create
  Outputs:
      namespace  : "codex-proxy"
      serviceName: "codex-proxy"
      serviceUrl : "http://codex-proxy.codex-proxy.svc.cluster.local:8080"

  Resources:
      + 7 to create
  ```
- **Files changed (across the stage)**:
  - `src/components/codex-proxy.ts`
  - `src/docker-images.ts`
  - `programs/codex-proxy/Pulumi.yaml`
  - `programs/codex-proxy/Pulumi.pantheon.yaml`
  - `programs/codex-proxy/index.ts`
- **AGENTS.md notes applied**: no comments unless explicitly requested; followed neighboring Pulumi component/program patterns; no secrets added; public method has return type; used Bun for verification.
- **Subagent statuses**:
  - Task 1.1: DONE

- [x] Stage 1 complete

---

## Stage 2: Agent Gateway Codex Provider

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Add Codex provider prefix routing

- **Implements**: `kubernetes-workloads` MODIFIED Requirement: `Provider Prefix Model Routing`; `kubernetes-workloads` ADDED Requirement: `Agent Gateway Codex Provider`; `edge-networking` ADDED Requirement: `Codex Proxy Public Route Exclusion`
- **Depends on**: Task 1.1
- **Files**: `src/components/agent-gateway.ts`, `programs/agent-gateway/Pulumi.pantheon.yaml`
- **Approach**: Extend Agent Gateway provider routing so a single provider can match and strip a configured model prefix instead of requiring explicit aliases for every passthrough model. Add a `codex/` provider in the Pantheon Agent Gateway config targeting the internal Codex Proxy Service, using OpenAI-compatible routing without an Agent Gateway-to-Codex-Proxy API key.
- **Dispatch**: subagent
- **Dispatch rationale**: This task changes existing gateway routing behavior and should be isolated from the new workload implementation after Task 1.1 establishes the service name and namespace.

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/agent-gateway preview --stack pantheon --non-interactive
  ```
- **Expected outcome**: TypeScript compilation succeeds; Agent Gateway preview succeeds and shows the `codex/` provider route targeting the internal Codex Proxy Service without adding a public Codex Proxy route or Codex Proxy authorization Secret.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-24
- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/agent-gateway preview --stack pantheon --non-interactive
  ```
- **Output**:
  ```
  $ tsc --noEmit

  Previewing update (pantheon):

  @ previewing update......
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-codex-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-codex-backend create
   ~  kubernetes:gateway.networking.k8s.io/v1:HTTPRoute agent-gateway-httproute update [diff: ~metadata,spec]
  @ previewing update....
      pulumi:pulumi:Stack agent-gateway-pantheon
  Outputs:
    ~ backendNames: [
          [0]: "openai"
          [1]: "anthropic"
          [2]: "chutes"
        ~ [3]: "cerebras" => "codex"
        ~ [4]: "vllm-qwen3-embedding-4b" => "cerebras"
        ~ [5]: "llama-cpp-gemma-4-e2b" => "vllm-qwen3-embedding-4b"
        ~ [6]: "llama-cpp-qwen3-6-35b-a3b" => "llama-cpp-gemma-4-e2b"
        + [7]: "llama-cpp-qwen3-6-35b-a3b"
      ]

  Resources:
      + 1 to create
      ~ 1 to update
      2 changes. 32 unchanged
  ```
- **Files changed (across the stage)**:
  - `src/components/agent-gateway.ts`
  - `programs/agent-gateway/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: no comments added; followed existing Agent Gateway provider and policy patterns; no Codex Proxy auth Secret or Authorization header added; used Bun for verification.
- **Subagent statuses**:
  - Task 2.1: DONE

- [x] Stage 2 complete

---

## Follow-ups

None.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: (none — CRITICAL findings return the change to `writing-specs` before planning)
- **WARNING**: None
- **SUGGESTION**: None

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

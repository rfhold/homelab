# Tasks: migrate-agent-gateway

**Status**: in progress

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `edge-networking` ADDED: `kgateway Edge Gateway Upgrade` | 1.1, 1.2 |
| `edge-networking` ADDED: `kgateway Agent Gateway Decoupling` | 1.1 |
| `edge-networking` ADDED: `Agent Gateway Edge Endpoint` | 2.1, 2.2 |
| `edge-networking` ADDED: `Agent Gateway Client Authentication Posture` | 2.1, 2.2 |
| `kubernetes-workloads` ADDED: `Dedicated Agent Gateway Program` | 2.1 |
| `kubernetes-workloads` ADDED: `Agent Gateway Stable Release` | 2.1 |
| `kubernetes-workloads` ADDED: `LiteLLM Workload Replacement` | 2.2, 3.1 |
| `kubernetes-workloads` ADDED: `Provider Prefix Model Routing` | 2.2 |
| `kubernetes-workloads` ADDED: `Self-Hosted Model Name Preservation` | 2.2 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: do not add comments unless explicitly requested; follow neighboring patterns; check imports before using libraries; never commit secrets; always specify return types for public functions; avoid refactoring language in code; use Bun instead of Yarn/NPM/Node.
- No additional `AGENTS.md` files exist under `docs/specs/`, `src/`, or `programs/`; the repo-level notes apply to all planned source and stack changes.

---

## Stage 1: kgateway Upgrade And Decoupling

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Upgrade kgateway and remove embedded Agent Gateway integration

- **Implements**: `edge-networking` ADDED Requirement: `kgateway Edge Gateway Upgrade`; `edge-networking` ADDED Requirement: `kgateway Agent Gateway Decoupling`
- **Depends on**: (none)
- **Files**: `src/helm-charts.ts`, `src/components/kgateway.ts`, `src/modules/ingress.ts`, `programs/ingress/Pulumi.pantheon.yaml`, `programs/ingress/Pulumi.romulus.yaml`
- **Approach**: Update kgateway chart constants to `v2.3.1`, update Gateway API CRD defaults/configuration for the compatible kgateway release, and remove the stale Agent Gateway-specific `aiGateway` path from the kgateway component and ingress stack configuration. Preserve kgateway as the general Gateway API implementation and preserve the existing default Gateway behavior.
- **Dispatch**: subagent

### Task 1.2: Audit Gateway API policy compatibility for kgateway v2.3.1

- **Implements**: `edge-networking` ADDED Requirement: `kgateway Edge Gateway Upgrade`
- **Depends on**: Task 1.1
- **Files**: `src/components/alloy.ts`, any other `gateway.kgateway.dev` or Gateway API policy resources found during the audit
- **Approach**: Review existing kgateway policy resources for v2.3/Gateway API compatibility, including non-spec CORS patterns. Update only resources that would be invalid or incompatible after the kgateway upgrade.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/ingress preview --stack pantheon --non-interactive
  pulumi -C programs/ingress preview --stack romulus --non-interactive
  ```
- **Expected outcome**: TypeScript typecheck exits 0; both ingress previews render kgateway resources without Agent Gateway CRDs, Agent Gateway controller resources, or Agent Gateway-specific kgateway Helm transformations.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/ingress preview --stack pantheon --non-interactive
  pulumi -C programs/ingress preview --stack romulus --non-interactive
  ```
- **Output**:
  ```
  $ bun run typecheck
  $ tsc --noEmit

  $ pulumi -C programs/ingress preview --stack pantheon --non-interactive
  Previewing update (pantheon):
   ~  homelab:modules:Ingress cluster-ingress update [diff: +workloadLabels~gateway]
   ~  homelab:components:Kgateway cluster-ingress-gateway update [diff: -aiGateway]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:directresponses.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:backends.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:backendconfigpolicies.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:gatewayextensions.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:httplistenerpolicies.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:trafficpolicies.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:listenerpolicies.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:gatewayparameters.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:core/v1:Service cluster-ingress-gateway-chart:ingress/cluster-ingress-gateway-chart-kgateway update [diff: ~metadata,spec]
   ~  kubernetes:apps/v1:Deployment cluster-ingress-gateway-chart:ingress/cluster-ingress-gateway-chart-kgateway update [diff: ~metadata,spec]
   -  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-agentgateway-crds:agentgatewayparameters.agentgateway.dev delete
   -  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-agentgateway-crds:agentgatewaypolicies.agentgateway.dev delete
   -  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-agentgateway-crds:agentgatewaybackends.agentgateway.dev delete
   -  kubernetes:helm.sh/v4:Chart cluster-ingress-gateway-agentgateway-crds delete
  Resources:
      ~ 24 to update
      - 4 to delete
      28 changes. 160 unchanged

  $ pulumi -C programs/ingress preview --stack romulus --non-interactive
  Previewing update (romulus):
   ~  homelab:modules:Ingress cluster-ingress update [diff: +workloadLabels~gateway]
   ~  homelab:components:Kgateway cluster-ingress-gateway update [diff: -aiGateway]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:directresponses.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:backends.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:backendconfigpolicies.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:gatewayextensions.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:trafficpolicies.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:httplistenerpolicies.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:listenerpolicies.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-crds-chart:gatewayparameters.gateway.kgateway.dev update [diff: ~metadata,spec]
   ~  kubernetes:core/v1:Service cluster-ingress-gateway-chart:ingress/cluster-ingress-gateway-chart-kgateway update [diff: ~metadata,spec]
   ~  kubernetes:apps/v1:Deployment cluster-ingress-gateway-chart:ingress/cluster-ingress-gateway-chart-kgateway update [diff: ~metadata,spec]
   -  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-agentgateway-crds:agentgatewayparameters.agentgateway.dev delete
   -  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-agentgateway-crds:agentgatewaybackends.agentgateway.dev delete
   -  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition cluster-ingress-gateway-agentgateway-crds:agentgatewaypolicies.agentgateway.dev delete
   -  kubernetes:helm.sh/v4:Chart cluster-ingress-gateway-agentgateway-crds delete
  Resources:
      ~ 33 to update
      - 4 to delete
      37 changes. 172 unchanged
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/migrate-agent-gateway/tasks.md`
  - `src/helm-charts.ts`
  - `src/components/kgateway.ts`
  - `src/modules/ingress.ts`
  - `programs/ingress/Pulumi.pantheon.yaml`
  - `programs/ingress/Pulumi.romulus.yaml`
- **AGENTS.md notes applied**: repo-level notes from `/home/rfhold/repos/rfhold/homelab/AGENTS.md`.
- **Subagent statuses**:
  - Task 1.1: DONE_WITH_CONCERNS; pre-existing unrelated diffs were left untouched.
  - Task 1.2: DONE; no policy compatibility changes required.

- [x] Stage 1 complete

---

## Stage 2: Dedicated Agent Gateway Program

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Create the Pantheon Agent Gateway program

- **Implements**: `edge-networking` ADDED Requirement: `Agent Gateway Edge Endpoint`; `edge-networking` ADDED Requirement: `Agent Gateway Client Authentication Posture`; `kubernetes-workloads` ADDED Requirement: `Dedicated Agent Gateway Program`; `kubernetes-workloads` ADDED Requirement: `Agent Gateway Stable Release`
- **Depends on**: Stage 1
- **Files**: `src/helm-charts.ts`, `src/components/agent-gateway.ts`, `programs/agent-gateway/index.ts`, `programs/agent-gateway/Pulumi.pantheon.yaml`
- **Approach**: Add Agent Gateway chart constants for stable `v1.2.1`, create a reusable component for Agent Gateway CRDs, controller, GatewayClass/Gateway, provider secrets, and HTTPRoute resources, and create a Pantheon-only Pulumi program exposing `agent-gateway.holdenitdown.net`. Do not configure client API-key enforcement.
- **Dispatch**: subagent

### Task 2.2: Migrate provider and model routing into Agent Gateway

- **Implements**: `edge-networking` ADDED Requirement: `Agent Gateway Edge Endpoint`; `edge-networking` ADDED Requirement: `Agent Gateway Client Authentication Posture`; `kubernetes-workloads` ADDED Requirement: `LiteLLM Workload Replacement`; `kubernetes-workloads` ADDED Requirement: `Provider Prefix Model Routing`; `kubernetes-workloads` ADDED Requirement: `Self-Hosted Model Name Preservation`
- **Depends on**: Task 2.1
- **Files**: `src/components/agent-gateway.ts`, `programs/agent-gateway/index.ts`, `programs/agent-gateway/Pulumi.pantheon.yaml`
- **Approach**: Translate the current LiteLLM OpenAI, Anthropic, Cerebras, Chutes, and vLLM backend configuration into Agent Gateway backend resources and route configuration. External provider requests use provider-prefixed client model names and strip configured prefixes before upstream forwarding; self-hosted vLLM-compatible requests preserve complete model names.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/agent-gateway preview --stack pantheon --non-interactive
  ```
- **Expected outcome**: TypeScript typecheck exits 0; the Agent Gateway preview renders Agent Gateway `v1.2.1` Helm releases, a Pantheon stack only, `agent-gateway.holdenitdown.net` Gateway API routing, provider Secret references, AgentgatewayBackend resources, and no client API-key enforcement policy.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/agent-gateway preview --stack pantheon --non-interactive
  ```
- **Output**:
  ```
  $ bun run typecheck
  $ tsc --noEmit

  $ pulumi -C programs/agent-gateway preview --stack pantheon --non-interactive
  Previewing update (pantheon):
   +  pulumi:pulumi:Stack agent-gateway-pantheon create
   +  pulumi:index:Stash cerebras-api-key create
   +  pulumi:index:Stash chutes-api-key create
   +  pulumi:index:Stash openai-api-key create
   +  pulumi:index:Stash anthropic-api-key create
   +  kubernetes:core/v1:Namespace agent-gateway-namespace create
   +  homelab:components:AgentGateway agent-gateway create
   +  kubernetes:core/v1:Secret agent-gateway-anthropic-secret create
   +  kubernetes:core/v1:Secret agent-gateway-chutes-secret create
   +  kubernetes:core/v1:Secret agent-gateway-cerebras-secret create
   +  kubernetes:core/v1:Secret agent-gateway-openai-secret create
   +  kubernetes:helm.sh/v4:Chart agent-gateway-crds-chart create
   +  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition agentgatewayparameters.agentgateway.dev create
   +  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition agentgatewaypolicies.agentgateway.dev create
   +  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition agentgatewaybackends.agentgateway.dev create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-openai-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-vllm-glm-4-7-flash-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-anthropic-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-cerebras-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-vllm-qwen3-embedding-4b-backend create
   +  kubernetes:helm.sh/v4:Chart agent-gateway-chart create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-chutes-backend create
   +  kubernetes:gateway.networking.k8s.io/v1:Gateway agent-gateway-gateway create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayPolicy agent-gateway-model-routing-policy create
   +  kubernetes:gateway.networking.k8s.io/v1:HTTPRoute agent-gateway-httproute create
  Outputs:
      backendNames: [openai, anthropic, cerebras, chutes, vllm-glm-4-7-flash, vllm-qwen3-embedding-4b]
      gateway     : "agentgateway-proxy"
      routeUrl    : "https://agent-gateway.holdenitdown.net"
   Resources:
       + 30 to create
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/migrate-agent-gateway/tasks.md`
  - `src/helm-charts.ts`
  - `src/components/agent-gateway.ts`
  - `programs/agent-gateway/index.ts`
  - `programs/agent-gateway/Pulumi.yaml`
  - `programs/agent-gateway/Pulumi.pantheon.yaml`
- **AGENTS.md notes applied**: repo-level notes from `/home/rfhold/repos/rfhold/homelab/AGENTS.md`.
- **Subagent statuses**:
  - Task 2.1: DONE_WITH_CONCERNS; added `programs/agent-gateway/Pulumi.yaml` because `pulumi -C programs/agent-gateway` requires project metadata, and verification initialized the new `pantheon` stack.
  - Task 2.2: DONE_WITH_CONCERNS; prefix stripping is implemented as configured `modelAliases` for the current model set rather than arbitrary dynamic prefix stripping.
- **Coordinator adjustments**:
  - Removed an invalid pre-stack `encryptionsalt` so `pulumi stack init pantheon --non-interactive` could generate stack metadata with the active passphrase.
  - Removed `pathPrefix` fields from custom OpenAI-compatible providers after the Agent Gateway CRD rejected `.spec.ai.provider.pathPrefix`; `/v1` remains the default OpenAI-compatible provider path.
  - Added a PreRouting `AgentgatewayPolicy` to extract the request body `model` field into `x-model` and changed the HTTPRoute to render one header-matched rule per provider alias set, so provider-prefixed model names select the intended backend before `modelAliases` strip or preserve the upstream model name.

- [x] Stage 2 complete

---

## Stage 3: LiteLLM Replacement Cleanup

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 3.1: Remove LiteLLM from active client-facing routing

- **Implements**: `kubernetes-workloads` ADDED Requirement: `LiteLLM Workload Replacement`
- **Depends on**: Stage 2
- **Files**: `programs/litellm/index.ts`, `programs/litellm/Pulumi.pantheon.yaml`, `src/components/litellm.ts`, references to the LiteLLM stack found during implementation
- **Approach**: Remove or disable the LiteLLM stack and component from active client-facing LLM routing after Agent Gateway owns the replacement endpoint. Preserve unrelated AI inference workloads and avoid exposing `litellm.holdenitdown.net` as an Agent Gateway compatibility hostname.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/agent-gateway preview --stack pantheon --non-interactive
  ```
- **Expected outcome**: TypeScript typecheck exits 0; the Agent Gateway preview remains valid after LiteLLM cleanup; no active client-facing routing to the LiteLLM Deployment or Service remains in the planned resources.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-23
- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/agent-gateway preview --stack pantheon --non-interactive
  ```
- **Output**:
  ```
  $ bun run typecheck
  $ tsc --noEmit

  $ pulumi -C programs/agent-gateway preview --stack pantheon --non-interactive
  Previewing update (pantheon):
   +  pulumi:pulumi:Stack agent-gateway-pantheon create
   +  pulumi:index:Stash chutes-api-key create
   +  pulumi:index:Stash anthropic-api-key create
   +  pulumi:index:Stash openai-api-key create
   +  pulumi:index:Stash cerebras-api-key create
   +  kubernetes:core/v1:Namespace agent-gateway-namespace create
   +  homelab:components:AgentGateway agent-gateway create
   +  kubernetes:core/v1:Secret agent-gateway-openai-secret create
   +  kubernetes:core/v1:Secret agent-gateway-cerebras-secret create
   +  kubernetes:core/v1:Secret agent-gateway-anthropic-secret create
   +  kubernetes:core/v1:Secret agent-gateway-chutes-secret create
   +  kubernetes:helm.sh/v4:Chart agent-gateway-crds-chart create
   +  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition agentgatewayparameters.agentgateway.dev create
   +  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition agentgatewaypolicies.agentgateway.dev create
   +  kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition agentgatewaybackends.agentgateway.dev create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-openai-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-vllm-glm-4-7-flash-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-cerebras-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-vllm-qwen3-embedding-4b-backend create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-anthropic-backend create
   +  kubernetes:helm.sh/v4:Chart agent-gateway-chart create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayBackend agent-gateway-chutes-backend create
   +  kubernetes:gateway.networking.k8s.io/v1:Gateway agent-gateway-gateway create
   +  kubernetes:agentgateway.dev/v1alpha1:AgentgatewayPolicy agent-gateway-model-routing-policy create
   +  kubernetes:gateway.networking.k8s.io/v1:HTTPRoute agent-gateway-httproute create
  Outputs:
      backendNames: [openai, anthropic, cerebras, chutes, vllm-glm-4-7-flash, vllm-qwen3-embedding-4b]
      gateway     : "agentgateway-proxy"
      routeUrl    : "https://agent-gateway.holdenitdown.net"
   Resources:
       + 30 to create
  ```
- **Files changed (across the stage)**:
  - `docs/specs/changes/migrate-agent-gateway/tasks.md`
  - `programs/litellm/index.ts`
  - `programs/litellm/Pulumi.pantheon.yaml`
  - `README.md`
  - `skills/homelab/SKILL.md`
- **AGENTS.md notes applied**: repo-level notes from `/home/rfhold/repos/rfhold/homelab/AGENTS.md`.
- **Subagent statuses**:
  - Task 3.1: DONE; LiteLLM program now produces no Kubernetes resources, Pantheon LiteLLM route/provider config was removed, and active homelab references were updated from LiteLLM to Agent Gateway.

- [x] Stage 3 complete

---

## Follow-ups

None.

---

## Review summary

Findings from `review-changes` validation (inline handoff context, not a file):

- **CRITICAL**: None.
- **WARNING**: None.
- **SUGGESTION**: None.

---

## Approval

- [x] User has reviewed and approved this plan (written). This is the workflow's sole approval gate.

# Tasks: add-openbao-on-romulus

**Status**: approved

## Supersession Note

The prior Vault implementation plan and Stage 1 evidence were invalidated by the requirement change to OpenBao. Execution MUST replace the in-progress Vault artifacts with OpenBao artifacts before any deployment is considered ready.

The change folder remains `docs/specs/changes/add-vault-on-romulus/` for continuity with the existing superspec change, but this revised plan implements OpenBao only.

## Coverage Matrix

| Requirement | Task(s) |
|---|---|
| `secrets-management` ADDED: `Romulus OpenBao Deployment` | 1.1, 1.2 |
| `secrets-management` ADDED: `OpenBao Operator Authentication` | 2.1, 2.2 |
| `secrets-management` ADDED: `OpenBao Secret Engines For V1` | 1.1, 3.1 |
| `secrets-management` ADDED: `OpenBao Bootstrap And Unseal` | 2.2 |
| `secrets-management` ADDED: `Pulumi Secret Delivery Boundary` | 3.1, 3.2 |
| `secrets-management` ADDED: `OpenBao Adoption Scope Boundaries` | 1.1, 2.2, 3.2 |

## AGENTS.md Notes

AGENTS.md files were read during plan-review. Relevant notes are captured here and forwarded to `execution` and `code-review` via this file.

- `/home/rfhold/repos/rfhold/homelab/AGENTS.md`: do not add comments unless explicitly requested; follow neighboring file patterns; check imports before using libraries; never expose secrets; specify return types for public functions; use Bun for repo commands.

## OpenBao Planning Notes

- Official OpenBao Helm chart repository: `https://openbao.github.io/openbao-helm`, chart name `openbao`.
- OpenBao Helm docs describe standalone mode as a single-server file-storage deployment; this is acceptable only because the approved v1 scope explicitly requires single-node manual-unseal adoption.
- OpenBao replaces HashiCorp Vault in this change. Do not keep a HashiCorp Vault chart, component, program, namespace, hostname, or operations runbook as the deployable target.
- Pulumi's `hashivault://` secrets provider remains the integration target for Transit-backed stack encryption, using OpenBao's Vault-compatible API surface.

---

## Stage 1: OpenBao Foundation

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 1.1: Replace Vault reusable code with OpenBao reusable code

- **Implements**: `secrets-management` ADDED Requirement: `Romulus OpenBao Deployment`; `secrets-management` ADDED Requirement: `OpenBao Secret Engines For V1`; `secrets-management` ADDED Requirement: `OpenBao Adoption Scope Boundaries`
- **Depends on**: (none)
- **Files**: `src/helm-charts.ts`, `src/components/vault.ts`, `src/modules/vault.ts`, `src/components/openbao.ts`, `src/modules/openbao.ts`, related exports if needed
- **Approach**: Remove or replace the in-progress HashiCorp Vault component/module with an OpenBao component/module using the official OpenBao Helm chart. Model single-node persistent storage, internal service/UI surfaces, KV and Transit mount outputs, manual-unseal assumptions, and disabled CSI/agent injection for v1.
- **Dispatch**: subagent

### Task 1.2: Replace the Romulus Vault program with an OpenBao program

- **Implements**: `secrets-management` ADDED Requirement: `Romulus OpenBao Deployment`
- **Depends on**: Task 1.1
- **Files**: `programs/vault/Pulumi.yaml`, `programs/vault/index.ts`, `programs/vault/Pulumi.romulus.yaml`, `programs/openbao/Pulumi.yaml`, `programs/openbao/index.ts`, `programs/openbao/Pulumi.romulus.yaml`, `README.md`
- **Approach**: Remove or supersede the in-progress `vault` program and create a dedicated `openbao` program targeting `romulus`, with an internal hostname, namespace, Gateway API `HTTPRoute`, persistent storage settings, and baseline outputs for service URLs, mount paths, and operational docs.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/openbao preview -s romulus --non-interactive
  ```
- **Expected outcome**: TypeScript compilation passes from the repo root, and `programs/openbao` previews successfully for the `romulus` stack without HashiCorp Vault resources, missing-stack, missing-config, or chart-shape errors. If the new `openbao` stack metadata does not exist yet, execution records the required `pulumi stack init romulus --non-interactive` setup before this preview evidence.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-04
- **Commands**:
  ```
  bun run typecheck
  pulumi stack ls
  pulumi stack init romulus --non-interactive
  pulumi -C programs/openbao preview -s romulus --non-interactive
  ```
- **Output**:
  ```
  $ bun run typecheck
  $ tsc --noEmit

  $ pulumi stack ls
  NAME  LAST UPDATE  RESOURCE COUNT

  $ pulumi stack init romulus --non-interactive
  Created stack 'romulus'

  $ pulumi -C programs/openbao preview -s romulus --non-interactive
  Previewing update (romulus):

   +  pulumi:pulumi:Stack openbao-romulus create 
  @ previewing update......
   +  kubernetes:core/v1:Namespace openbao create 
   +  kubernetes:core/v1:Namespace openbao create 
   +  homelab:modules:OpenBao openbao create 
   +  homelab:components:OpenBao openbao create 
   +  kubernetes:helm.sh/v4:Chart openbao-chart create 
  @ previewing update........................
   +  kubernetes:core/v1:ConfigMap openbao-chart:openbao/openbao-chart-config create 
   +  kubernetes:core/v1:ServiceAccount openbao-chart:openbao/openbao-chart create 
   +  kubernetes:rbac.authorization.k8s.io/v1:ClusterRoleBinding openbao-chart:openbao-chart-server-binding create 
   +  kubernetes:core/v1:Service openbao-chart:openbao/openbao-chart-ui create 
   +  kubernetes:core/v1:Service openbao-chart:openbao/openbao-chart-internal create 
   +  kubernetes:core/v1:Service openbao-chart:openbao/openbao-chart create 
   +  kubernetes:apps/v1:StatefulSet openbao-chart:openbao/openbao-chart create 
   +  kubernetes:rbac.authorization.k8s.io/v1:ClusterRoleBinding openbao-chart:openbao-chart-server-binding create 
   +  kubernetes:gateway.networking.k8s.io/v1:HTTPRoute openbao-route create 
   +  pulumi:pulumi:Stack openbao-romulus create 
  Outputs:
      openbaoHostname        : "openbao.holdenitdown.net"
      openbaoKvMountPath     : "kv"
      openbaoNamespace       : "openbao"
      openbaoOperations      : {
          approvedV1Paths: {
              kv        : "kv/"
              transitKey: "transit/keys/pulumi"
          }
          bootstrap      : {
              initCommand       : "bao operator init"
              localAddress      : "http://127.0.0.1:8200"
              manualOnly        : true
              namespace         : "openbao"
              portForwardCommand: "kubectl -n openbao port-forward service/openbao-chart-ui 8200:8200"
              serviceName       : "openbao-chart"
              statusCommand     : "bao status"
              uiServiceName     : "openbao-chart-ui"
              unsealCommand     : "bao operator unseal"
          }
          runbookPath    : "docs/operations/openbao.md"
          scopeBoundaries: [
              [0]: "single-node OpenBao deployment for v1"
              [1]: "persistent file storage on the configured Kubernetes storage class"
              [2]: "manual operator init and manual unseal only"
              [3]: "KV secrets for internal operator and workload values"
              [4]: "Transit key for Pulumi secrets-provider migration"
              [5]: "no high-availability clustering in v1"
              [6]: "no auto-unseal in v1"
              [7]: "no public internet exposure"
          ]
      }
      openbaoRouteName       : "openbao"
      openbaoServiceName     : "openbao-chart"
      openbaoServiceUrl      : "http://openbao-chart.openbao.svc:8200"
      openbaoStorageClass    : "shared-fs"
      openbaoStorageSize     : "10Gi"
      openbaoTransitKeyName  : "pulumi"
      openbaoTransitMountPath: "transit"
      openbaoUiServiceName   : "openbao-chart-ui"
      openbaoUiUrl           : "http://openbao-chart-ui.openbao.svc:8200"
      openbaoUrl             : "https://openbao.holdenitdown.net"

  Resources:
      + 13 to create

  warning: A new version of Pulumi is available. To upgrade from version '3.224.0' to '3.234.0', visit https://pulumi.com/docs/install/ for manual instructions and release notes.
  ```
- **Files changed (across the stage)**:
  - `src/helm-charts.ts`
  - `src/components/openbao.ts`
  - `src/modules/openbao.ts`
  - `src/components/vault.ts`
  - `src/modules/vault.ts`
  - `programs/openbao/Pulumi.yaml`
  - `programs/openbao/Pulumi.romulus.yaml`
  - `programs/openbao/index.ts`
  - `programs/vault/Pulumi.yaml`
  - `programs/vault/Pulumi.romulus.yaml`
  - `programs/vault/index.ts`
  - `README.md`
- **AGENTS.md notes applied**: no comments unless explicitly requested; followed neighboring file patterns; checked imports before using libraries; did not expose secrets; public methods retain return types; used Bun for repo commands.
- **Subagent statuses**:
  - Task 1.1: DONE
  - Task 1.2: DONE_WITH_CONCERNS
- **Concerns recorded**: `docs/operations/openbao.md` is referenced but intentionally created in Stage 2; `docs/operations/vault.md` still contains obsolete content until Stage 2 replacement.

- [x] Stage 1 complete

---

## Stage 2: Auth And Operations

Wait for the results from prior tasks before starting dependent sub agent tasks.

### Task 2.1: Wire Authentik OIDC for OpenBao operators

- **Implements**: `secrets-management` ADDED Requirement: `OpenBao Operator Authentication`
- **Depends on**: Task 1.2
- **Files**: `src/components/authentik-oidc-app.ts`, `programs/authentik/index.ts`, `programs/openbao/index.ts`, `src/adapters/stack-reference.ts`
- **Approach**: Replace the in-progress Vault OIDC application and outputs with OpenBao OIDC application resources and `openbaoOidc*` outputs. Do not make the OpenBao deployment require undeployed Authentik stack outputs; OpenBao should expose static OIDC expectations and the runbook should consume Authentik outputs after the Authentik stack is applied.
- **Dispatch**: subagent

### Task 2.2: Add OpenBao bootstrap, unseal, and operations surfaces

- **Implements**: `secrets-management` ADDED Requirement: `OpenBao Operator Authentication`; `secrets-management` ADDED Requirement: `OpenBao Bootstrap And Unseal`; `secrets-management` ADDED Requirement: `OpenBao Adoption Scope Boundaries`
- **Depends on**: Task 2.1
- **Files**: `programs/openbao/index.ts`, `README.md`, `docs/operations/vault.md`, `docs/operations/openbao.md`
- **Approach**: Replace the Vault runbook with an OpenBao runbook covering manual initialization, manual unseal, Authentik OIDC login setup after bootstrap, approved v1 secret paths, and explicit non-goals. Keep sensitive values out of code and docs, and document deployment ordering without requiring OpenBao to read Authentik outputs before they exist.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/authentik preview -s romulus --non-interactive
  pulumi -C programs/openbao preview -s romulus --non-interactive
  ```
- **Expected outcome**: TypeScript compilation passes, the `programs/authentik` preview shows OpenBao OIDC application outputs without Vault OIDC outputs, the `programs/openbao` preview succeeds without requiring deployed Authentik outputs, and the OpenBao runbook exists in the worktree.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-04
- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/authentik preview -s romulus --non-interactive
  pulumi -C programs/openbao preview -s romulus --non-interactive
  ```
- **Output**:
  ```
  $ bun run typecheck
  $ tsc --noEmit

  $ pulumi -C programs/authentik preview -s romulus --non-interactive
  Previewing update (romulus):

  @ previewing update.....
   +  homelab:components:AuthentikOIDCApp openbao-oidc create 
   ~  authentik:index:Brand site-brand update 
   +  random:index:RandomPassword openbao-oidc-client-secret create 
   ~  kubernetes:postgresql.cnpg.io/v1:Cluster authentik-postgres update [diff: ~provider,spec]
      pulumi:pulumi:Stack authentik-romulus running read kubernetes:core/v1:Secret authentik-postgres-app-secret
  @ previewing update....
      pulumi:pulumi:Stack authentik-romulus running read kubernetes:core/v1:Secret authentik-postgres-app-secret
  @ previewing update.....
   +  authentik:index:ProviderOauth2 openbao-oidc-provider create 
   +  authentik:index:Application openbao-oidc-app create 
      pulumi:pulumi:Stack authentik-romulus  
  Outputs:
    + openbaoOidcCliRedirectUri: "http://localhost:8250/oidc/callback"
    + openbaoOidcClientId      : "openbao"
    + openbaoOidcClientSecret  : [unknown]
    + openbaoOidcDiscoveryUrl  : "https://auth.holdenitdown.net/application/o/openbao/.well-known/openid-configuration"
    + openbaoOidcIssuerUrl     : "https://auth.holdenitdown.net/application/o/openbao/"
    + openbaoOidcUiRedirectUri : "https://openbao.holdenitdown.net/ui/vault/auth/oidc/oidc/callback"

  Resources:
      + 4 to create
      ~ 2 to update
      6 changes. 24 unchanged

  $ pulumi -C programs/openbao preview -s romulus --non-interactive
  Previewing update (romulus):

   +  pulumi:pulumi:Stack openbao-romulus create 
  @ previewing update..........
   +  kubernetes:core/v1:Namespace openbao create 
   +  kubernetes:core/v1:Namespace openbao create 
   +  homelab:modules:OpenBao openbao create 
   +  homelab:components:OpenBao openbao create 
   +  kubernetes:helm.sh/v4:Chart openbao-chart create 
  @ previewing update...................
   +  kubernetes:core/v1:ServiceAccount openbao-chart:openbao/openbao-chart create 
   +  kubernetes:rbac.authorization.k8s.io/v1:ClusterRoleBinding openbao-chart:openbao-chart-server-binding create 
   +  kubernetes:core/v1:ConfigMap openbao-chart:openbao/openbao-chart-config create 
   +  kubernetes:core/v1:Service openbao-chart:openbao/openbao-chart create 
   +  kubernetes:core/v1:Service openbao-chart:openbao/openbao-chart-ui create 
   +  kubernetes:core/v1:Service openbao-chart:openbao/openbao-chart-internal create 
   +  kubernetes:apps/v1:StatefulSet openbao-chart:openbao/openbao-chart create 
   +  kubernetes:rbac.authorization.k8s.io/v1:ClusterRoleBinding openbao-chart:openbao-chart-server-binding create 
   +  kubernetes:gateway.networking.k8s.io/v1:HTTPRoute openbao-route create 
  @ previewing update....
   +  pulumi:pulumi:Stack openbao-romulus create 
  Outputs:
      openbaoHostname          : "openbao.holdenitdown.net"
      openbaoKvMountPath       : "kv"
      openbaoNamespace         : "openbao"
      openbaoOidcCliRedirectUri: "http://localhost:8250/oidc/callback"
      openbaoOidcClientId      : "openbao"
      openbaoOidcDefaultRole   : "operator"
      openbaoOidcDiscoveryUrl  : "https://auth.holdenitdown.net/application/o/openbao/.well-known/openid-configuration"
      openbaoOidcIssuerUrl     : "https://auth.holdenitdown.net/application/o/openbao/"
      openbaoOidcMountPath     : "oidc"
      openbaoOidcUiRedirectUri : "https://openbao.holdenitdown.net/ui/vault/auth/oidc/oidc/callback"
      openbaoOperations        : {
          approvedV1Paths: {
              kv        : "kv/"
              transitKey: "transit/keys/pulumi"
          }
          bootstrap      : {
              initCommand       : "bao operator init"
              localAddress      : "http://127.0.0.1:8200"
              manualOnly        : true
              namespace         : "openbao"
              portForwardCommand: "kubectl -n openbao port-forward service/openbao-chart-ui 8200:8200"
              serviceName       : "openbao-chart"
              statusCommand     : "bao status"
              uiServiceName     : "openbao-chart-ui"
              unsealCommand     : "bao operator unseal"
          }
          deploymentOrder: [
              [0]: "deploy Authentik so OpenBao OIDC outputs exist"
              [1]: "deploy OpenBao independently without reading Authentik outputs"
              [2]: "initialize and unseal OpenBao manually"
              [3]: "enable OIDC inside OpenBao with operator-run bao commands"
          ]
          oidc           : {
              cliRedirectUri: "http://localhost:8250/oidc/callback"
              clientId      : "openbao"
              defaultRole   : "operator"
              discoveryUrl  : "https://auth.holdenitdown.net/application/o/openbao/.well-known/openid-configuration"
              issuerUrl     : "https://auth.holdenitdown.net/application/o/openbao/"
              mountPath     : "oidc"
              uiRedirectUri : "https://openbao.holdenitdown.net/ui/vault/auth/oidc/oidc/callback"
          }
          runbookPath    : "docs/operations/openbao.md"
          scopeBoundaries: [
              [0]: "single-node OpenBao deployment for v1"
              [1]: "persistent file storage on the configured Kubernetes storage class"
              [2]: "manual operator init and manual unseal only"
              [3]: "KV secrets for internal operator and workload values"
              [4]: "Transit key for Pulumi secrets-provider migration"
              [5]: "no high-availability clustering in v1"
              [6]: "no auto-unseal in v1"
              [7]: "no public internet exposure"
          ]
      }
      openbaoRouteName         : "openbao"
      openbaoServiceName       : "openbao-chart"
      openbaoServiceUrl        : "http://openbao-chart.openbao.svc:8200"
      openbaoStorageClass      : "shared-fs"
      openbaoStorageSize       : "10Gi"
      openbaoTransitKeyName    : "pulumi"
      openbaoTransitMountPath  : "transit"
      openbaoUiServiceName     : "openbao-chart-ui"
      openbaoUiUrl             : "http://openbao-chart-ui.openbao.svc:8200"
      openbaoUrl               : "https://openbao.holdenitdown.net"

  Resources:
      + 13 to create
  ```
- **Files changed (across the stage)**:
  - `src/components/authentik-oidc-app.ts`
  - `programs/authentik/index.ts`
  - `programs/openbao/index.ts`
  - `src/adapters/stack-reference.ts`
  - `README.md`
  - `docs/operations/openbao.md`
  - `docs/operations/vault.md`
- **AGENTS.md notes applied**: no comments unless explicitly requested; followed neighboring file patterns; checked imports before using libraries; did not expose secrets; public methods retain return types; used Bun for repo commands.
- **Subagent statuses**:
  - Task 2.1: DONE
  - Task 2.2: DONE
- **Concerns recorded**: `docs/operations/vault.md` was removed as part of replacing the obsolete Vault runbook; OpenBao OIDC is enabled post-bootstrap with operator-run `bao` commands, not by reading undeployed Authentik outputs during the OpenBao preview.

- [x] Stage 2 complete

---

## Stage 3: Pulumi Migration Support

Batch execute tasks that can be run in parallel sub agents.

### Task 3.1: Switch Pulumi automation to OpenBao Transit inputs

- **Implements**: `secrets-management` ADDED Requirement: `OpenBao Secret Engines For V1`; `secrets-management` ADDED Requirement: `Pulumi Secret Delivery Boundary`
- **Depends on**: Task 2.2
- **Files**: `programs/tekton/index.ts`, `src/components/tekton.ts`, any shared Pulumi credential helper introduced for OpenBao-backed secrets-provider configuration
- **Approach**: Replace passphrase-centric Pulumi credential wiring with OpenBao Transit-oriented environment and secret handling for Pulumi's `hashivault://` provider while continuing to let Pulumi materialize Kubernetes `Secret` resources for workloads.
- **Dispatch**: subagent

### Task 3.2: Document the OpenBao workload secret handoff model

- **Implements**: `secrets-management` ADDED Requirement: `Pulumi Secret Delivery Boundary`; `secrets-management` ADDED Requirement: `OpenBao Adoption Scope Boundaries`
- **Depends on**: Task 2.2
- **Files**: `README.md`, `docs/operations/openbao.md`
- **Approach**: Document how workloads remain on Pulumi-rendered Kubernetes `Secret` resources in v1, how operators source secret values from OpenBao, how Pulumi uses the OpenBao-compatible Transit path, and which direct secret-injection approaches are intentionally deferred.
- **Dispatch**: subagent

### Stage Verification

- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/tekton preview -s pantheon --non-interactive
  ```
- **Expected outcome**: TypeScript compilation passes from the repo root, `programs/tekton` previews successfully for its existing `pantheon` stack with OpenBao-backed Pulumi credential wiring, and the operator documentation reflects the approved v1 workload handoff model.
- **Evidence artifact**: inline in this stage's Evidence block.

#### Evidence

- **Date**: 2026-05-04
- **Commands**:
  ```
  bun run typecheck
  pulumi -C programs/tekton preview -s pantheon --non-interactive
  ```
- **Output**:
  ```
  $ bun run typecheck
  $ tsc --noEmit

  $ pulumi -C programs/tekton preview -s pantheon --non-interactive
  Previewing update (pantheon):

  @ previewing update.....
      pulumi:pulumi:Stack tekton-pantheon running read pulumi:pulumi:StackReference organization/object-storage/romulus
      pulumi:pulumi:Stack tekton-pantheon running read pulumi:pulumi:StackReference organization/openbao/romulus
      pulumi:pulumi:Stack tekton-pantheon running read pulumi:pulumi:StackReference organization/openbao/romulus
      pulumi:pulumi:Stack tekton-pantheon running read pulumi:pulumi:StackReference organization/object-storage/romulus
  @ previewing update........
   -- kubernetes:core/v1:Secret tekton-pulumi-credentials delete original 
   +- kubernetes:core/v1:Secret tekton-pulumi-credentials replace [diff: ~data]
   ++ kubernetes:core/v1:Secret tekton-pulumi-credentials create replacement [diff: ~data]
   ++ kubernetes:core/v1:Secret tekton-pulumi-credentials create replacement [diff: ~data]; 
   +  kubernetes:pipelinesascode.tekton.dev/v1alpha1:Repository tekton-pac-repo-rfhold-skills create 
   +  kubernetes:pipelinesascode.tekton.dev/v1alpha1:Repository tekton-pac-repo-rfhold-skills create 
  @ previewing update.....
      pulumi:pulumi:Stack tekton-pantheon  
  Resources:
      + 1 to create
      +-1 to replace
      2 changes. 244 unchanged
  ```
- **Files changed (across the stage)**:
  - `programs/tekton/index.ts`
  - `src/components/tekton.ts`
  - `README.md`
  - `docs/operations/openbao.md`
  - `docs/specs/changes/add-vault-on-romulus/tasks.md`
- **AGENTS.md notes applied**: no comments unless explicitly requested; followed neighboring file patterns; checked imports before using libraries; did not expose secrets; public methods retain return types; used Bun for repo commands.
- **Subagent statuses**:
  - Task 3.1: DONE
  - Task 3.2: DONE
- **Concerns recorded**: the original Stage 3 verification command targeted `tekton.romulus`, but `programs/tekton` only has an existing `pantheon` stack; the plan was amended to verify the actual Tekton stack before recording evidence. Tekton runtime still needs an `OPENBAO_PULUMI_TOKEN` or `VAULT_TOKEN` value before migrated stacks can use OpenBao Transit.

- [x] Stage 3 complete

---

## Follow-ups

- Choose the exact OpenBao data storage class on `romulus` during execution after validating whether `shared-fs` or a Ceph block-backed class is the better operational fit for OpenBao data.
- Decide after code review whether the change folder should be archived under its original `add-vault-on-romulus` name or renamed before archival to reflect the OpenBao replacement.

---

## Review summary

Findings from `review-changes` validation after the OpenBao requirement revision:

- **CRITICAL**: none
- **WARNING**: None
- **SUGGESTION**: Existing change folder name still contains `vault`; this plan explicitly supersedes the old Vault work with OpenBao and records a follow-up for archive naming.

---

## Approval

- [x] User has reviewed and approved this revised OpenBao plan (written). This is the workflow's sole approval gate.

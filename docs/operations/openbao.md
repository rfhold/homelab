# OpenBao Bootstrap, Unseal, And OIDC

This runbook covers guarded first-rollout operations for OpenBao on Romulus. Tracked source does not prove deployment, initialization, unseal, engine setup, OIDC setup, policy creation, or Pulumi migration. Inspect state before every mutation.

## Use When / Do Not Use When

- Use when: an explicitly authorized operator is deploying the approved standalone service, initializing new storage once, unsealing an initialized server, configuring the approved engines and OIDC path, or migrating one approved Pulumi stack.
- Do not use when: storage may already be initialized but its recovery material is unavailable, another operator is changing OpenBao, the request adds HA, auto-unseal, PKI, dynamic credentials, public exposure, or direct pod injection, or no secure channel exists for generated secrets.

## Scope And Impact

- Systems affected: Authentik on Romulus, OpenBao namespace `openbao`, the internal edge route, Tekton credential rendering on Pantheon, and individually approved Pulumi stacks.
- Expected user impact: OpenBao-dependent automation is unavailable while sealed; a secrets-provider migration can make a stack unreadable if interrupted or misconfigured.
- Maximum intended blast radius: one OpenBao standalone instance and one explicitly selected Pulumi stack at a time.

## Preconditions And Authorization

| Requirement | Verification |
| --- | --- |
| Explicit approval for each infrastructure or OpenBao mutation | Record approver, target, and maintenance window |
| Trusted workstation with `bao`, `kubectl`, `pulumi`, and `jq` | Check tool availability without printing credentials |
| Romulus Kubernetes and Pulumi access | Verify the selected context and stack names before mutation |
| Approved offline storage for initialization output | Confirm destination and access controls before running `bao operator init` |
| Authentik-side OIDC application for OIDC setup | Verify non-secret stack outputs exist; retrieve the client secret only through an approved non-recorded channel |
| No concurrent bootstrap or migration | Confirm one operator owns the procedure |
| Recovery path for a stack migration | Store a protected pre-change stack export outside the repository |

## Safety Checks

- Never initialize storage that reports `Initialized: true`.
- Never pass unseal shares, root tokens, OIDC client secrets, or automation tokens as literal command-line arguments.
- Disable shell tracing and terminal recording before handling secrets.
- Use the initial root token only for bootstrap and recovery tasks. Do not place it in Tekton.
- Do not record `--show-secrets` output, Kubernetes Secret data, initialization JSON, or Pulumi config values.
- Stop if status is ambiguous, the expected PVC changed, or a command targets a cluster or stack other than the recorded target.

## Deployment Ordering

OpenBao source does not read Authentik outputs. Authentik owns the OIDC application; OpenBao-side auth is configured manually after initialization and unseal. Tekton reads OpenBao stack outputs, so its reconciliation comes later.

With separate approval for each deployment mutation:

```bash
pulumi -C programs/authentik preview -s romulus
pulumi -C programs/authentik up -s romulus
pulumi -C programs/openbao preview -s romulus
pulumi -C programs/openbao up -s romulus
```

Do not treat a preview as deployment evidence. After an approved update, verify Kubernetes resources and the route independently.

## Procedure

### 1. Inspect Non-Secret Surfaces

```bash
pulumi -C programs/openbao stack output -s romulus openbaoUrl
pulumi -C programs/openbao stack output -s romulus openbaoServiceUrl
pulumi -C programs/openbao stack output -s romulus openbaoOperations
pulumi -C programs/authentik stack output -s romulus openbaoOidcClientId
pulumi -C programs/authentik stack output -s romulus openbaoOidcDiscoveryUrl
pulumi -C programs/authentik stack output -s romulus openbaoOidcUiRedirectUri
pulumi -C programs/authentik stack output -s romulus openbaoOidcCliRedirectUri
kubectl --context romulus -n openbao get statefulset,services,pvc,httproute
```

Retrieve `openbaoOidcClientSecret` only when step 6 is authorized, using a mechanism that does not enter output into logs or evidence.

### 2. Determine Initialization And Seal State

From a trusted workstation, start the source-declared UI Service port-forward:

```bash
kubectl --context romulus -n openbao port-forward service/openbao-chart-ui 8200:8200
```

In a second trusted shell:

```bash
export BAO_ADDR="http://127.0.0.1:8200"
bao status -format=json
```

- If the server is initialized and unsealed, skip steps 3 and 4.
- If it is initialized and sealed, skip initialization and continue to step 4.
- If it is not initialized and initialization is approved, continue to step 3.
- If status cannot be determined, stop. Do not guess from pod readiness alone.

### 3. Initialize New Storage Once

Confirm the secure destination is outside this repository and not synchronized to an unapproved service. Then set restrictive file permissions and write initialization output directly to that destination:

```bash
umask 077
bao operator init -format=json > "<approved-secure-output-path>"
```

- Expected observation: initialization succeeds once and the secure destination contains the generated recovery or unseal material and initial root token.
- If the command reports existing initialization, stop and use the existing recovery process.
- Do not print, parse into terminal output, or attach the file to operational evidence.

### 4. Unseal Interactively

Use distinct required shares from approved custodians. Let `bao` prompt for each share rather than placing it in the command:

```bash
bao operator unseal
bao status
```

Repeat `bao operator unseal` with the required distinct shares until status reports unsealed. Do not assume a fixed threshold from this runbook.

For bootstrap only, authenticate through the interactive token prompt:

```bash
bao login
```

### 5. Enable The Approved Engines

Read the configured names rather than hard-coding them:

```bash
KV_MOUNT="$(pulumi -C programs/openbao stack output -s romulus openbaoKvMountPath)"
TRANSIT_MOUNT="$(pulumi -C programs/openbao stack output -s romulus openbaoTransitMountPath)"
TRANSIT_KEY="$(pulumi -C programs/openbao stack output -s romulus openbaoTransitKeyName)"
bao secrets list -format=json
```

Enable only missing engines. Do not rerun an enable command against an existing mount:

```bash
bao secrets enable -path="$KV_MOUNT" kv-v2
bao secrets enable -path="$TRANSIT_MOUNT" transit
bao write -f "$TRANSIT_MOUNT/keys/$TRANSIT_KEY"
bao read "$TRANSIT_MOUNT/keys/$TRANSIT_KEY"
```

- Expected observation: KV v2 and Transit are mounted at the configured paths, and Transit returns key metadata without exporting key material.
- Stop before enabling any additional engine.

### 6. Configure Authentik OIDC

Load non-secret outputs:

```bash
OIDC_MOUNT="$(pulumi -C programs/openbao stack output -s romulus openbaoOidcMountPath)"
OIDC_ROLE="$(pulumi -C programs/openbao stack output -s romulus openbaoOidcDefaultRole)"
OIDC_CLIENT_ID="$(pulumi -C programs/authentik stack output -s romulus openbaoOidcClientId)"
OIDC_DISCOVERY_URL="$(pulumi -C programs/authentik stack output -s romulus openbaoOidcDiscoveryUrl)"
OIDC_UI_REDIRECT="$(pulumi -C programs/authentik stack output -s romulus openbaoOidcUiRedirectUri)"
OIDC_CLI_REDIRECT="$(pulumi -C programs/authentik stack output -s romulus openbaoOidcCliRedirectUri)"
bao auth list -format=json
```

Enable the method only if `auth/$OIDC_MOUNT/` is absent:

```bash
bao auth enable -path="$OIDC_MOUNT" oidc
```

Disable tracing, read the client secret without echo, and stream JSON to `bao` so the value is not a literal argument:

```bash
set +x
read -r -s -p "OIDC client secret: " OIDC_CLIENT_SECRET
printf '\n'
jq -n \
  --arg discovery "$OIDC_DISCOVERY_URL" \
  --arg client_id "$OIDC_CLIENT_ID" \
  --arg client_secret "$OIDC_CLIENT_SECRET" \
  --arg role "$OIDC_ROLE" \
  '{oidc_discovery_url:$discovery,oidc_client_id:$client_id,oidc_client_secret:$client_secret,default_role:$role}' \
  | bao write "auth/$OIDC_MOUNT/config" -
unset OIDC_CLIENT_SECRET
```

Create the login role with both strict redirects:

```bash
jq -n \
  --arg ui "$OIDC_UI_REDIRECT" \
  --arg cli "$OIDC_CLI_REDIRECT" \
  '{role_type:"oidc",user_claim:"sub",allowed_redirect_uris:[$ui,$cli],policies:["default"]}' \
  | bao write "auth/$OIDC_MOUNT/role/$OIDC_ROLE" -
```

Tracked source does not define a broader operator authorization policy. The role above proves the authentication path only. Create or attach additional least-privilege policies only through a separately reviewed authorization decision.

Verify CLI login without a root token:

```bash
bao login -method=oidc -path="$OIDC_MOUNT" role="$OIDC_ROLE"
```

Verify the UI through `https://openbao.holdenitdown.net` only from an intended internal path.

### 7. Gate Tekton Credential Reconciliation

Before an approved Tekton preview or update, verify all prerequisites without printing values:

```bash
test -n "${OPENBAO_PULUMI_TOKEN:-${VAULT_TOKEN:-}}"
test -n "${PULUMI_BACKEND_URL:-}"
test -n "${KUBECONFIG:-}" || test -f "$HOME/.kube/config"
```

Required conditions:

- OpenBao is initialized and unsealed.
- Transit and the configured key exist.
- `OPENBAO_PULUMI_TOKEN`, or the `VAULT_TOKEN` compatibility fallback, is a non-root least-privilege token for the approved Transit operations.
- `PULUMI_BACKEND_URL` names the approved backend.
- The Romulus OpenBao and object-storage stack outputs are readable.
- The local kubeconfig contains the Romulus and Pantheon contexts read by the Tekton program.
- `AUTHENTIK_URL` and `AUTHENTIK_TOKEN` are non-empty when pipelines requiring Authentik mutation are in scope.

Source uses empty-string fallbacks, so a successful TypeScript evaluation is not sufficient evidence. Stop before applying a `pulumi-credentials` or `authentik-credentials` Secret with missing inputs.

### 8. Migrate One Pulumi Stack

No repository-wide migration is established. For one explicitly approved stack:

1. Confirm OpenBao and Transit prerequisites from step 7.
2. Export the selected stack to an approved protected location outside the repository.
3. Set `VAULT_ADDR` to the verified OpenBao URL and `VAULT_TOKEN` to the least-privilege automation token without printing either value.
4. Change only the selected stack's provider.
5. Verify the stack can read its encrypted configuration before proceeding to another stack.

```bash
pulumi -C "<program-directory>" stack export -s "<stack-name>" > "<approved-secure-backup-path>"
export VAULT_ADDR="$(pulumi -C programs/openbao stack output -s romulus openbaoUrl)"
AUTOMATION_TOKEN="${OPENBAO_PULUMI_TOKEN:-${VAULT_TOKEN:-}}"
test -n "$AUTOMATION_TOKEN"
export VAULT_TOKEN="$AUTOMATION_TOKEN"
pulumi -C "<program-directory>" stack change-secrets-provider -s "<stack-name>" "hashivault://$TRANSIT_MOUNT/keys/$TRANSIT_KEY"
```

Treat the protected export as sensitive operational data. Do not add it to the repository. A stack is not migrated until its provider and configuration access are independently verified.

## Verification

| Check | Expected observation |
| --- | --- |
| OpenBao status | Initialized and unsealed without exposing recovery material |
| Approved engines | KV v2 and Transit exist only at the configured paths |
| Transit key | Key metadata is readable at the configured path |
| OIDC CLI and UI | Authentik-backed login succeeds without the root token |
| Authorization | OIDC and automation identities have only reviewed policies |
| Tekton inputs | Required token, backend, stack outputs, and contexts are non-empty before apply |
| Selected Pulumi stack | The actual provider is `hashivault://` and encrypted config remains readable |
| Scope | No HA, auto-unseal, PKI, dynamic credentials, or direct pod injection was introduced |

## Stop Conditions And Escalation

- Stop if initialization status is ambiguous, recovery material is unavailable, an unexpected mount or auth method exists, or a secret reaches output.
- Stop a migration if the protected export fails, the Transit key is unavailable, or the stack cannot read configuration immediately after the change.
- Escalate with sanitized status, resource names, timestamps, and command exit outcomes only.

## Rollback Or Recovery

- Initialization and generated recovery material are not undone by deleting Kubernetes resources. Preserve the PVC and escalate rather than reinitializing.
- If OIDC configuration fails, retain root-token access only for authorized repair and remove the root token from the workstation afterward.
- If a stack migration fails, stop all further migrations and use the protected pre-change export and the previously verified provider under a separately approved recovery action.
- Do not replace a missing automation token with the initial root token.

## Cleanup

```bash
unset BAO_ADDR OIDC_MOUNT OIDC_ROLE OIDC_CLIENT_ID OIDC_DISCOVERY_URL OIDC_UI_REDIRECT OIDC_CLI_REDIRECT
unset BAO_TOKEN KV_MOUNT TRANSIT_MOUNT TRANSIT_KEY VAULT_ADDR VAULT_TOKEN OPENBAO_PULUMI_TOKEN AUTOMATION_TOKEN
```

Stop the port-forward, remove protected temporary material according to its retention policy, and confirm shell history and evidence contain no secret values.

## Evidence To Record

- Approval, operator, target, and timestamps
- Initialization and seal booleans only
- Configured mount, auth, role, and policy names
- OIDC login success or sanitized failure
- Selected stack and before/after provider identifiers
- Verification outcomes and rollback decision

## References

- [OpenBao contract](../secrets-management/spec/openbao.md)
- [Secret delivery contract](../secrets-management/spec/secret-delivery.md)
- [Unresolved adoption state](../secrets-management/verification.md)
- [`programs/openbao/index.ts`](../../programs/openbao/index.ts)
- [`src/components/openbao.ts`](../../src/components/openbao.ts)
- [`programs/authentik/index.ts`](../../programs/authentik/index.ts)
- [`programs/tekton/index.ts`](../../programs/tekton/index.ts)

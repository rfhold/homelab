# OpenBao Operations

## Purpose

This runbook covers the Pantheon OpenBao service. It does not define snapshot, backup, restoration, or disaster-recovery procedures. Tracked source and previews do not prove a live operation succeeded; inspect state before every mutation.

## Use When / Do Not Use When

- Use when an explicitly authorized operator inspects or operates Pantheon OpenBao.
- Do not use when storage status is ambiguous, recovery material is unavailable, another operator is changing OpenBao, or the exact target and action are not approved.
- Do not use for OpenBao snapshots, backup storage, restoration, a Romulus DR deployment, auto-unseal, public exposure, PKI, dynamic credentials, workload migration, or direct pod injection.

## Scope And Impact

- System affected: Pantheon OpenBao at `openbao.holdenitdown.net`.
- Expected user impact: OpenBao is unavailable until one initialized voter is unsealed; a three-voter cluster remains available with one failed voter but loses quorum with two failed voters.
- Maximum intended blast radius: the exact Pantheon stack, API path, or voter named in the approval.
- Availability boundary: Raft and Ceph-backed volumes provide HA, not backup or restoration.

## Preconditions And Authorization

| Requirement | Verification |
| --- | --- |
| Separate explicit approval for each preview and apply | Record the exact `openbao/pantheon` action; preview approval never authorizes apply |
| Separate explicit approval for every OpenBao API mutation | Record the exact mount, key, policy, role, or bootstrap action |
| Explicit approval for failover mutation | Record approver, Pantheon target, and maintenance window |
| Trusted workstation with `bao`, `kubectl`, `pulumi`, and `jq` | Check tool availability without printing credentials |
| Explicit target for every command | OpenBao, Kubernetes, and Pulumi commands name Pantheon and `openbao/pantheon` |
| Approved secure storage for initialization output | Confirm destination, restrictive permissions, and five-share custody before initialization |
| Three Ready, schedulable Pantheon nodes and healthy `database` storage | Inspect node readiness, taints, StorageClass, and Ceph health through approved read-only paths |
| No concurrent OpenBao operation | Confirm one operator owns the procedure |
| Intended OIDC user belongs to `cyber` | Verify membership through an approved Authentik administrative path before login testing |
| Vault-compatible provider runtime | Set `VAULT_ADDR` to the canonical HTTPS URL and provide a non-empty `VAULT_TOKEN` in the trusted process environment without printing either value |

## Safety Checks

- Never initialize a voter that reports `Initialized: true` or initialize more than one voter in the same Raft cluster.
- Never pass unseal shares, root tokens, OIDC client secrets, or Transit tokens as literal command-line arguments.
- Disable shell tracing and terminal recording before handling secrets.
- Use the initial root token only for bootstrap and authorized repair. Do not place it in Kubernetes, Tekton, shell history, or repository files.
- Never put `VAULT_TOKEN` in Pulumi configuration or outputs.
- Never persist a Kubernetes reviewer JWT or CI login token in Pulumi configuration, state inputs, outputs, Kubernetes Secrets, logs, or evidence.
- Treat `openbao-pulumi-admin` as a broad administrator identity that can persist or expand privilege through allowed configuration. Its explicit denies and a 30-minute human or CI token do not make an untrusted user or pipeline safe.
- Treat the cached `ssh` sign token as a credential valid for a fixed eight hours. Revoke it when the helper no longer needs it; each SSH certificate it signs remains limited to 15 minutes.
- Never print or export the OIDC signing private key, Authentik key data, canary secret, or Pulumi secret configuration.
- Stop if the selected Kubernetes context is not Pantheon, status is ambiguous, voters share a node, or an ordinary Pantheon command would target Romulus.
- The Gateway backend and API listener use HTTP. OpenBao's separate Raft cluster channel uses built-in mutual TLS. Do not describe Gateway TLS termination as end-to-end API TLS.
- Do not claim backup or DR readiness. No supported OpenBao snapshot or restore path exists.

## Deployment Ordering

Each command that contacts a Pulumi backend, provider, or cluster requires explicit authorization. Preview approval does not authorize apply.

```bash
pulumi -C programs/openbao preview -s pantheon
pulumi -C programs/openbao up -s pantheon
```

The Pantheon program owns its Authentik relying-party resources and uses separate Authentik and Vault-compatible providers. The Vault-compatible provider targets `https://openbao.holdenitdown.net` and authenticates from runtime `VAULT_TOKEN`. These providers do not authorize any Romulus operation. Do not run `openbao/romulus` or `authentik/romulus` as part of Pantheon reconciliation, and never apply or target `authentik/romulus` to clean up its stale masked OIDC outputs.

For Kubernetes CI administration, `openbao/pantheon` owns the auth backend, in-cluster configuration, and broad administrator policy. It exports the canonical address, enabled state, mount path, and policy name. `tekton/pantheon` owns the `pipelines-as-code` ServiceAccount and OpenBao role attachment. Reconcile OpenBao first and Tekton second; never reverse this order or treat one stack's success as proof that the other was applied.

The StatefulSet intentionally skips Pulumi's readiness wait because uninitialized and sealed OpenBao pods are not Ready. A successful update proves resource reconciliation only.

## Procedure

### 1. Inspect Non-Secret Surfaces

```bash
pulumi -C programs/openbao stack output -s pantheon openbaoTopology
pulumi -C programs/openbao stack output -s pantheon openbaoOperations
kubectl --context pantheon -n openbao get statefulset,service,pvc,poddisruptionbudget,httproute
kubectl --context pantheon -n openbao get pod -o wide
```

Expected observations:

- The StatefulSet requests three replicas.
- Every voter is on a distinct Kubernetes node.
- Every claim is `10Gi`, `ReadWriteOnce`, and uses `database`.
- The active-only UI Service selects only the leader.
- The route is accepted by the intended HTTPS Gateway listener.

### 2. Determine Ordinal-Zero State

Start a pod-specific port-forward from a trusted workstation:

```bash
kubectl --context pantheon -n openbao port-forward pod/openbao-chart-0 8200:8200
```

In a second trusted shell:

```bash
export BAO_ADDR="http://127.0.0.1:8200"
bao status -format=json
```

- If `Initialized` is `false` and bootstrap is approved, continue to initialization.
- If `Initialized` is `true`, do not initialize. Continue only under an approved unseal or repair action.
- If status cannot be determined, stop.

### 3. Initialize The Raft Cluster Once

Confirm the secure destination is outside the repository and not synchronized to an unapproved service:

```bash
set +x
umask 077
bao operator init -key-shares=5 -key-threshold=3 -format=json > "<approved-secure-output-path>"
```

Do not print, parse into terminal output, or attach initialization output to evidence. Transfer shares to approved independent custody before continuing.

### 4. Unseal And Join Voters

Use three distinct shares and let `bao` prompt for each share:

```bash
bao operator unseal
bao operator unseal
bao operator unseal
```

Join and unseal each follower before proceeding to the next:

```bash
kubectl --context pantheon -n openbao exec -it openbao-chart-1 -- \
  bao operator raft join "http://openbao-chart-0.openbao-chart-internal.openbao.svc:8200"
kubectl --context pantheon -n openbao exec -it openbao-chart-1 -- bao operator unseal
kubectl --context pantheon -n openbao exec -it openbao-chart-1 -- bao operator unseal
kubectl --context pantheon -n openbao exec -it openbao-chart-1 -- bao operator unseal

kubectl --context pantheon -n openbao exec -it openbao-chart-2 -- \
  bao operator raft join "http://openbao-chart-0.openbao-chart-internal.openbao.svc:8200"
kubectl --context pantheon -n openbao exec -it openbao-chart-2 -- bao operator unseal
kubectl --context pantheon -n openbao exec -it openbao-chart-2 -- bao operator unseal
kubectl --context pantheon -n openbao exec -it openbao-chart-2 -- bao operator unseal
```

If a voter reports that it is already joined, stop and inspect status rather than retrying blindly.

```bash
bao operator raft list-peers
kubectl --context pantheon -n openbao get pod -o wide
kubectl --context pantheon -n openbao get endpointslice -l kubernetes.io/service-name=openbao-chart-ui
```

### 5. Verify Controlled Leader Failover

Run only with explicit failover-test approval and all three voters healthy. Use the canonical route so the test covers the Gateway and active-only Service:

```bash
export BAO_ADDR="https://openbao.holdenitdown.net"
bao login
bao operator raft list-peers
bao operator step-down

for attempt in $(seq 1 12); do
  if bao status >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 12 ]; then
    exit 1
  fi
  sleep 5
done

bao status
bao operator raft list-peers
```

Stop if leadership or route availability does not converge within one minute or any voter becomes unavailable.

### 6. Verify Authentik OIDC

The `openbao/pantheon` stack owns the OpenBao Authentik application, strict UI and CLI redirects, `cyber` policy binding, dedicated RSA-4096 signing key, OpenBao `oidc` backend, unchanged default-only `operator` role, and non-default human `admin` and `ssh` roles. It does not own or mutate the `cyber` group. It declares only the exact SSH signing policy; the `homelab-ssh-client` mount and `homelab` signing role remain consumer-owned.

Verify required runtime values without displaying them:

```bash
test "${VAULT_ADDR:-}" = "https://openbao.holdenitdown.net"
test -n "${VAULT_TOKEN:-}" && test -n "$(printf '%s' "$VAULT_TOKEN" | tr -d '[:space:]')"
```

Before first reconciliation or adoption, obtain separate authorization for API inventory. Do not assume Pulumi adopts existing objects automatically:

```bash
bao auth list -format=json
bao read auth/oidc/role/operator
bao read auth/oidc/role/admin
bao read auth/oidc/role/ssh
bao policy read openbao-pulumi-admin
bao policy read homelab-ssh-client-sign
```

Reject replacement, deletion, broader policy, client-secret rotation, unrelated operations, or private-key exposure. Any client-secret rotation must atomically increment `openbao:oidc-client-secret-version`.

After separate authorization for login tests:

```bash
bao login -method=oidc -path=oidc role=operator
bao login -method=oidc -path=oidc role=admin
bao login -method=oidc -path=oidc role=ssh
```

Test a `cyber` member's UI and CLI `operator` login and a non-member denial separately. The `default` policy proves authentication only. Test `admin` through both UI and CLI and confirm a service token with only `openbao-pulumi-admin`, no `default`, and TTL, maximum TTL, and explicit maximum TTL no greater than 1800 seconds. Test `ssh` through CLI and confirm a service token with only `homelab-ssh-client-sign`, no `default`, and TTL, maximum TTL, and explicit maximum TTL exactly 28800 seconds. Confirm the policy grants only `update` on `homelab-ssh-client/sign/homelab`, `read` on `auth/token/lookup-self`, and `update` on `auth/token/revoke-self`, with no capability on adjacent SSH, token-administration, or unrelated paths. Confirm certificates remain limited to 15 minutes. Capability inspection does not authorize signing or any other mutation. An authorized apply updated exactly the policy and `ssh` role in place, with 37 resources unchanged and no replacement or deletion; sanitized live readback of this eight-hour cached-token delta remains pending.

The `admin` role is intentionally broad. Its explicit denies block the documented root-control and Raft paths but do not prevent a holder from using allowed configuration APIs to persist or expand privilege beyond the token lifetime.

### 7. Verify Transit And The Canary Boundary

The retained Transit contract consists of mount `transit`, key `pulumi`, policy `pulumi-transit`, and CLI OIDC role `cyber`. Authorized inspection must confirm the key remains non-exportable and non-deletable and that policy access is limited to encrypt and decrypt updates for that key.

The `openbao-secrets-canary/canary` stack owns no provider-managed infrastructure. A separately authorized no-change preview may verify the Pantheon `hashivault://pulumi` provider path, but must not display the canary secret. The canary is not a backup or restoration test.

### 8. Bootstrap And Canary Kubernetes CI Administration

The backend, configuration, TokenReview delegation, and broad policy owned by the [OpenBao program](../../programs/openbao/index.ts) were applied on 2026-08-16. The ServiceAccount and role attachment owned by the [Tekton program](../../programs/tekton/index.ts) were applied and canaried on 2026-08-17. Do not run any command in this section without separate approval for its exact read, preview, apply, TokenRequest, OpenBao login, or capability check. The first reconciliation of any provider-managed OpenBao resource requires an already-authorized privileged runtime `VAULT_TOKEN`; Kubernetes auth cannot bootstrap itself.

Before preview, use separately authorized read-only inventory to establish whether the exact mount, config, policy, and role already exist. Stop for any existing unmanaged object and use checkpoint-backed import only after separate approval:

```bash
bao auth list -format=json
bao read auth/kubernetes/config
bao policy read openbao-pulumi-admin
bao read auth/kubernetes/role/openbao-pulumi-admin-v1
kubectl --context pantheon -n pipelines-as-code get serviceaccount openbao-pulumi-admin-v1
```

Confirm each preview contains only reviewed Pantheon changes. Preview does not authorize apply. Each apply requires a separate explicit gate, and any bootstrap token must remain only in the trusted process environment. Reconcile OpenBao first so its backend, configuration, policy, and output contract exist; only then reconcile Tekton's identity and role attachment:

```bash
test "${VAULT_ADDR:-}" = "https://openbao.holdenitdown.net"
test -n "${VAULT_TOKEN:-}" && test -n "$(printf '%s' "$VAULT_TOKEN" | tr -d '[:space:]')"
pulumi -C programs/openbao preview -s pantheon
pulumi -C programs/openbao up -s pantheon
pulumi -C programs/tekton preview -s pantheon
pulumi -C programs/tekton up -s pantheon
```

The OpenBao change must contain no `pipelines-as-code` ServiceAccount or Tekton role. The Tekton change must own ServiceAccount `openbao-pulumi-admin-v1` and role `openbao-pulumi-admin-v1` without changing the backend, configuration, or policy. Reject a preview or apply that creates a static ServiceAccount token Secret, stores a reviewer JWT, changes an unrelated auth method or policy, replaces OpenBao, or includes an unreviewed resource. After an authorized apply, inspect only non-secret settings and confirm `auth/kubernetes/config` omits reviewer JWT material.

The administrator policy denies root-control paths, the `sys/storage/raft` prefix, every `sys/storage/raft/*` API, and `sys/step-down`. It also denies exact and descendant paths for both `sys/rekey` and `sys/rekey-recovery-key`. The role cannot manage Raft membership, snapshots, bootstrap, restore, promote or demote operations, join operations, or autopilot and configuration.

The authorized 2026-08-16 OpenBao preview was create-only: the chart authDelegator ClusterRoleBinding, `auth/kubernetes` backend and configuration, and `openbao-pulumi-admin` policy. It contained no deletion, replacement, or Tekton identity. The apply succeeded with four resources created, two logical component updates, and 30 unchanged resources. Sanitized live reads confirmed initialized, unsealed, active OpenBao `2.5.3`; the Kubernetes backend; in-cluster host `https://kubernetes.default.svc:443`; local CA/JWT enabled with no reviewer JWT; and the exact `system:auth-delegator` binding. A subsequent reviewed preview and apply updated only the policy to deny exact and descendant `sys/rekey-recovery-key` paths, with 35 resources unchanged. A live policy read confirmed both denies, and the final `pulumi preview --expect-no-changes` returned 36 unchanged resources.

On 2026-08-17, exact pre-preview inventory found neither `pipelines-as-code/openbao-pulumi-admin-v1` nor `auth/kubernetes/role/openbao-pulumi-admin-v1`. The reviewed `tekton/pantheon` preview was create-only: the stack-local Vault provider `7.11.0` targeting `https://openbao.holdenitdown.net` with `skipChildToken: true`, the ServiceAccount with `automountServiceAccountToken: false`, and the AuthBackendRole; 257 resources were unchanged, with no deletion, replacement, or unrelated change. The role selected backend `kubernetes`, exact ServiceAccount name, namespace, and audience `openbao-pulumi-admin-v1`, only policy `openbao-pulumi-admin`, no default policy, 1800-second TTL and maximum TTL, and batch tokens. The apply completed in 15 seconds with three resources created and 257 unchanged. Exact reads confirmed the ServiceAccount and role values, and `pulumi preview --expect-no-changes` returned 260 unchanged.

Run the complete positive and negative canary only after separate authorization for each TokenRequest, login, and capability check. The guarded subshell installs cleanup traps before it creates sensitive variables or files. It removes privileged bootstrap credentials before workload authentication and supplies the short-lived token explicitly for every authenticated canary request. Do not print either token:

```bash
(
  set -eu
  set +x
  umask 077

  cleanup() {
    set +e
    if [ -n "${LOGIN_RESULT:-}" ]; then
      rm -f -- "$LOGIN_RESULT" "${LOGIN_RESULT}.lookup"
    fi
    unset CI_JWT CI_BAO_TOKEN WRONG_AUDIENCE_JWT UNBOUND_JWT LOGIN_RESULT
  }
  trap cleanup EXIT
  trap 'exit 1' HUP INT TERM

  unset VAULT_TOKEN BAO_TOKEN

  CI_JWT="$(kubectl --context pantheon -n pipelines-as-code create token openbao-pulumi-admin-v1 \
    --audience=openbao-pulumi-admin-v1 --duration=10m)"
  test -n "$CI_JWT"
  LOGIN_RESULT="$(mktemp)"
  printf '%s' "$CI_JWT" | env -u VAULT_TOKEN -u BAO_TOKEN \
    bao write -format=json auth/kubernetes/login \
    role=openbao-pulumi-admin-v1 jwt=- > "$LOGIN_RESULT"
  CI_BAO_TOKEN="$(jq -er '.auth.client_token | select(type == "string" and length > 0)' \
    "$LOGIN_RESULT")"
  test -n "$CI_BAO_TOKEN"

  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token lookup -format=json > "${LOGIN_RESULT}.lookup"
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" bao token capabilities sys/mounts
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities auth/kubernetes/config
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/raw/example
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" bao token capabilities sys/init
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" bao token capabilities sys/seal
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" bao token capabilities sys/rekey
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/rekey/init
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/rekey-recovery-key
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/rekey-recovery-key/init
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/generate-root/attempt
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" bao token capabilities sys/rotate
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/snapshot
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/snapshot-force
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/configuration
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/remove-peer
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/join
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/bootstrap/challenge
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/promote
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/demote
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/storage/raft/autopilot/configuration
  env -u VAULT_TOKEN BAO_TOKEN="$CI_BAO_TOKEN" \
    bao token capabilities sys/step-down

  WRONG_AUDIENCE_JWT="$(kubectl --context pantheon -n pipelines-as-code create token \
    openbao-pulumi-admin-v1 --audience=openbao-pulumi-admin-negative-v1 --duration=10m)"
  test -n "$WRONG_AUDIENCE_JWT"
  if printf '%s' "$WRONG_AUDIENCE_JWT" | env -u VAULT_TOKEN -u BAO_TOKEN \
    bao write auth/kubernetes/login role=openbao-pulumi-admin-v1 jwt=- \
    >/dev/null 2>&1; then
    exit 1
  fi

  UNBOUND_JWT="$(kubectl --context pantheon -n pipelines-as-code create token \
    "<approved-unbound-service-account>" --audience=openbao-pulumi-admin-v1 --duration=10m)"
  test -n "$UNBOUND_JWT"
  if printf '%s' "$UNBOUND_JWT" | env -u VAULT_TOKEN -u BAO_TOKEN \
    bao write auth/kubernetes/login role=openbao-pulumi-admin-v1 jwt=- \
    >/dev/null 2>&1; then
    exit 1
  fi
)
```

The sanitized lookup must show a non-renewable batch token, only `openbao-pulumi-admin`, and no duration or expiry beyond 1800 seconds. The first two capability checks must show broad management capabilities. Every raw-storage, initialization, seal, standard-rekey, recovery-key-rekey, root-generation, rotation, Raft, and step-down path must return `deny`. Capability inspection does not authorize a mutation. Both negative logins must fail without response bodies. Record only names, booleans, TTL/type/policy metadata, capability results, and command exit outcomes.

The guarded 2026-08-17 canary met this contract. A 10-minute projected TokenRequest authenticated successfully; sanitized lookup reported token type `batch`, `renewable: false`, TTL 1800, and policies exactly `[openbao-pulumi-admin]`. Capabilities for `sys/mounts` and `auth/kubernetes/config` were create, delete, list, patch, read, sudo, and update. Every documented raw, root-control, standard-rekey, recovery-key-rekey, rotation, Raft, and step-down path returned `deny`. Wrong-audience login was rejected, and correct-audience login from unbound existing ServiceAccount `pipelines-as-code/pac-pruner` was rejected. Tokens and JWTs were not printed, and guarded cleanup ran.

This source establishes only the platform ServiceAccount and OpenBao role attachment. Each repository PipelineRun must separately select the ServiceAccount, project a token for audience `openbao-pulumi-admin-v1`, and perform Kubernetes-auth login before it can use the policy.

### 9. Preserve The Completed Cleanup Boundary

On 2026-08-13, an authorized Pantheon cleanup apply matched its preview with two component-input updates, five obsolete snapshot-auth deletions, 30 unchanged resources, and no replacement. It deleted the snapshot Kubernetes role, Kubernetes auth configuration, snapshot policy, Kubernetes auth backend, and TokenReview ClusterRoleBinding. Transit mount/key, `pulumi-transit`, `cyber`, OIDC, route, storage, and three Running Pantheon pods remained. Do not reintroduce snapshot, backup, or DR resources through routine Pantheon operations.

The separately authorized legacy `openbao/romulus` destroy completed on 2026-08-13, deleting exactly 12 resources in 19 seconds. Read-only verification found zero managed resources in the retained empty stack record, namespace `openbao` absent on Romulus, the binding absent, and no matching StatefulSet, Service, or PVC across namespaces. The stack history and configuration record still exists and is not a deployment or recovery target.

Removing that empty record is a separate destructive action. Only after exact authorization and a fresh read-only confirmation that it still manages zero resources may an operator run `pulumi -C programs/openbao stack rm romulus`. This runbook does not authorize that command.

## Quorum-Safe Maintenance

- Confirm three healthy voters and a current leader before voluntary maintenance.
- Change one voter at a time and wait for it to return unsealed, Ready, and present in `list-peers` before touching another.
- The chart uses `OnDelete`; configuration and image changes require deliberate sequential pod deletion after an approved Pulumi update.
- A restarted voter with its original initialized PVC normally requires unseal, not another Raft join.
- A replacement voter with empty storage requires an approved join procedure. Never initialize it independently.
- The PodDisruptionBudget limits voluntary disruption only.

## Verification

| Check | Expected observation |
| --- | --- |
| Kubernetes placement | Three Ready voters on distinct nodes with `database` RWO PVCs |
| OpenBao status | Every voter is initialized and unsealed without exposing recovery material |
| Raft membership | Exactly three voters, one current leader, no unknown peers |
| Canonical route | Internal Gateway reaches only the active UI Service endpoint |
| Leader failover | Controlled step-down elects another voter without sustained service loss |
| OIDC | Authentik issues RS256 ID tokens; `operator` remains default-only; `admin` has only the broad policy and 1800-second service-token caps; tracked `ssh` uses fixed 28800-second service-token caps with exact signing, self-lookup, and self-revocation capabilities while certificates remain limited to 15 minutes; application and live readback are pending |
| Kubernetes CI administration | Exact ServiceAccount, namespace, audience, role, 1800-second non-renewable batch token, broad non-Raft policy, and complete Raft and root-control deny boundary pass positive and negative canaries |
| Transit | Mount `transit`, key `pulumi`, policy `pulumi-transit`, and role `cyber` retain their least-privilege boundary |
| Canary | A no-change preview can use Pantheon Transit without secret output or provider-managed infrastructure |
| Scope | No backup, restoration, DR, Romulus route, auto-unseal, or workload-migration claim |

## Stop Conditions And Escalation

- Stop for ambiguous initialization state, unexpected Pantheon data, fewer than three bound volumes, co-located voters, unavailable three-share quorum, or any secret reaching output.
- Stop if a Pantheon command unexpectedly targets Romulus, a voter cannot join, Raft does not show three voters, or failover does not converge.
- Escalate with sanitized status, resource names, node placement, timestamps, and command exit outcomes only.

## Cleanup

```bash
unset BAO_ADDR BAO_TOKEN VAULT_ADDR VAULT_TOKEN
```

Stop port-forwards, remove protected temporary material according to its retention policy, and confirm shell history and recorded evidence contain no secret values.

## Evidence To Record

- Approval, operator, Pantheon target, and timestamps
- Pulumi update identifier and sanitized resource summary
- Pod-to-node placement, PVC names and classes, route acceptance, and PDB state
- Initialization and seal booleans only
- Raft peer IDs, voter count, and leader transitions without tokens or shares
- OIDC mount and role names and sanitized login outcomes
- Kubernetes auth mount, role, audience, ServiceAccount, token TTL/type/policy metadata, and positive-negative outcomes without JWTs or OpenBao tokens
- Transit mount, key, policy, role, and no-change canary outcome without secret content
- Dated cleanup and legacy-retirement summaries, plus the authorization state of empty-stack-record removal

## References

- [OpenBao contract](../secrets-management/spec/openbao.md)
- [Tracked implementation](../secrets-management/implementation.md)
- [Verification state](../secrets-management/verification.md)
- [Secret delivery contract](../secrets-management/spec/secret-delivery.md)
- [`programs/openbao/index.ts`](../../programs/openbao/index.ts)
- [`programs/tekton/index.ts`](../../programs/tekton/index.ts)
- [`src/components/openbao.ts`](../../src/components/openbao.ts)
- [`src/components/authentik-oidc-app.ts`](../../src/components/authentik-oidc-app.ts)

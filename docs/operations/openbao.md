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

The `openbao/pantheon` stack owns the OpenBao Authentik application, strict UI and CLI redirects, `cyber` policy binding, dedicated RSA-4096 signing key, OpenBao `oidc` backend, and default-only `operator` role. It does not own or mutate the `cyber` group.

Verify required runtime values without displaying them:

```bash
test "${VAULT_ADDR:-}" = "https://openbao.holdenitdown.net"
test -n "${VAULT_TOKEN:-}" && test -n "$(printf '%s' "$VAULT_TOKEN" | tr -d '[:space:]')"
```

Before first reconciliation or adoption, obtain separate authorization for API inventory. Do not assume Pulumi adopts existing objects automatically:

```bash
bao auth list -format=json
bao read auth/oidc/role/operator
```

Reject replacement, deletion, broader policy, client-secret rotation, unrelated operations, or private-key exposure. Any client-secret rotation must atomically increment `openbao:oidc-client-secret-version`.

After separate authorization for login tests:

```bash
bao login -method=oidc -path=oidc role=operator
```

Test a `cyber` member's UI and CLI login and a non-member denial separately. The `default` policy proves authentication only.

### 7. Verify Transit And The Canary Boundary

The retained Transit contract consists of mount `transit`, key `pulumi`, policy `pulumi-transit`, and CLI OIDC role `cyber`. Authorized inspection must confirm the key remains non-exportable and non-deletable and that policy access is limited to encrypt and decrypt updates for that key.

The `openbao-secrets-canary/canary` stack owns no provider-managed infrastructure. A separately authorized no-change preview may verify the Pantheon `hashivault://pulumi` provider path, but must not display the canary secret. The canary is not a backup or restoration test.

### 8. Preserve The Completed Cleanup Boundary

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
| OIDC | Authentik issues RS256 ID tokens and a `cyber` member completes UI and CLI login with only OpenBao's `default` policy |
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
- Transit mount, key, policy, role, and no-change canary outcome without secret content
- Dated cleanup and legacy-retirement summaries, plus the authorization state of empty-stack-record removal

## References

- [OpenBao contract](../secrets-management/spec/openbao.md)
- [Tracked implementation](../secrets-management/implementation.md)
- [Verification state](../secrets-management/verification.md)
- [Secret delivery contract](../secrets-management/spec/secret-delivery.md)
- [`programs/openbao/index.ts`](../../programs/openbao/index.ts)
- [`src/components/openbao.ts`](../../src/components/openbao.ts)
- [`src/components/authentik-oidc-app.ts`](../../src/components/authentik-oidc-app.ts)

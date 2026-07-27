# Technitium Secondary Recovery

This is a guarded, source-backed recovery procedure for the Pantheon Technitium secondary. It does not establish current server state. Start with read-only diagnosis and perform mutations only with explicit DNS and cluster authorization.

## Use When / Do Not Use When

- Use when: `172.16.3.8` returns `NXDOMAIN` or fails while `172.16.4.8` remains authoritative, the secondary catalog is expired or failed, or the secondary cannot start because a persisted configuration file is zero bytes.
- Do not use when: the primary is unhealthy, both servers disagree in ways not isolated to the secondary, the affected zone is not Pulumi-managed, or there is no approved mutation window.

## Scope And Impact

- Systems affected: Pantheon namespace `dns`, the `dns-technitium` Deployment and PVC, and Technitium cluster metadata on both DNS nodes.
- Expected user impact: secondary DNS may remain unavailable while its single replica is stopped or rejoined.
- Maximum intended blast radius: the Pantheon secondary. Never invoke the primary cluster-delete endpoint during this procedure.

## Preconditions And Authorization

| Requirement | Verification |
| --- | --- |
| Explicit approval for DNS API and Kubernetes mutations | Record approver and maintenance window before the first mutation |
| Primary remains authoritative | Query a known managed name directly against `172.16.4.8` |
| Pantheon context is available | Run `kubectl config get-contexts pantheon` and inspect the result |
| Secondary credentials are available through an approved secret channel | Confirm access without printing the password or API token |
| No concurrent DNS or Pulumi reconciliation | Confirm the DNS stack is not being updated by another operator |
| Recovery evidence location excludes secrets | Prepare a record containing timestamps and status only |

## Safety Checks

- Never place a Technitium password or API token in shell history, tracing, screenshots, or incident evidence.
- Never print `/etc/dns/auth.config`, `/etc/dns/cluster.config`, Kubernetes Secrets, or Pulumi secret outputs.
- The PVC is `ReadWriteOnce`. Scale `deployment/dns-technitium` to zero and wait for its pod to terminate before attaching a recovery pod.
- Record the existing replica count and do not scale the Romulus primary.
- Prefer restoring the source-owned catalog and cluster contract over inventing direct configuration.
- Stop if the primary loses authoritative service at any point.

## Procedure

### 1. Classify The Failure Without Mutation

Set a known authoritative record name without embedding credentials:

```bash
export TEST_NAME="<known-managed-record>"
dig @172.16.4.8 "$TEST_NAME" A +norecurse
dig @172.16.3.8 "$TEST_NAME" A +norecurse
kubectl --context pantheon -n dns get deployment/dns-technitium
kubectl --context pantheon -n dns get pods,pvc,services
kubectl --context pantheon -n dns logs deployment/dns-technitium --tail=200
```

Use the [Technitium secondary recovery skill](../../../.agents/skills/recovering-technitium-secondary/SKILL.md) with credentials from the approved secret channel to inspect these API surfaces on both nodes:

| Read-only surface | Expected observation |
| --- | --- |
| `/api/admin/cluster/state` | Primary identifies itself; secondary is present; the secondary identifies the same cluster domain |
| `/api/zones/list` | Primary zones exist; the secondary catalog is `SecondaryCatalog` with a nonzero SOA serial, `syncFailed=false`, and `isExpired=false` |
| `/api/zones/options/get` for the catalog | Primary reports transfer mode `Allow` and the catalog TSIG key |
| `/api/dnsClient/resolve` | Each server returns the expected authoritative answer |

- If catalog transfer is refused, continue to step 2.
- If the catalog is healthy but member zones are missing, resync the secondary catalog in step 2.
- If logs report `DNS Server auth config file format is invalid` or the pod cannot start, continue to step 3.
- DANE or TLSA heartbeat errors can report the secondary as unreachable without identifying the replication fault. Use secondary catalog status and primary AXFR logs to classify replication; treat `RCODE=Refused` as transfer authorization first.
- If the failure does not fit one of these cases, stop and preserve the read-only evidence.

### 2. Restore Catalog Transfer And Resync

Mutation approval is required for this step.

The source-owned primary catalog settings are:

- Zone: `cluster-catalog.dns.holdenitdown.net`
- `zoneTransfer=Allow`
- `zoneTransferTsigKeyNames=cluster-catalog.dns.holdenitdown.net`

If primary logs report a refused AXFR because the request IP is not allowed, restore exactly those settings through `/api/zones/options/set`. Do not substitute a source-IP ACL. Then call `/api/zones/resync` for `cluster-catalog.dns.holdenitdown.net` on the secondary.

- Expected observation: the secondary catalog becomes current and missing catalog members are recreated.
- If the catalog remains expired, stop before deleting zones and inspect both server logs for TSIG, transfer, and certificate errors.

### 3. Quarantine A Zero-Byte Secondary Config

Use this step only when logs identify invalid persisted configuration and file-size inspection confirms a zero-byte `auth.config` or `cluster.config`.

Record the current replicas, then stop the secondary:

```bash
ORIGINAL_REPLICAS="$(kubectl --context pantheon -n dns get deployment/dns-technitium -o jsonpath='{.spec.replicas}')"
test "$ORIGINAL_REPLICAS" = "1"
kubectl --context pantheon -n dns scale deployment/dns-technitium --replicas=0
kubectl --context pantheon -n dns wait --for=delete pod -l app=dns-technitium --timeout=120s
```

Source expects one replica. Stop and investigate source drift if the replica check fails.

Attach the PVC to a temporary recovery pod using the repository's tracked Alpine image:

```bash
kubectl --context pantheon apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: technitium-recovery
  namespace: dns
spec:
  restartPolicy: Never
  containers:
    - name: shell
      image: docker.io/library/alpine:3.21
      command: ["/bin/sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: data
          mountPath: /mnt/dns
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: dns-technitium-data
EOF
kubectl --context pantheon -n dns wait --for=condition=Ready pod/technitium-recovery --timeout=120s
kubectl --context pantheon -n dns exec technitium-recovery -- sh -c 'for f in /mnt/dns/auth.config /mnt/dns/cluster.config; do if [ -e "$f" ]; then wc -c "$f"; else printf "%s missing\n" "$f"; fi; done'
```

Do not print file contents. Quarantine only a file confirmed to exist and be zero bytes:

```bash
kubectl --context pantheon -n dns exec technitium-recovery -- sh -c 'stamp=$(date +%Y%m%dT%H%M%S); for f in /mnt/dns/auth.config /mnt/dns/cluster.config; do if [ -e "$f" ] && [ ! -s "$f" ]; then mv "$f" "$f.quarantined-$stamp"; fi; done'
kubectl --context pantheon -n dns delete pod/technitium-recovery --wait=true
kubectl --context pantheon -n dns scale deployment/dns-technitium --replicas="$ORIGINAL_REPLICAS"
kubectl --context pantheon -n dns rollout status deployment/dns-technitium --timeout=180s
```

- If only `auth.config` was corrupt, verify API login and DNS service before any other mutation.
- If `cluster.config` was quarantined, expect the server to start outside the cluster and continue to step 4.
- If the pod still fails, stop. Do not restore a known zero-byte file.

### 4. Rejoin The Secondary

Prefer an explicitly approved replacement of the source-owned [`TechnitiumClusterSecondary`](../../../src/providers/technitium/cluster-secondary.ts) resource. If manual API recovery is authorized instead, preserve the implementation's exact order:

1. Read cluster state on the secondary and force it to leave only if it is initialized.
2. Delete a stale local `cluster-catalog.dns.holdenitdown.net` zone on the secondary only.
3. Read primary cluster state and identify the stale secondary by hostname or `172.16.3.8`.
4. Delete that secondary node entry from the primary using its returned node ID.
5. Call `/api/admin/cluster/initJoin` on the secondary with the configured primary URL, primary IP, secondary IP, and credentials from the approved secret channel.
6. Call `/api/zones/resync` for the secondary catalog.

Do not record request parameters that contain credentials. Do not call `/api/admin/cluster/primary/delete`.

## Verification

| Check | Expected observation |
| --- | --- |
| Deployment | `dns-technitium` has one ready Pantheon replica |
| Cluster state | Primary and secondary identify the expected cluster and secondary node |
| Catalog | Secondary catalog has a nonzero serial, `syncFailed=false`, and `isExpired=false` |
| Member zones | All managed primary zones appear as secondary zones on Pantheon |
| SOA serials | Primary and secondary serials converge for each managed zone |
| Resolution | Both DNS IPs return the expected authoritative answers |
| Primary safety | Romulus primary remained authoritative throughout recovery |

## Stop Conditions And Escalation

- Stop if the primary is unhealthy, authoritative answers change unexpectedly, credentials are exposed, or the affected data is not limited to the secondary.
- Stop if catalog resync would require deleting a primary zone or changing the TSIG contract.
- Escalate with timestamps, sanitized status fields, zone names, and error messages. Exclude tokens, passwords, config contents, and Secret output.

## Rollback Or Recovery

If recovery cannot complete, leave the failed secondary out of service and keep the primary authoritative. Remove the temporary pod, restore the recorded secondary replica count only when its data can mount safely, and prepare a separately approved reconciliation. Do not restore quarantined zero-byte files.

## Cleanup

```bash
kubectl --context pantheon -n dns delete pod/technitium-recovery --ignore-not-found
unset TEST_NAME ORIGINAL_REPLICAS TECHNITIUM_API_TOKEN TECHNITIUM_ADMIN_PASSWORD
```

Confirm no recovery pod remains and no terminal capture contains credentials.

## Evidence To Record

- Approval, operator, start and end timestamps
- Initial symptom and which server answered correctly
- Sanitized cluster and catalog status before and after
- Files quarantined by name and size only
- Zone and SOA verification result
- Final replica and resolution status

## References

- [DNS contract](../spec/dns.md)
- [Tracked edge implementation](../implementation.md)
- [`src/providers/technitium/catalog-zone-options.ts`](../../../src/providers/technitium/catalog-zone-options.ts)
- [`src/providers/technitium/cluster-secondary.ts`](../../../src/providers/technitium/cluster-secondary.ts)
- [Non-authoritative Technitium research](../../research/technitium-dns-server.md)

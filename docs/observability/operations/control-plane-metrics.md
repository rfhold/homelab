# Control-Plane Metrics

## Scope

This procedure covers the guarded rollout of loopback-only K3s Scheduler, Controller Manager, and Proxy metrics collection through host Alloy on Romulus and Pantheon. Grafana and Mimir remain hosted on Pantheon. This procedure does not authorize a deployment by itself.

## Preconditions

- Obtain explicit approval for the exact host list and rendered PyInfra operations.
- Confirm Scheduler, Controller Manager, and Proxy listeners remain on `127.0.0.1`.
- Confirm the monitoring destination and non-secret job labels match the [backend contract](../spec/backends.md#metrics-collection).
- Run source validation and no-change checks before contacting hosts.
- Before restarting K3s on Artemis or Mars, follow the [BuildKit maintenance procedure](../../deployment/operations/buildkit.md) to stop the pinned builder and release its node-local cache lock.
- Confirm the rendered K3s units do not invoke `k3s-killall.sh` as `ExecStopPost`; that script is a destructive manual cleanup tool, not a service stop hook.
- Do not print K3s tokens, kubeconfig contents, private keys, or Alloy environment values.

## Rollout

1. Choose one cluster and preview the K3s service change against each of its three server nodes separately.
2. Apply one server at a time. After each restart, wait for that cluster's node and control-plane workloads to become ready before proceeding.
3. Stop if etcd membership, API readiness, or workload health degrades. Do not start the second cluster until the first is verified.
4. Preview the Alloy deployment against every managed node in that cluster.
5. Apply Alloy with explicit limits for the five active hosts in that cluster, then verify metrics and listener scope before repeating the sequence for the second cluster.
6. Verify host-local listeners remain loopback-only in both clusters after the rollout.

## Verification

After collection stabilizes, verify expected target cardinality in Mimir:

```promql
count by (cluster, job, instance) (
  up{
    cluster=~"romulus|pantheon",
    job=~"integrations/kubernetes/(kube-scheduler|kube-controller-manager|kube-proxy)"
  }
)
```

Expected aggregate cardinality is six Scheduler targets, six Controller Manager targets, and 10 Proxy targets. Each cluster has three Scheduler, three Controller Manager, and five Proxy targets. Vulkan is retired and MUST NOT appear in the Pantheon inventory or target set. Verify the authenticated API Server paths separately:

```promql
count by (cluster, job) (
  up{cluster=~"romulus|pantheon",job="integrations/kubernetes/kube-apiserver"}
)
```

Use GCX to confirm the four Kubernetes control-plane dashboard variables populate and representative queries execute without errors.

## Rollback

- Stop before changing another server if readiness fails after a K3s restart.
- If a legacy unit becomes stuck while recursively invoking `k3s-killall.sh`, terminate only the stuck systemd control process, wait for the unit to finish deactivating, and start K3s normally. Do not run the cleanup script directly.
- Restore the previously rendered K3s service arguments on the affected host under a separately approved operation.
- Restore the prior Alloy configuration if a scrape block prevents Alloy from starting or remote-writing.
- Do not widen metric listeners to node addresses as an incident workaround.
- Record any partial rollout and unverified node explicitly in [`../verification.md`](../verification.md).

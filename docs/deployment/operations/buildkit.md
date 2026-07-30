# BuildKit Node Maintenance

## Scope

This procedure covers Pantheon's pinned amd64 builder on Artemis and arm64 builder on Mars. Both builders use node-local hostPath caches, so their pods cannot move to another node while retaining cache state. This procedure does not authorize a deployment, node restart, pipeline rerun, or cache deletion by itself.

## Before K3s Maintenance

1. Confirm no PipelineRun is actively using the builder.
2. Scale the affected BuildKit StatefulSet to zero and wait for its pod to be deleted.
3. Confirm no process holds the cache's `buildkitd.lock`.
4. If a lock remains held, stop and use the targeted recovery procedure below before restarting K3s.
5. Complete the authorized K3s maintenance and wait for the node and cluster API to become ready.
6. Restore one BuildKit replica and verify the worker through both loopback and its Kubernetes Service address.

## Orphan Lock Recovery

Use this procedure only when the StatefulSet is at zero but an old BuildKit daemon still holds the cache lock.

1. Identify the lock-holder PID and its complete process ancestry.
2. Verify the associated shim or runtime record belongs to the expected BuildKit pod, namespace, architecture, node, and cache path. Do not target an ID based only on process name.
3. If the old task remains registered with K3s containerd, send `SIGTERM` through `k3s ctr`. If current containerd no longer registers it, send `SIGTERM` directly to the verified BuildKit daemon PID.
4. Confirm the BuildKit daemon exited and a nonblocking flock can acquire `buildkitd.lock`. Do not delete the lock file, metadata database, snapshots, or cache directory.
5. If a detached shim remains after its BuildKit child exits, verify it is absent from current containerd task and container records before terminating that exact shim.
6. Restore one replica and wait for StatefulSet rollout completion.

## Verification

- The pod is ready with no new restarts.
- `buildctl debug workers` succeeds against `127.0.0.1:1234` from the pod.
- `buildctl debug workers` succeeds against the architecture-specific BuildKit Service.
- The worker reports the expected architecture.
- Startup logs contain no lock, metadata, snapshotter, or listener failure.
- The node-local cache remains present.

Pipeline retries are separate mutations. Inspect the failed TaskRun, obtain explicit dispatch approval, and rerun only after both required builders pass these checks.

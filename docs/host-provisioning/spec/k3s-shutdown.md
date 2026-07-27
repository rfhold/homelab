# K3s Shutdown Timing

## Per-Host Configuration

- Host inventory MUST be able to set kubelet `shutdownGracePeriod`, kubelet `shutdownGracePeriodCriticalPods`, and the K3s systemd stop timeout per node.
- The systemd stop timeout MUST exceed the kubelet shutdown grace period.
- A host that omits the setting MUST retain the repository defaults.
- Applying K3s provisioning MUST NOT reboot a host automatically.

## Artemis Canary

Artemis MUST remain the scheduling-neutral Pantheon canary with these values:

| Setting | Intended value |
| --- | --- |
| `shutdownGracePeriod` | `5m` |
| `shutdownGracePeriodCriticalPods` | `1m` |
| K3s `TimeoutStopSec` | `6min` |

Extending the canary values to other nodes requires a separate approved change.

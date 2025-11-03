---
description: Restart a Kubernetes pod and check its logs
subtask: false
---

Restart the pod for $ARGUMENTS by deleting it (kubectl delete pod) and then follow the logs for the new pod instance.

First find the pod name, delete it, wait for the new pod to start, then show the logs.

# Tekton Delivery

## Deployer RBAC

The shared Tekton deployer credentials MUST authorize deployment workflows to get, list, watch, create, update, patch, and delete both `batch/v1` Jobs and CronJobs. CronJob support MUST NOT broaden unrelated API-group permissions.

## PAC Repository Enrollment

When the Pantheon Tekton stack is rendered, its Pipelines as Code repository configuration MUST include `rfhold/kokoro`, `rfhold/whisperx`, and `rfhold/smarthome-mcp`. Enrollment does not change provider-wide webhook behavior or PAC global provider configuration.

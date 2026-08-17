# Tekton Delivery

## Deployer RBAC

The shared Tekton deployer credentials MUST authorize deployment workflows to get, list, watch, create, update, patch, and delete both `batch/v1` Jobs and CronJobs. CronJob support MUST NOT broaden unrelated API-group permissions.

The shared Tekton deployer credentials MUST authorize deployment workflows to get, list, watch, create, update, patch, and delete namespaced `cert-manager.io` Certificates. They MUST authorize only get and list access to cluster-scoped `cert-manager.io` ClusterIssuers.

## PAC Repository Enrollment

When the Pantheon Tekton stack is rendered, its Pipelines as Code repository configuration MUST include `rfhold/kokoro`, `rfhold/whisperx`, and `rfhold/smarthome-mcp`. Enrollment does not change provider-wide webhook behavior or PAC global provider configuration.

## OpenBao Administration Attachment

The Tekton OpenBao administration attachment MUST default to disabled and MUST be enabled only for `tekton/pantheon`. When enabled, Tekton MUST reference the `openbao/pantheon` stack and consume its canonical URL, Kubernetes-auth enabled state, auth mount path, and administrator policy name. Program evaluation MUST reject a disabled or incomplete producer contract and MUST require a non-empty runtime `VAULT_TOKEN` so the Vault-compatible provider cannot fall back to `~/.vault-token`.

The Tekton stack MUST own ServiceAccount `pipelines-as-code/openbao-pulumi-admin-v1` with automatic token mounting disabled and OpenBao Kubernetes auth role `openbao-pulumi-admin-v1`. The role MUST bind only that ServiceAccount, namespace, and audience `openbao-pulumi-admin-v1`, attach only the exported `openbao-pulumi-admin` policy with no automatic `default` policy, and issue non-renewable batch tokens with 1800-second TTL and maximum TTL. Tekton MUST export the enabled state, ServiceAccount identity, role name, and audience as durable consumer contracts.

The `openbao/pantheon` stack MUST be reconciled before `tekton/pantheon`. This platform source establishes only the identity and OpenBao role attachment. Each repository PipelineRun remains responsible for selecting the ServiceAccount, projecting a token for the exact audience, and logging in. Neither stack MUST create a static token Secret or persist a reviewer JWT.

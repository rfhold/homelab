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

## OpenBao Kubernetes Login StepAction

The shared `pipelines-as-code/openbao-kubernetes-login` StepAction MUST log in only to `https://openbao.holdenitdown.net/v1/auth/kubernetes/login`. Its parameters MUST be limited to the non-secret OpenBao role, the one expected policy, a maximum accepted lease of no more than 3600 seconds, and the JWT and session volume names required by StepAction admission. The volume-name parameters MUST default to `openbao-ci-jwt` and `openbao-ci-session`. It MUST accept only non-renewable batch tokens whose lease is within the requested bound and whose token policy list contains exactly the expected policy.

The StepAction MUST run in the same Task pod as the later Pulumi step. By default, the consuming Task MUST provide a projected ServiceAccount token with the repository role's exact audience as read-only volume `openbao-ci-jwt` at `/var/run/secrets/openbao-ci/jwt` and a memory-backed `emptyDir` as writable volume `openbao-ci-session` at `/var/run/secrets/openbao-ci/session`. A consumer MAY select different Task volume names through the two volume-name parameters, but the projected JWT and session storage types and all in-container mount and token paths remain fixed. The StepAction reads only `/var/run/secrets/openbao-ci/jwt/token` and atomically writes the OpenBao token to `/var/run/secrets/openbao-ci/session/token` with mode `0400`; the later step reads that fixed file from the same pod.

The JWT, login response, and issued token MUST remain in those pod-local memory-backed mounts and MUST NOT be printed or transferred through Tekton Results, a workspace, a Kubernetes Secret, or any RWX or cross-pod handoff. The StepAction MUST emit no Results. The consuming Task owns the projected audience, Task volume names, and memory `emptyDir` definitions but cannot redirect the fixed in-container credential mount or token paths.

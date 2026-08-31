# Tekton Delivery

## Deployer RBAC

The shared Tekton deployer credentials MUST authorize deployment workflows to get, list, watch, create, update, patch, and delete both `batch/v1` Jobs and CronJobs. CronJob support MUST NOT broaden unrelated API-group permissions.

The shared Tekton deployer credentials MUST authorize deployment workflows to get, list, watch, create, update, patch, and delete namespaced `cert-manager.io` Certificates. They MUST authorize only get and list access to cluster-scoped `cert-manager.io` ClusterIssuers.

## PAC Repository Enrollment

When the Pantheon Tekton stack is rendered, its Pipelines as Code repository configuration MUST include `rfhold/kokoro-server`, `rfhold/whisperx-server`, and `rfhold/smarthome-mcp`. It MUST NOT retain the replaced `rfhold/kokoro` or `rfhold/whisperx` names. Enrollment does not change provider-wide webhook behavior or PAC global provider configuration.

When the plain `tekton:kuri-android-signing-cert-sha256` configuration value is set, only the exact `rfhold/kuri` PAC `Repository` MUST receive it as `KURI_ANDROID_SIGNING_CERT_SHA256`. The global provider resource and all other repository resources MUST NOT receive this parameter.

## OpenBao Administration Attachment

The Tekton OpenBao administration attachment MUST default to disabled and MUST be enabled only for `tekton/pantheon`. When enabled, Tekton MUST reference the `openbao/pantheon` stack and consume its canonical URL, Kubernetes-auth enabled state, auth mount path, and administrator policy name. Program evaluation MUST reject a disabled or incomplete producer contract and MUST require a non-empty runtime `VAULT_TOKEN` so the Vault-compatible provider cannot fall back to `~/.vault-token`.

The Tekton stack MUST own ServiceAccount `pipelines-as-code/openbao-pulumi-admin-v1` with automatic token mounting disabled and OpenBao Kubernetes auth role `openbao-pulumi-admin-v1`. The role MUST bind only that ServiceAccount, namespace, and audience `openbao-pulumi-admin-v1`, attach only the exported `openbao-pulumi-admin` policy with no automatic `default` policy, and issue non-renewable batch tokens with 1800-second TTL and maximum TTL. Tekton MUST export the enabled state, ServiceAccount identity, role name, and audience as durable consumer contracts.

The `openbao/pantheon` stack MUST be reconciled before `tekton/pantheon`. This platform source establishes only the identity and OpenBao role attachment. Each repository PipelineRun remains responsible for selecting the ServiceAccount, projecting a token for the exact audience, and logging in. Neither stack MUST create a static token Secret or persist a reviewer JWT.

## OpenBao Kubernetes Login StepAction

The shared `pipelines-as-code/openbao-kubernetes-login` StepAction MUST log in only to `https://openbao.holdenitdown.net/v1/auth/kubernetes/login`. Its parameters MUST be limited to the non-secret OpenBao role, the one expected policy, a maximum accepted lease of no more than 3600 seconds, and the JWT and session volume names required by StepAction admission. The volume-name parameters MUST default to `openbao-ci-jwt` and `openbao-ci-session`. It MUST accept only non-renewable batch tokens whose lease is within the requested bound and whose token policy list contains exactly the expected policy.

The StepAction MUST run in the same Task pod as the later Pulumi step. By default, the consuming Task MUST provide a projected ServiceAccount token with the repository role's exact audience as read-only volume `openbao-ci-jwt` at `/var/run/secrets/openbao-ci/jwt` and a memory-backed `emptyDir` as writable volume `openbao-ci-session` at `/var/run/secrets/openbao-ci/session`. A consumer MAY select different Task volume names through the two volume-name parameters, but the projected JWT and session storage types and all in-container mount and token paths remain fixed. The StepAction reads only `/var/run/secrets/openbao-ci/jwt/token` and atomically writes the OpenBao token to `/var/run/secrets/openbao-ci/session/token` with mode `0400`; the later step reads that fixed file from the same pod.

The JWT, login response, and issued token MUST remain in those pod-local memory-backed mounts and MUST NOT be printed or transferred through Tekton Results, a workspace, a Kubernetes Secret, or any RWX or cross-pod handoff. The StepAction MUST emit no Results. The consuming Task owns the projected audience, Task volume names, and memory `emptyDir` definitions but cannot redirect the fixed in-container credential mount or token paths.

## Tauri Prerelease Build Task

The shared `pipelines-as-code/tauri-release-build` Task MUST accept source and output workspaces plus an application-relative path, SemVer version without a leading `v`, Android versionCode, version- or digest-pinned builder image, expected signing-certificate SHA-256 fingerprint, and OpenBao role, exact policy, and KV v2 signing-secret API path. The OpenBao role is also the projected ServiceAccount token audience. The signing secret MUST provide `keystore-base64`, `store-password`, `key-alias`, and `key-password` fields under the KV v2 `data.data` object.

The Task MUST invoke `openbao-kubernetes-login` by StepAction reference in the same Task pod. It MUST store the projected JWT, OpenBao token, KV response, decoded keystore, Tauri version override, and APK verification output only in pod-local memory. It MUST NOT place credentials in parameters, Results, logs, source, or output workspaces.

The Task MUST install dependencies from the application's frozen pnpm lockfile, build one Linux x86_64 AppImage and one universal release APK, align and sign the APK, verify its signature and expected certificate fingerprint, and replace the output workspace contents with only `kuri-VERSION-linux-amd64.AppImage` and `kuri-VERSION-android-universal.apk`. It MUST reject unsafe paths, malformed versions, invalid version codes, unexpected artifact counts, and signing-contract failures.

## Forgejo Release Upsert Task

The shared `pipelines-as-code/forgejo-release-upsert` Task MUST accept an input workspace, HTTPS Forgejo base URL, repository owner and name, tag, target commitish, title, workspace-relative body file, prerelease and draft booleans, up to 20 workspace-relative asset paths, and OpenBao role, exact policy, and KV v2 token-secret API path. The OpenBao role is also the projected ServiceAccount token audience. The token secret MUST provide a whitespace-free `token` field under the KV v2 `data.data` object.

The Task MUST invoke `openbao-kubernetes-login` by StepAction reference in the same Task pod and keep the projected JWT, OpenBao token, KV response, API payloads, and API responses in pod-local memory. It MUST validate path containment, regular files, body and asset bounds, duplicate asset basenames, booleans, identifiers, and HTTP response contracts. It MUST URL-encode API path and query values and MUST report failed HTTP status codes without printing response bodies.

The Task MUST get a release by tag, create it when absent, or patch it when present. For every requested asset it MUST delete all existing same-name assets before uploading the replacement. Its sole Result MUST contain the numeric release ID. The existing `forgejo-release` Task remains a separate compatibility interface for current consumers.

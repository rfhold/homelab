# Shared Release Secret Bootstrap

## Purpose

This runbook defines guarded bootstrap and rotation for the additive shared release model. It does not authorize live commands or establish deployment success.

The [legacy Kuri and ESP runbook](kuri-release-secret-bootstrap.md) remains active. This procedure preserves legacy identities, paths, outputs, firmware access, and the compatibility `android-keystore` Secret.

## Contract

| Purpose | Logical path within `kv` | Required fields | Reader |
| --- | --- | --- | --- |
| Android release | `ci/signing/android/release` | `keystore-base64`, `store-password`, `key-alias`, `key-password` | `tauri-release-build-v1` |
| Forgejo publication | `ci/forgejo/release` | `token` | `forgejo-release-v1` |

Each reader uses an exact same-named ServiceAccount, role, policy, and audience in `pipelines-as-code`. Both ServiceAccounts disable automatic token mounts. Each role suppresses `default` and issues non-renewable batch tokens with 900-second TTL and maximum TTL.

Each policy reads only its exact KV v2 data path and `auth/token/lookup-self`. The shared publisher has no ESP firmware private-key permission.

## Preconditions And Stop Conditions

1. Obtain authorization that names Pantheon, each exact path, and each permitted read or mutation.
2. Obtain separate authorization for state import, preview, apply, payload writes, token tests, or release canaries.
3. Confirm the canonical OpenBao address through the approved stack contract.
4. Confirm KV v2 mount ownership through the [mount adoption gate](kuri-release-secret-bootstrap.md#mount-adoption-gate).
5. Supply operator credentials only through the approved trusted runtime environment.
6. Disable shell tracing, terminal capture, and command audit facilities that expose standard input.
7. Select protected temporary storage with mode-`0700` directories, mode-`0600` files, and an explicit cleanup trap.
8. Confirm Android certificate identity through an independent trusted fingerprint record.
9. Confirm the Forgejo token's exact repository scope through trusted administration records.

Stop on ambiguous ownership, an unexpected current destination, an incompatible mount, or an unapproved repository scope. Stop on any proposed legacy deletion, replacement, permission change, or payload adoption into Pulumi.

This runbook supplies no Forgejo token creation automation. Obtain credentials through a separately approved operator process. Repository reads alone do not prove release-write scope.

## Platform And Public Trust Gate

1. Inventory both shared ServiceAccounts, roles, and policies under explicit read authorization.
2. If an object already exists, resolve its ownership before any preview.
3. If adoption is necessary, obtain checkpoint-backed import authorization for each exact object.
4. Review the OpenBao producer contract before the Tekton preview.
5. Reconcile OpenBao before Tekton under separate apply authorization.
6. Reject any preview that changes the legacy Kuri or ESP contracts.

Preview approval does not authorize apply. Pulumi owns the KV mount, identities, policies, and public trust resource, not secret payloads.

The optional plain `tekton:release-trusted-signers` configuration accepts only the approved public armored key. Tekton owns Secret `pipelines-as-code/release-trusted-signers` with key `signing-key.asc`. Do not place a private key, credential, ciphertext, or copied key body in this document.

Before trust activation, compare the public key fingerprint against an independent approved record. Verify the Secret name and key without terminal output of its body. This shared trust resource does not migrate legacy consumer trust.

## Guarded Copy Or Import

A copy from legacy paths requires explicit authorization for each source read and destination write. The shared model does not authorize credential reuse by itself.

1. Confirm that the approved Android certificate matches each intended shared consumer.
2. Confirm that the Forgejo token scope covers only approved shared repositories.
3. If source credentials lack the required scope, stop the copy.
4. If replacement credentials are necessary, obtain them through the separately approved operator process.
5. Read an approved source version directly into protected temporary storage without terminal output.
6. Extract only the required fields from the KV v2 `data.data` object.
7. Validate field names, field types, and non-empty values without output of values.
8. For Android material, decode the keystore only within protected temporary storage.
9. Compare its certificate SHA-256 fingerprint with the independent approved fingerprint.
10. For a Forgejo token, reject whitespace and verify scope through trusted administration records.
11. Write the validated payload to only the approved shared destination through protected file input or standard input.
12. Suppress payload output from every read, transformation, write, and validation command.
13. Read back the approved destination directly into protected storage under separate read authorization.
14. Compare the field set and approved source values without output of either payload.
15. Record only the destination path, KV version, approved fingerprint, and sanitized validation status.
16. Remove temporary files through the cleanup trap.
17. Clear credentials from the process environment after the operation.

Do not put secrets in command arguments, shell history, Tekton Results, workspaces, Pulumi configuration, checkpoints, or evidence. Do not delete or overwrite a legacy source during shared bootstrap.

An operator can import independently approved material instead of a legacy copy. The same field validation, destination checks, protected input, readback, and cleanup requirements apply.

## Repository Fingerprints And Artifacts

The optional plain `tekton:android-signing-cert-sha256-by-repository` map uses exact enrolled repository names. Each matching PAC `Repository` receives its fingerprint as `ANDROID_SIGNING_CERT_SHA256`. The global provider and unrelated repositories receive none.

1. Confirm each map key matches an enrolled repository exactly.
2. Compare each fingerprint with that repository's independent approved certificate record.
3. Verify the rendered repository parameter without credential output.
4. Verify that unrelated repositories and the global provider lack this parameter.
5. Preserve the legacy Kuri configuration and `KURI_ANDROID_SIGNING_CERT_SHA256` parameter.

The shared `tauri-release-build` Task retains explicit OpenBao role, policy, and secret-path parameters. Its `artifact-prefix` defaults to `kuri` for compatibility and accepts only a portable lowercase slug. Waltr consumers explicitly pass `waltr`.

## Identity Verification Without Secret Output

Obtain separate authorization for each TokenRequest, login, capability test, and payload read. Keep JWTs, login responses, and OpenBao tokens in private temporary storage. Do not print them.

For each role, verify exact ServiceAccount, namespace, audience, policy, batch token type, and `renewable: false`. Confirm that the lease does not exceed 900 seconds. Confirm that no `default` or unexpected identity policy expands access.

| Identity | Shared Android API path | Shared Forgejo API path | Legacy Kuri data paths | ESP firmware API path | Self lookup |
| --- | --- | --- | --- | --- | --- |
| `tauri-release-build-v1` | `read` | `deny` | `deny` | `deny` | `read` |
| `forgejo-release-v1` | `deny` | `read` | `deny` | `deny` | `read` |

The shared API paths equal `kv/data/ci/signing/android/release` and `kv/data/ci/forgejo/release`. The ESP API path equals `kv/data/ci/esp-wifi-cam/firmware-signing`.

Verify that adjacent paths, KV metadata, writes, deletes, renewal, and revocation report `deny`. Verify that wrong-ServiceAccount, wrong-namespace, and wrong-audience logins fail. Capability tests do not authorize payload reads or writes.

## Rotation And Recovery

1. Obtain authorization for the exact destination and replacement credential.
2. Validate the replacement identity or repository scope before the write.
3. Import the replacement as a new KV version through the guarded procedure.
4. Complete separately authorized signature or publication canaries before credential retirement.
5. Confirm that legacy consumers remain unaffected before any external token revocation.

If validation fails, stop affected shared release work. Obtain explicit authorization before a rollback to a named prior KV version. Preserve prior versions during routine rotation.

A rollback cannot revoke an external credential or restore a compromised key's trust. If a shared credential also serves legacy consumers, its revocation affects both groups. Credential separation or legacy migration requires a separate approved change.

## Evidence And Verification Limits

Record approvals, timestamps, operator identity, exact resource identities, repository scopes, KV version numbers, fingerprints, and sanitized outcomes. Never record payloads, ciphertext, keys, JWTs, tokens, or secret-bearing output.

This document records the approved procedure and source contract only. It does not establish that an apply, copy, import, login, negative test, or release canary succeeded.

## References

- [Tekton release contract](../deployment/spec/tekton.md)
- [OpenBao identity contract](../secrets-management/spec/openbao.md)
- [Secret delivery contract](../secrets-management/spec/secret-delivery.md)
- [Tracked secrets implementation](../secrets-management/implementation.md)
- [Legacy Kuri and ESP bootstrap](kuri-release-secret-bootstrap.md)

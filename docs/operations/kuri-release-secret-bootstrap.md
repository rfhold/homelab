# Kuri Release Secret Bootstrap

## Purpose

This runbook imports and rotates Kuri release secrets in Pantheon OpenBao. It does not authorize any live command.

## Use When / Do Not Use When

- Use only after explicit authorization names the Pantheon target, exact secret path, and exact mutation.
- Use from a trusted workstation with shell tracing and terminal capture disabled.
- Do not use if KV mount ownership, Android certificate fingerprint, Forgejo repository scope, or operator identity remains ambiguous.
- Do not use this procedure to change Tekton Tasks, the compatibility `android-keystore` Secret, or unrelated OpenBao data.

## Contract

| Purpose | Logical path | Required fields |
| --- | --- | --- |
| Android signing | `ci/kuri/android-signing` | `keystore-base64`, `store-password`, `key-alias`, `key-password` |
| Forgejo publication | `ci/kuri/forgejo-release` | `token` |

The build policy reads only `kv/data/ci/kuri/android-signing`. The publication policy reads only `kv/data/ci/kuri/forgejo-release`. Pulumi owns mount `kv`, but no Pulumi resource owns either payload.

## Preconditions

1. Obtain explicit live authorization for each inventory read, import, preview, apply, payload write, token test, rotation, or rollback.
2. Confirm `VAULT_ADDR` names `https://openbao.holdenitdown.net`.
3. Supply a privileged `VAULT_TOKEN` through the trusted process environment.
4. Confirm the approved Android SHA-256 certificate fingerprint through an independent trusted record.
5. Create a Forgejo token restricted to repository `rfhold/kuri` and only required release publication operations.
6. Confirm no shell tracing, terminal recording, or command auditing captures standard input.

```bash
set +x
test "${VAULT_ADDR:-}" = "https://openbao.holdenitdown.net"
test -n "${VAULT_TOKEN:-}" && test -n "$(printf '%s' "$VAULT_TOKEN" | tr -d '[:space:]')"
```

## Mount Adoption Gate

Run these commands only under authorization for their exact read-only live queries:

```bash
bao secrets list -detailed -format=json | jq -e '."kv/" | .type == "kv" and .options.version == "2"'
pulumi -C programs/openbao stack output -s pantheon openbaoKvMountPath
```

Stop unless the live path equals `kv/`, the type equals `kv`, and version equals `2`. Stop if another stack or operator owns the mount.

If the compatible mount already exists outside Pulumi state, obtain separate state-mutation authorization. Import that exact object before any preview:

```bash
pulumi -C programs/openbao import -s pantheon vault:index/mount:Mount openbao-kv kv
```

Do not run the import for an absent mount or an object already in this stack. Do not preview an unmanaged current mount as a proposed create. Reject any replacement, deletion, version change, or payload resource.

After import or for an absent mount, use separate authorization for each OpenBao command:

```bash
pulumi -C programs/openbao preview -s pantheon
pulumi -C programs/openbao up -s pantheon
```

Preview authorization never authorizes apply.

Before the Tekton preview, inventory each exact task identity under separate read authorization:

```bash
bao policy read kuri-tauri-build-v1
bao policy read kuri-forgejo-release-v1
bao read auth/kubernetes/role/kuri-tauri-build-v1
bao read auth/kubernetes/role/kuri-forgejo-release-v1
kubectl --context pantheon -n pipelines-as-code get serviceaccount kuri-tauri-build-v1
kubectl --context pantheon -n pipelines-as-code get serviceaccount kuri-forgejo-release-v1
```

The first deployment expects all six objects to be absent. Stop if any object exists. Resolve ownership and adoption under separate authorization before preview.

After OpenBao reconciles and identity inventory passes, use separate authorization for each Tekton command:

```bash
pulumi -C programs/tekton preview -s pantheon
pulumi -C programs/tekton up -s pantheon
```

OpenBao must reconcile before Tekton. Preview authorization never authorizes apply.

## Verify Android Material

Set only non-secret path and alias values in the shell. Let `keytool` prompt for the keystore password:

```bash
KEYSTORE_FILE="<approved-local-keystore-path>"
KEY_ALIAS="<approved-key-alias>"
keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS"
```

Compare the displayed SHA-256 certificate fingerprint with the independent approved fingerprint. Stop on any mismatch. Do not infer identity from the alias or filename.

## Import Android Material

This guarded subshell puts secret values in a mode-`0700` temporary directory. It sends only a protected JSON file to `bao`.

```bash
(
  set -eu
  set +x
  umask 077
  WORK_DIR="$(mktemp -d)"
  cleanup() {
    set +e
    rm -rf -- "$WORK_DIR"
    unset KEYSTORE_PASSWORD KEY_PASSWORD
  }
  trap cleanup EXIT
  trap 'exit 1' HUP INT TERM

  base64 -w 0 < "$KEYSTORE_FILE" > "$WORK_DIR/keystore.base64"
  printf 'Keystore password: ' >&2
  IFS= read -r -s KEYSTORE_PASSWORD
  printf '\nKey password: ' >&2
  IFS= read -r -s KEY_PASSWORD
  printf '\n' >&2
  printf '%s' "$KEYSTORE_PASSWORD" > "$WORK_DIR/keystore-password"
  printf '%s' "$KEY_PASSWORD" > "$WORK_DIR/key-password"
  unset KEYSTORE_PASSWORD KEY_PASSWORD

  jq -n \
    --rawfile keystore_base64 "$WORK_DIR/keystore.base64" \
    --rawfile store_password "$WORK_DIR/keystore-password" \
    --arg key_alias "$KEY_ALIAS" \
    --rawfile key_password "$WORK_DIR/key-password" \
    '{"keystore-base64": $keystore_base64, "store-password": $store_password,
      "key-alias": $key_alias, "key-password": $key_password}' \
    > "$WORK_DIR/android-signing.json"

  bao kv put -mount=kv ci/kuri/android-signing @"$WORK_DIR/android-signing.json"
)
```

`KEY_ALIAS` is not secret. The command places no signing value in argv or shell history.

## Import Forgejo Token

This guarded subshell reads the token without terminal output. It verifies repository access before the OpenBao write.

```bash
(
  set -eu
  set +x
  umask 077
  WORK_DIR="$(mktemp -d)"
  cleanup() {
    set +e
    rm -rf -- "$WORK_DIR"
    unset FORGEJO_TOKEN
  }
  trap cleanup EXIT
  trap 'exit 1' HUP INT TERM

  printf 'Forgejo repository token: ' >&2
  IFS= read -r -s FORGEJO_TOKEN
  printf '\n' >&2
  printf '%s' "$FORGEJO_TOKEN" > "$WORK_DIR/token"
  unset FORGEJO_TOKEN

  {
    printf '%s\n' 'silent' 'show-error' 'fail' 'output = "/dev/null"'
    printf 'header = "Authorization: token '
    tr -d '\r\n' < "$WORK_DIR/token"
    printf '"\nurl = "https://git.holdenitdown.net/api/v1/repos/rfhold/kuri"\n'
  } > "$WORK_DIR/curl.conf"
  curl --config "$WORK_DIR/curl.conf"

  jq -n --rawfile token "$WORK_DIR/token" '{token: $token}' \
    > "$WORK_DIR/forgejo-release.json"
  bao kv put -mount=kv ci/kuri/forgejo-release @"$WORK_DIR/forgejo-release.json"
)
```

A successful repository read does not prove write scope. Confirm the token scope through Forgejo's trusted administration interface before import.

## Validate Without Secret Output

Run only after explicit authorization for each TokenRequest, login, and capability query. Do not print JWTs, OpenBao tokens, or KV responses.

For each role, project the matching audience and submit the JWT on standard input. Verify sanitized token metadata through `auth/token/lookup-self`. Confirm the token type equals `batch`, `renewable` equals `false`, policies contain only its task policy, and TTL does not exceed 900 seconds.

Expected capability checks:

| Identity | Android data path | Forgejo data path | `auth/token/lookup-self` | Adjacent or metadata paths |
| --- | --- | --- | --- | --- |
| `kuri-tauri-build-v1` | `read` | `deny` | `read` | `deny` |
| `kuri-forgejo-release-v1` | `deny` | `read` | `read` | `deny` |

Wrong-audience, wrong-ServiceAccount, and wrong-namespace logins must fail. Capability queries do not authorize secret reads or writes.

## Rotation

For Android rotation, verify the replacement fingerprint before import. Run the Android import procedure to create a new KV version. Complete an authorized prerelease signature check before retirement of the prior signing key.

For Forgejo rotation, create and scope a replacement token first. Verify its `rfhold/kuri` access. Import it as a new KV version, then complete an authorized publication canary. Revoke the prior Forgejo token immediately after the canary succeeds.

Never destroy prior KV versions during routine rotation. Record version numbers and fingerprints, but never record payloads or tokens.

## Recovery

If a bad value reaches the current KV version, stop Kuri release work. Obtain explicit rollback authorization for the exact path and prior version.

```bash
bao kv metadata get -mount=kv ci/kuri/android-signing
bao kv rollback -mount=kv -version=<approved-prior-version> ci/kuri/android-signing

bao kv metadata get -mount=kv ci/kuri/forgejo-release
bao kv rollback -mount=kv -version=<approved-prior-version> ci/kuri/forgejo-release
```

Run only the affected rollback. Metadata reads and rollbacks require privileged operator access. A rollback creates a new current version from prior data.

If a Forgejo token leaks, revoke it in Forgejo before OpenBao recovery. If Android key material leaks, stop publication and follow the release key incident process. KV rollback cannot revoke either external credential.

## Evidence And Cleanup

Record approvals, timestamps, operator identity, mount ownership, KV version numbers, Android SHA-256 fingerprint, Forgejo repository scope, and sanitized validation outcomes. Never record payload fields, secret values, JWTs, tokens, or protected command output.

```bash
unset KEYSTORE_FILE KEY_ALIAS BAO_TOKEN VAULT_TOKEN
```

Confirm that temporary directories no longer exist. Confirm that shell history and terminal records contain no secret values.

## References

- [OpenBao contract](../secrets-management/spec/openbao.md)
- [Secret delivery contract](../secrets-management/spec/secret-delivery.md)
- [Tracked implementation](../secrets-management/implementation.md)
- [OpenBao operations](openbao.md)

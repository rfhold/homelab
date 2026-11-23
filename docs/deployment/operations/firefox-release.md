# Firefox extension release

Pantheon Tekton uses the shared `firefox-release-sign-v1` account and
OpenBao's Kubernetes login. The Browser Use release run accepts signed
`firefox-v<major>.<minor>.<patch>` tags. It signs through Mozilla's unlisted
channel and does not upload the result.

## Credentials

After authorization for the exact Pantheon change, obtain the issuer and
secret from [Mozilla Add-ons](https://addons.mozilla.org/en-US/developers/addon/api/key/).
Use a trusted terminal with tracing and capture off. Verify the active
`BAO_ADDR` and the operator identity first. Use the canonical KV v2 mount;
never put the payload in Pulumi state or Git.

For the initial create, run this in Bash. `-cas=0` rejects an overwrite.
For rotation, use the authorized current version as the CAS value.

```bash
(
  set +x
  set -euo pipefail
  IFS= read -rsp 'Mozilla JWT issuer: ' issuer; printf '\n' >&2
  IFS= read -rsp 'Mozilla JWT secret: ' secret; printf '\n' >&2
  test -n "$issuer" && test -n "$secret" || exit 1
  printf '%s\n%s\n' "$issuer" "$secret" |
    jq -Rn '{ "jwt-issuer": input, "jwt-secret": input }' |
    bao kv put -mount=kv -cas=0 ci/signing/firefox/release -
)
```

The Tekton stack manages the account, role, and policy. Follow the existing
release bootstrap order: reconcile OpenBao before Tekton. Obtain separate
authorization for each live preview, apply, credential write, and release run.
Check that `release-trusted-signers` contains the approved public key.

## Retrieve the artifact

After an authorized successful run, record the PipelineRun's release workspace
claim. The claim uses `shared-fs`. Use an authorized operator pod in the same
namespace with the claim mounted read-only. Copy only `output/browser-use-firefox-<version>.xpi`
and its `.sha256` file before PaC prunes the run. Verify the files locally
with `sha256sum -c`. Do not attach the signing account to the operator pod.
Remove the operator pod after the copy under the authorized cleanup scope.
Follow Browser Use's release guide for the LibreWolf smoke test, manual Forgejo
upload, and update feed. Confirm the claim lifecycle on Pantheon before
dispatching the first production release.

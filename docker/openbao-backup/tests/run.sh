#!/usr/bin/env bash
set -Eeuo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fixtures="$tmp/bin"
cp -R "$root/tests/fixtures/bin" "$fixtures"
chmod 755 "$fixtures"/*

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_empty_dir() {
  [[ -z "$(ls -A "$1")" ]] || fail "$2"
}

run_backup() {
  local state=$1
  mkdir -p "$state/token" "$state/work"
  PATH="$fixtures:$PATH" \
  FIXTURE_STATE="$state" \
  OPENBAO_ADDR=https://openbao.fixture.invalid \
  OPENBAO_K8S_ROLE=backup-fixture \
  OPENBAO_K8S_JWT=fixture-jwt-not-real \
  AGE_RECIPIENT=age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq \
  S3_ENDPOINT=https://s3.fixture.invalid \
  S3_BUCKET=fixture-backups \
  S3_PREFIX=openbao \
  AWS_ACCESS_KEY_ID=fixture-access-not-real \
  AWS_SECRET_ACCESS_KEY=fixture-secret-not-real \
  TOKEN_DIR="$state/token" \
  WORK_DIR="$state/work" \
  bash "$root/backup.sh"
}

success="$tmp/success"
mkdir -p "$success"
if ! run_backup "$success" >"$success/stdout" 2>"$success/stderr"; then
  while IFS= read -r diagnostic; do
    printf '%s\n' "$diagnostic" >&2
  done <"$success/stderr"
  fail "successful backup fixture failed"
fi
[[ "$(<"$success/age-input")" == snapshot-plaintext-fixture ]] || fail "snapshot did not stream into age"
[[ "$(<"$success/uploaded-artifact")" == age-encrypted-fixture ]] || fail "uploaded artifact was not ciphertext fixture"
[[ "$(<"$success/artifact-mode")" == 600 ]] || fail "ciphertext staging mode was not 0600"
[[ "$(<"$success/uploaded-manifest")" == *'"ciphertextSha256"'* ]] || fail "manifest omitted ciphertext checksum"
[[ "$(<"$success/uploaded-manifest")" == *'"ciphertextSize":21'* ]] || fail "manifest omitted ciphertext size"
[[ "$(wc -l <"$success/aws-calls")" -eq 2 ]] || fail "completion upload was not the final second upload"
mapfile -t success_aws_calls <"$success/aws-calls"
[[ "${success_aws_calls[1]}" == *"s3 cp - "* ]] || fail "completion manifest was not uploaded last"
assert_empty_dir "$success/work" "ciphertext staging was not cleaned"
assert_empty_dir "$success/token" "token staging was not cleaned"
if grep -Eq 'fixture-(jwt|secret|token|access)|snapshot-plaintext' "$success/stdout" "$success/stderr"; then
  fail "backup logs exposed fixture-sensitive content"
fi

broken="$tmp/broken"
mkdir -p "$broken"
if MOCK_AGE_FAIL=1 run_backup "$broken" >"$broken/stdout" 2>"$broken/stderr"; then
  fail "broken encryption pipe succeeded"
fi
[[ ! -e "$broken/aws-calls" ]] || fail "broken encryption pipe attempted upload"
assert_empty_dir "$broken/work" "broken encryption left staged data"
assert_empty_dir "$broken/token" "broken encryption left token data"

artifact_fail="$tmp/artifact-fail"
mkdir -p "$artifact_fail"
if MOCK_AWS_FAIL_ARTIFACT=1 run_backup "$artifact_fail" >"$artifact_fail/stdout" 2>"$artifact_fail/stderr"; then
  fail "artifact upload failure succeeded"
fi
[[ ! -e "$artifact_fail/uploaded-manifest" ]] || fail "completion uploaded after artifact failure"
assert_empty_dir "$artifact_fail/work" "artifact failure left ciphertext staged"

checksum_fail="$tmp/checksum-fail"
mkdir -p "$checksum_fail"
if MOCK_CHECKSUM_FAIL=1 run_backup "$checksum_fail" >"$checksum_fail/stdout" 2>"$checksum_fail/stderr"; then
  fail "checksum failure succeeded"
fi
[[ ! -e "$checksum_fail/aws-calls" ]] || fail "checksum failure attempted upload"
assert_empty_dir "$checksum_fail/work" "checksum failure left ciphertext staged"

manifest_fail="$tmp/manifest-fail"
mkdir -p "$manifest_fail"
if MOCK_AWS_FAIL_MANIFEST=1 run_backup "$manifest_fail" >"$manifest_fail/stdout" 2>"$manifest_fail/stderr"; then
  fail "completion upload failure succeeded"
fi
[[ "$(wc -l <"$manifest_fail/aws-calls")" -eq 2 ]] || fail "completion failure made unexpected S3 calls"
assert_empty_dir "$manifest_fail/work" "completion failure left ciphertext staged"

signal="$tmp/signal"
mkdir -p "$signal/token" "$signal/work"
PATH="$fixtures:$PATH" \
FIXTURE_STATE="$signal" \
MOCK_SNAPSHOT_SLOW=1 \
OPENBAO_ADDR=https://openbao.fixture.invalid \
OPENBAO_K8S_ROLE=backup-fixture \
OPENBAO_K8S_JWT=fixture-jwt-not-real \
AGE_RECIPIENT=age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq \
S3_ENDPOINT=https://s3.fixture.invalid \
S3_BUCKET=fixture-backups \
AWS_ACCESS_KEY_ID=fixture-access-not-real \
AWS_SECRET_ACCESS_KEY=fixture-secret-not-real \
TOKEN_DIR="$signal/token" \
WORK_DIR="$signal/work" \
bash "$root/backup.sh" >"$signal/stdout" 2>"$signal/stderr" &
backup_pid=$!
for _ in {1..100}; do
  [[ -e "$signal/snapshot-started" ]] && break
  sleep 0.01
done
[[ -e "$signal/snapshot-started" ]] || fail "signal fixture did not start snapshot"
kill -TERM "$backup_pid"
if wait "$backup_pid"; then
  fail "signaled backup succeeded"
fi
[[ ! -e "$signal/aws-calls" ]] || fail "signaled backup attempted upload"
assert_empty_dir "$signal/work" "signal left ciphertext staged"
assert_empty_dir "$signal/token" "signal left token data"

retention="$tmp/retention"
mkdir -p "$retention"
key=openbao/snapshots/openbao-20260101T000000Z-0123456789abcdef0123456789abcdef.snap.age
PATH="$fixtures:$PATH" \
FIXTURE_STATE="$retention" \
MOCK_COMPLETION_KEYS="$key.complete.json" \
MOCK_MULTIPART=$'openbao/snapshots/openbao-20260102T000000Z-fedcba9876543210fedcba9876543210.snap.age\tfixture-upload-id' \
S3_ENDPOINT=https://s3.fixture.invalid \
S3_BUCKET=fixture-backups \
AWS_ACCESS_KEY_ID=fixture-retention-access-not-real \
AWS_SECRET_ACCESS_KEY=fixture-retention-secret-not-real \
bash "$root/retention.sh" >"$retention/stdout" 2>"$retention/stderr" || fail "retention fixture failed"
[[ "$(<"$retention/aws-calls")" == *"list-objects-v2"* ]] || fail "retention did not list metadata"
[[ "$(<"$retention/aws-calls")" == *"delete-object --bucket fixture-backups --key $key"* ]] || fail "retention did not delete ciphertext"
[[ "$(<"$retention/aws-calls")" == *"delete-object --bucket fixture-backups --key $key.complete.json"* ]] || fail "retention did not delete completion last"
[[ "$(<"$retention/aws-calls")" == *"list-multipart-uploads"* ]] || fail "retention did not list multipart metadata"
[[ "$(<"$retention/aws-calls")" == *"abort-multipart-upload"* ]] || fail "retention did not abort old multipart upload"
[[ "$(<"$retention/aws-calls")" != *"get-object"* ]] || fail "retention read an object body"
if grep -Eq 'fixture-retention-(access|secret)' "$retention/stdout" "$retention/stderr"; then
  fail "retention logs exposed fixture credentials"
fi

retention_empty="$tmp/retention-empty"
mkdir -p "$retention_empty"
PATH="$fixtures:$PATH" \
FIXTURE_STATE="$retention_empty" \
S3_ENDPOINT=https://s3.fixture.invalid \
S3_BUCKET=fixture-backups \
AWS_ACCESS_KEY_ID=fixture-retention-access-not-real \
AWS_SECRET_ACCESS_KEY=fixture-retention-secret-not-real \
bash "$root/retention.sh" >"$retention_empty/stdout" 2>"$retention_empty/stderr" || fail "empty retention fixture failed"
[[ "$(<"$retention_empty/aws-calls")" != *"delete-object"* ]] || fail "empty retention deleted an object"
[[ "$(<"$retention_empty/aws-calls")" != *"get-object"* ]] || fail "empty retention read an object body"

printf 'openbao backup fixtures: PASS\n'

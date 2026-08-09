#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

cipher_file=
request_file=
response_file=
curl_config=
snapshot_pipe=
curl_pid=
age_pid=

log_failure() {
  printf '{"level":"error","event":"openbao_backup_failed","stage":"%s"}\n' "$1" >&2
}

cleanup() {
  [[ -z "$cipher_file" ]] || rm -f -- "$cipher_file"
  [[ -z "$request_file" ]] || rm -f -- "$request_file"
  [[ -z "$response_file" ]] || rm -f -- "$response_file"
  [[ -z "$curl_config" ]] || rm -f -- "$curl_config"
  [[ -z "$snapshot_pipe" ]] || rm -f -- "$snapshot_pipe"
}

on_signal() {
  trap - HUP INT TERM
  [[ -z "$curl_pid" ]] || kill "$curl_pid" 2>/dev/null || true
  [[ -z "$age_pid" ]] || kill "$age_pid" 2>/dev/null || true
  wait 2>/dev/null || true
  log_failure signal
  exit 143
}

fail() {
  log_failure "$1"
  exit 1
}

load_value() {
  local name=$1
  local required=${2:-true}
  local file_name="${name}_FILE"
  local value=${!name-}
  local file=${!file_name-}

  [[ -z "$value" || -z "$file" ]] || fail configuration
  if [[ -n "$file" ]]; then
    [[ -f "$file" && -r "$file" ]] || fail configuration
    value=$(<"$file")
  fi
  if [[ "$required" == true && -z "$value" ]]; then
    fail configuration
  fi
  printf -v "$name" '%s' "$value"
}

trap cleanup EXIT
trap on_signal HUP INT TERM

load_value OPENBAO_ADDR
load_value OPENBAO_K8S_ROLE
load_value OPENBAO_K8S_JWT
load_value AGE_RECIPIENT
load_value S3_ENDPOINT
load_value S3_BUCKET
load_value S3_PREFIX false
load_value AWS_ACCESS_KEY_ID
load_value AWS_SECRET_ACCESS_KEY
load_value AWS_REGION false
load_value TOKEN_DIR
load_value WORK_DIR

S3_PREFIX=${S3_PREFIX:-openbao}
AWS_REGION=${AWS_REGION:-us-east-1}

[[ "$OPENBAO_ADDR" == https://* && "$OPENBAO_ADDR" != *[[:space:]]* ]] || fail configuration
[[ "$S3_ENDPOINT" == https://* && "$S3_ENDPOINT" != *[[:space:]]* ]] || fail configuration
[[ "$OPENBAO_K8S_ROLE" =~ ^[A-Za-z0-9._-]+$ ]] || fail configuration
[[ "$AGE_RECIPIENT" =~ ^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$ ]] || fail configuration
[[ "$S3_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || fail configuration
[[ "$S3_PREFIX" =~ ^[A-Za-z0-9._/-]+$ && "$S3_PREFIX" != /* && "$S3_PREFIX" != */ ]] || fail configuration
[[ "$AWS_REGION" =~ ^[A-Za-z0-9-]+$ ]] || fail configuration
[[ -d "$TOKEN_DIR" && -w "$TOKEN_DIR" && ! -L "$TOKEN_DIR" ]] || fail configuration
[[ -d "$WORK_DIR" && -w "$WORK_DIR" && ! -L "$WORK_DIR" ]] || fail configuration

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION

request_file=$(mktemp "$TOKEN_DIR/login-request.XXXXXX") || fail token_setup
response_file=$(mktemp "$TOKEN_DIR/login-response.XXXXXX") || fail token_setup
curl_config=$(mktemp "$TOKEN_DIR/snapshot-curl.XXXXXX") || fail token_setup
chmod 600 "$request_file" "$response_file" "$curl_config" || fail token_setup

if ! printf '%s' "$OPENBAO_K8S_JWT" | jq -Rs --arg role "$OPENBAO_K8S_ROLE" '{role:$role,jwt:rtrimstr("\n")}' >"$request_file"; then
  fail authentication
fi
unset OPENBAO_K8S_JWT

if ! curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
  --header 'Content-Type: application/json' --data-binary "@$request_file" \
  "$OPENBAO_ADDR/v1/auth/kubernetes/login" >"$response_file" 2>/dev/null; then
  fail authentication
fi

token=$(jq -er '.auth.client_token | select(type == "string" and length > 0)' <"$response_file" 2>/dev/null) || fail authentication
[[ "$token" =~ ^[A-Za-z0-9._-]+$ ]] || fail authentication
printf 'silent\nshow-error\nfail\nconnect-timeout = 10\nmax-time = 600\nheader = "X-Vault-Token: %s"\n' "$token" >"$curl_config"
unset token
rm -f -- "$request_file" "$response_file"
request_file=
response_file=

timestamp=$(date -u +%Y%m%dT%H%M%SZ) || fail object_key
random_id=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n') || fail object_key
[[ "$random_id" =~ ^[a-f0-9]{32}$ ]] || fail object_key
artifact_key="$S3_PREFIX/snapshots/openbao-$timestamp-$random_id.snap.age"
manifest_key="$artifact_key.complete.json"
cipher_file=$(mktemp "$WORK_DIR/.openbao-snapshot.XXXXXX.age") || fail ciphertext_stage
chmod 600 "$cipher_file" || fail ciphertext_stage
snapshot_pipe=$(mktemp "$TOKEN_DIR/snapshot-stream.XXXXXX") || fail snapshot_stream
rm -f -- "$snapshot_pipe"
mkfifo -m 600 "$snapshot_pipe" || fail snapshot_stream

curl --config "$curl_config" "$OPENBAO_ADDR/v1/sys/storage/raft/snapshot" >"$snapshot_pipe" 2>/dev/null &
curl_pid=$!
age --encrypt --recipient "$AGE_RECIPIENT" --output "$cipher_file" <"$snapshot_pipe" 2>/dev/null &
age_pid=$!
set +e
wait "$curl_pid"
curl_status=$?
wait "$age_pid"
age_status=$?
set -e
curl_pid=
age_pid=
rm -f -- "$snapshot_pipe"
snapshot_pipe=
if ((curl_status != 0 || age_status != 0)); then
  fail snapshot_stream
fi

[[ -f "$cipher_file" && ! -L "$cipher_file" ]] || fail ciphertext_stage
checksum=$(sha256sum "$cipher_file" | cut -d ' ' -f 1) || fail checksum
size=$(wc -c <"$cipher_file" | tr -d ' ') || fail checksum
[[ "$checksum" =~ ^[a-f0-9]{64}$ && "$size" =~ ^[0-9]+$ && "$size" -gt 0 ]] || fail checksum

if ! aws --endpoint-url "$S3_ENDPOINT" s3api put-object \
  --bucket "$S3_BUCKET" --key "$artifact_key" --body "$cipher_file" \
  --content-type application/octet-stream --metadata "sha256=$checksum,size=$size" \
  >/dev/null 2>&1; then
  fail artifact_upload
fi

if ! printf '{"version":1,"artifact":"%s","createdAt":"%s","ciphertextSha256":"%s","ciphertextSize":%s}\n' \
  "$artifact_key" "$timestamp" "$checksum" "$size" \
  | aws --endpoint-url "$S3_ENDPOINT" s3 cp - "s3://$S3_BUCKET/$manifest_key" \
      --content-type application/json --only-show-errors --no-progress >/dev/null 2>&1; then
  fail completion_upload
fi

printf '{"level":"info","event":"openbao_backup_complete","ciphertext_bytes":%s}\n' "$size"

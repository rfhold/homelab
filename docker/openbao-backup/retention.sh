#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

log_failure() {
  printf '{"level":"error","event":"openbao_retention_failed","stage":"%s"}\n' "$1" >&2
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

load_value S3_ENDPOINT
load_value S3_BUCKET
load_value S3_PREFIX false
load_value AWS_ACCESS_KEY_ID
load_value AWS_SECRET_ACCESS_KEY
load_value AWS_REGION false
load_value RETENTION_DAYS false

S3_PREFIX=${S3_PREFIX:-openbao}
AWS_REGION=${AWS_REGION:-us-east-1}
RETENTION_DAYS=${RETENTION_DAYS:-30}

[[ "$S3_ENDPOINT" == https://* && "$S3_ENDPOINT" != *[[:space:]]* ]] || fail configuration
[[ "$S3_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || fail configuration
[[ "$S3_PREFIX" =~ ^[A-Za-z0-9._/-]+$ && "$S3_PREFIX" != /* && "$S3_PREFIX" != */ ]] || fail configuration
[[ "$AWS_REGION" =~ ^[A-Za-z0-9-]+$ ]] || fail configuration
[[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || fail configuration

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION
cutoff=$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%dT%H:%M:%SZ) || fail cutoff
prefix="$S3_PREFIX/snapshots/"

listing=$(aws --endpoint-url "$S3_ENDPOINT" s3api list-objects-v2 \
  --bucket "$S3_BUCKET" --prefix "$prefix" --output json 2>/dev/null) || fail list_completed
keys=$(jq -r --arg cutoff "$cutoff" '.Contents // [] | map(select(.LastModified < $cutoff) | .Key | select(endswith(".complete.json"))) | .[]?' \
  <<<"$listing" 2>/dev/null) || fail list_completed
unset listing

deleted=0
if [[ -n "$keys" ]]; then
  mapfile -t completion_keys <<<"$keys"
  for completion_key in "${completion_keys[@]}"; do
    relative=${completion_key#"$prefix"}
    [[ "$relative" != "$completion_key" && "$relative" =~ ^openbao-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{32}\.snap\.age\.complete\.json$ ]] || continue
    artifact_key=${completion_key%.complete.json}
    aws --endpoint-url "$S3_ENDPOINT" s3api delete-object --bucket "$S3_BUCKET" --key "$artifact_key" >/dev/null 2>&1 || fail delete_artifact
    aws --endpoint-url "$S3_ENDPOINT" s3api delete-object --bucket "$S3_BUCKET" --key "$completion_key" >/dev/null 2>&1 || fail delete_completion
    ((deleted += 1))
  done
fi
unset keys

uploads=$(aws --endpoint-url "$S3_ENDPOINT" s3api list-multipart-uploads \
  --bucket "$S3_BUCKET" --prefix "$prefix" --output json 2>/dev/null) || fail list_multipart
multipart=$(jq -r --arg cutoff "$cutoff" '.Uploads // [] | map(select(.Initiated < $cutoff) | [.Key, .UploadId] | @tsv) | .[]?' \
  <<<"$uploads" 2>/dev/null) || fail list_multipart
unset uploads

aborted=0
if [[ -n "$multipart" ]]; then
  while IFS=$'\t' read -r upload_key upload_id; do
    relative=${upload_key#"$prefix"}
    [[ "$relative" != "$upload_key" && "$relative" =~ ^openbao-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{32}\.snap\.age$ ]] || continue
    [[ -n "$upload_id" && "$upload_id" != *$'\n'* && "$upload_id" != *$'\t'* ]] || fail list_multipart
    aws --endpoint-url "$S3_ENDPOINT" s3api abort-multipart-upload \
      --bucket "$S3_BUCKET" --key "$upload_key" --upload-id "$upload_id" >/dev/null 2>&1 || fail abort_multipart
    ((aborted += 1))
  done <<<"$multipart"
fi

printf '{"level":"info","event":"openbao_retention_complete","deleted_recovery_points":%s,"aborted_uploads":%s}\n' "$deleted" "$aborted"

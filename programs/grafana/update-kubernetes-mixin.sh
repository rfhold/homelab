#!/usr/bin/env bash

set -euo pipefail

VERSION="${1:-1.3.1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIXIN_DIR="${SCRIPT_DIR}/kubernetes-mixin"
TEMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

echo "Downloading kubernetes-mixin version ${VERSION}..."

DOWNLOAD_URL="https://github.com/kubernetes-monitoring/kubernetes-mixin/releases/download/version-${VERSION}/kubernetes-mixin-version-${VERSION}.zip"

if ! curl -fsSL -o "${TEMP_DIR}/kubernetes-mixin.zip" "${DOWNLOAD_URL}"; then
  echo "Error: Failed to download kubernetes-mixin version ${VERSION}"
  exit 1
fi

echo "Extracting kubernetes-mixin..."
unzip -q "${TEMP_DIR}/kubernetes-mixin.zip" -d "${TEMP_DIR}"

mkdir -p "${MIXIN_DIR}/alerts"
mkdir -p "${MIXIN_DIR}/recording-rules"
mkdir -p "${MIXIN_DIR}/dashboards"

update_job_labels_yaml() {
  local file="$1"
  sed -i '' 's/job="kubelet"/job="integrations\/kubernetes\/kubelet"/g' "${file}"
  sed -i '' 's/job="cadvisor"/job="integrations\/kubernetes\/cadvisor"/g' "${file}"
  sed -i '' 's/job="kube-state-metrics"/job="integrations\/kubernetes\/kube-state-metrics"/g' "${file}"
  sed -i '' 's/job="node-exporter"/job="integrations\/node_exporter"/g' "${file}"
  sed -i '' 's/job="kube-apiserver"/job="integrations\/kubernetes\/kube-apiserver"/g' "${file}"
  sed -i '' 's/job="kube-controller-manager"/job="integrations\/kubernetes\/kube-controller-manager"/g' "${file}"
  sed -i '' 's/job="kube-scheduler"/job="integrations\/kubernetes\/kube-scheduler"/g' "${file}"
  sed -i '' 's/job="kube-proxy"/job="integrations\/kubernetes\/kube-proxy"/g' "${file}"
}

echo "Organizing kubernetes-mixin files..."

if [ -f "${TEMP_DIR}/prometheus_alerts.yaml" ]; then
  cp "${TEMP_DIR}/prometheus_alerts.yaml" "${MIXIN_DIR}/alerts/kubernetes.yaml"
  update_job_labels_yaml "${MIXIN_DIR}/alerts/kubernetes.yaml"
  echo "  ✓ Copied alerts to kubernetes-mixin/alerts/kubernetes.yaml"
else
  echo "  ⚠ Warning: prometheus_alerts.yaml not found"
fi

if [ -f "${TEMP_DIR}/prometheus_rules.yaml" ]; then
  cp "${TEMP_DIR}/prometheus_rules.yaml" "${MIXIN_DIR}/recording-rules/kubernetes.rules.yaml"
  update_job_labels_yaml "${MIXIN_DIR}/recording-rules/kubernetes.rules.yaml"
  echo "  ✓ Copied recording rules to kubernetes-mixin/recording-rules/kubernetes.rules.yaml"
else
  echo "  ⚠ Warning: prometheus_rules.yaml not found"
fi

update_job_labels_json() {
  local file="$1"
  sed -i '' 's/job=\\"kubelet\\"/job=\\"integrations\/kubernetes\/kubelet\\"/g' "${file}"
  sed -i '' 's/job=\\"cadvisor\\"/job=\\"integrations\/kubernetes\/cadvisor\\"/g' "${file}"
  sed -i '' 's/job=\\"kube-state-metrics\\"/job=\\"integrations\/kubernetes\/kube-state-metrics\\"/g' "${file}"
  sed -i '' 's/job=\\"node-exporter\\"/job=\\"integrations\/node_exporter\\"/g' "${file}"
  sed -i '' 's/job=\\"kube-apiserver\\"/job=\\"integrations\/kubernetes\/kube-apiserver\\"/g' "${file}"
  sed -i '' 's/job=\\"kube-controller-manager\\"/job=\\"integrations\/kubernetes\/kube-controller-manager\\"/g' "${file}"
  sed -i '' 's/job=\\"kube-scheduler\\"/job=\\"integrations\/kubernetes\/kube-scheduler\\"/g' "${file}"
  sed -i '' 's/job=\\"kube-proxy\\"/job=\\"integrations\/kubernetes\/kube-proxy\\"/g' "${file}"
  sed -i '' 's/job=\\"kubernetes-windows-exporter\\"/job=\\"integrations\/windows_exporter\\"/g' "${file}"
}

if [ -d "${TEMP_DIR}/dashboards_out" ]; then
  DASHBOARD_COUNT=$(find "${TEMP_DIR}/dashboards_out" -name "*.json" | wc -l | tr -d ' ')
  if [ "${DASHBOARD_COUNT}" -gt 0 ]; then
    cp "${TEMP_DIR}/dashboards_out"/*.json "${MIXIN_DIR}/dashboards/"
    echo "  ✓ Copied ${DASHBOARD_COUNT} dashboards to kubernetes-mixin/dashboards/"
    
    echo "Updating job labels in dashboards..."
    for dashboard in "${MIXIN_DIR}/dashboards"/*.json; do
      update_job_labels_json "${dashboard}"
    done
    echo "  ✓ Updated job labels to use integrations/* prefixes"
  else
    echo "  ⚠ Warning: No dashboard files found in dashboards_out"
  fi
else
  echo "  ⚠ Warning: dashboards_out directory not found"
fi

echo "${VERSION}" > "${MIXIN_DIR}/VERSION"
echo "  ✓ Created VERSION file with version ${VERSION}"

echo ""
echo "✓ Successfully updated kubernetes-mixin to version ${VERSION}"

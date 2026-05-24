#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/grafana/alert-rules"

usage() {
    echo "Usage: GRAFANA_SERVER=<url> GRAFANA_USER=<user> GRAFANA_PASSWORD=<password> GRAFANA_ORG_ID=1 $0"
    echo "       GRAFANA_SERVER=<url> GRAFANA_TOKEN=<token> GRAFANA_ORG_ID=1 $0"
    exit 1
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
fi

if ! command -v gcx >/dev/null 2>&1; then
    echo "ERROR: gcx is required" >&2
    exit 1
fi

if [ -z "${GRAFANA_SERVER:-}" ]; then
    echo "ERROR: GRAFANA_SERVER is required" >&2
    exit 1
fi

if [ -z "${GRAFANA_TOKEN:-}" ] && { [ -z "${GRAFANA_USER:-}" ] || [ -z "${GRAFANA_PASSWORD:-}" ]; }; then
    echo "ERROR: set GRAFANA_TOKEN or both GRAFANA_USER and GRAFANA_PASSWORD" >&2
    exit 1
fi

export GRAFANA_ORG_ID="${GRAFANA_ORG_ID:-1}"

mkdir -p "$OUTPUT_DIR"
PULL_DIR="$(mktemp -d)"
trap 'rm -rf "$PULL_DIR"' EXIT

gcx resources pull \
    alertrules.v0alpha1.rules.alerting.grafana.app \
    recordingrules.v0alpha1.rules.alerting.grafana.app \
    --include-managed \
    --output yaml \
    --path "$PULL_DIR" \
    --on-error abort

PULL_DIR="$PULL_DIR" OUTPUT_DIR="$OUTPUT_DIR" bun --eval '
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const input = process.env.PULL_DIR;
const output = process.env.OUTPUT_DIR;
const folders = new Set();

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "rule";
}

function title(domain) {
  return `Alert Rules / ${domain.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join(" ")}`;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else if (entry.isFile() && file.endsWith(".yaml")) files.push(file);
  }
  return files;
}

function writeYaml(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, YAML.stringify(value));
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of walk(input)) {
  for (const doc of YAML.parseAllDocuments(fs.readFileSync(file, "utf8"))) {
    const resource = doc.toJSON();
    if (!resource || (resource.kind !== "AlertRule" && resource.kind !== "RecordingRule")) continue;

    resource.metadata ??= {};
    resource.metadata.labels ??= {};
    resource.metadata.annotations ??= {};
    delete resource.metadata.namespace;
    delete resource.metadata.resourceVersion;
    delete resource.metadata.uid;
    delete resource.metadata.creationTimestamp;
    delete resource.metadata.generation;
    delete resource.metadata.managedFields;
    delete resource.metadata.labels["grafana.com/group"];
    delete resource.metadata.labels["grafana.com/group-index"];
    delete resource.metadata.annotations["grafana.com/group"];
    delete resource.metadata.annotations["grafana.com/group-index"];
    delete resource.metadata.annotations["grafana.com/updateTimestamp"];
    delete resource.metadata.annotations["grafana.com/updatedBy"];

    const folder = resource.metadata.labels["grafana.app/folder"] || resource.metadata.annotations["grafana.app/folder"] || "alert-rules-general";
    resource.metadata.labels["grafana.app/folder"] = folder;
    resource.metadata.annotations["grafana.app/folder"] = folder;
    const domain = folder.startsWith("alert-rules-") ? folder.slice("alert-rules-".length) : "general";
    folders.add(domain);

    if (resource.kind === "AlertRule") {
      resource.spec.noDataState = "OK";
      delete resource.spec?.expressions?.A?.source;
      if (resource.spec?.expressions?.B) {
        resource.spec.expressions.B = {
          model: {
            datasource: { type: "__expr__", uid: "__expr__" },
            expression: "A",
            intervalMs: 1000,
            maxDataPoints: 43200,
            refId: "B",
            reducer: "last",
            settings: { mode: "dropNN" },
            type: "reduce",
          },
          source: true,
        };
      }
      writeYaml(path.join(output, domain, "alerts", `${slug(resource.spec?.title || resource.metadata.name)}-${resource.metadata.name}.yaml`), resource);
    } else {
      const expression = resource.spec?.expressions?.A;
      if (expression) {
        expression.source = true;
        expression.model ??= {};
        expression.model.instant = true;
        expression.model.range = false;
      }
      writeYaml(path.join(output, domain, "recording", `${slug(resource.spec?.metric || resource.metadata.name)}-${resource.metadata.name}.yaml`), resource);
    }
  }
}

for (const domain of [...folders].sort()) {
  const uid = `alert-rules-${domain}`;
  writeYaml(path.join(output, "folders", `${domain}.yaml`), {
    apiVersion: "folder.grafana.app/v1",
    kind: "Folder",
    metadata: { name: uid },
    spec: { title: title(domain) },
  });
}
'

echo "Grafana alert rules synced to $OUTPUT_DIR"

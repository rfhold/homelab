#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULE_DIR="$ROOT_DIR/grafana/alert-rules"

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

if [ ! -d "$RULE_DIR" ]; then
    echo "ERROR: $RULE_DIR does not exist" >&2
    exit 1
fi

gcx resources push folders.v1.folder.grafana.app \
    --path "$RULE_DIR" \
    --on-error abort

gcx resources delete alertrules.v0alpha1.rules.alerting.grafana.app --yes --on-error abort
gcx resources delete recordingrules.v0alpha1.rules.alerting.grafana.app --yes --on-error abort
gcx resources delete folders.v1.folder.grafana.app/alert-rules --yes --on-error ignore || true

if compgen -G "$RULE_DIR/*" >/dev/null; then
    gcx resources push \
        --include-managed \
        --path "$RULE_DIR" \
        --on-error abort
fi

echo "Grafana alert rules reconciled from $RULE_DIR"

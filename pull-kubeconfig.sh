#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $0 <cluster-name>"
    echo "Example: $0 pantheon"
    exit 1
fi

CLUSTER_NAME="$1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INVENTORY_FILE="$SCRIPT_DIR/inventory.py"

if [ ! -f "$INVENTORY_FILE" ]; then
    echo "Error: inventory.py not found at $INVENTORY_FILE"
    exit 1
fi

echo "Finding cluster-init node for cluster: $CLUSTER_NAME"

read -r CLUSTER_INIT_HOST API_HOST API_PORT < <(python3 <<EOF
import sys
sys.path.insert(0, '$SCRIPT_DIR')
from inventory import romulus, pantheon

clusters = {
    'romulus': romulus,
    'pantheon': pantheon,
}

cluster_name = '$CLUSTER_NAME'
if cluster_name not in clusters:
    print(f"Error: Unknown cluster '{cluster_name}'. Available: {', '.join(clusters.keys())}", file=sys.stderr)
    sys.exit(1)

cluster = clusters[cluster_name]
cluster_init_node = None

for host, data in cluster:
    k3s_config = data.get('k3s_cluster', {})
    if k3s_config.get('node_role') == 'cluster-init':
        cluster_init_node = host
        api_host = k3s_config.get('api_host')
        api_port = k3s_config.get('api_port', 6443)
        print(f"{cluster_init_node} {api_host} {api_port}")
        break

if not cluster_init_node:
    print(f"Error: No cluster-init node found for cluster '{cluster_name}'", file=sys.stderr)
    sys.exit(1)
EOF
)

if [ -z "$CLUSTER_INIT_HOST" ]; then
    echo "Error: Failed to find cluster-init node"
    exit 1
fi

echo "Cluster-init node: $CLUSTER_INIT_HOST"
echo "API endpoint: https://$API_HOST:$API_PORT"

LOCAL_KUBECONFIG="$SCRIPT_DIR/config"
TEMP_KUBECONFIG="$(mktemp "/tmp/kubeconfig-$CLUSTER_NAME.XXXXXX.yaml")"
MERGED_KUBECONFIG="$(mktemp "/tmp/merged-kubeconfig.XXXXXX.yaml")"
CURRENT_CONTEXT=""

if [ -s "$LOCAL_KUBECONFIG" ]; then
    CURRENT_CONTEXT="$(kubectl --kubeconfig="$LOCAL_KUBECONFIG" config current-context 2>/dev/null || true)"
fi

cleanup() {
    rm -f "$TEMP_KUBECONFIG" "$TEMP_KUBECONFIG.bak" "$MERGED_KUBECONFIG"
}

trap cleanup EXIT

echo "Downloading kubeconfig from $CLUSTER_INIT_HOST..."
ssh "$CLUSTER_INIT_HOST" "sudo cat /etc/rancher/k3s/k3s.yaml" > "$TEMP_KUBECONFIG"

if [ ! -s "$TEMP_KUBECONFIG" ]; then
    echo "Error: Failed to download kubeconfig"
    exit 1
fi

touch "$LOCAL_KUBECONFIG"

echo "Processing downloaded kubeconfig..."
sed -i.bak "s/name: default$/name: $CLUSTER_NAME/g" "$TEMP_KUBECONFIG"
sed -i.bak "s/cluster: default$/cluster: $CLUSTER_NAME/g" "$TEMP_KUBECONFIG"
sed -i.bak "s/user: default$/user: $CLUSTER_NAME/g" "$TEMP_KUBECONFIG"
sed -i.bak "s/current-context: default$/current-context: $CLUSTER_NAME/g" "$TEMP_KUBECONFIG"
sed -i.bak "s|server:.*|server: https://$API_HOST:$API_PORT|g" "$TEMP_KUBECONFIG"
rm -f "$TEMP_KUBECONFIG.bak"

echo "Merging kubeconfig..."
KUBECONFIG="$TEMP_KUBECONFIG:$LOCAL_KUBECONFIG" kubectl config view --flatten > "$MERGED_KUBECONFIG"
if [ -n "$CURRENT_CONTEXT" ]; then
    KUBECONFIG="$MERGED_KUBECONFIG" kubectl config use-context "$CURRENT_CONTEXT" >/dev/null
fi
mv "$MERGED_KUBECONFIG" "$LOCAL_KUBECONFIG"
chmod 600 "$LOCAL_KUBECONFIG"

echo ""
echo "✓ Successfully merged kubeconfig for cluster '$CLUSTER_NAME'"
echo "  Use: kubectl config use-context $CLUSTER_NAME"

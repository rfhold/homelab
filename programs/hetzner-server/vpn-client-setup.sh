#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

CLIENT_NAME="${1:-client}"
CLIENT_IP="${2:-10.8.0.2}"
CONFIG_DIR="${3:-$HOME/.config/vpn}"
CLIENT_PRIVATE_KEY_FILE="${4:-}"

mkdir -p "$CONFIG_DIR"

echo "Fetching server info from Pulumi..."
SERVER_IP=$(pulumi stack output serverIpv4)

echo "Fetching keys and secrets from server..."
SERVER_PUBLIC_KEY=$(ssh -o StrictHostKeyChecking=accept-new admin@"$SERVER_IP" "sudo cat /etc/wireguard/server_public" 2>/dev/null)
PRESHARED_KEY=$(ssh admin@"$SERVER_IP" "sudo cat /etc/wireguard/preshared" 2>/dev/null)
WSTUNNEL_SECRET=$(ssh admin@"$SERVER_IP" "sudo grep WSTUNNEL_SECRET /etc/wstunnel/secret.env | cut -d'=' -f2" 2>/dev/null)

WG_CONF="$CONFIG_DIR/$CLIENT_NAME.conf"
WSTUNNEL_CONF="$CONFIG_DIR/wstunnel.env"
CLIENT_KEY_FILE="$CONFIG_DIR/$CLIENT_NAME.key"

if [ -n "$CLIENT_PRIVATE_KEY_FILE" ] && [ -f "$CLIENT_PRIVATE_KEY_FILE" ]; then
  echo "Using provided private key from $CLIENT_PRIVATE_KEY_FILE"
  CLIENT_PRIVATE_KEY=$(cat "$CLIENT_PRIVATE_KEY_FILE")
  CLIENT_PUBLIC_KEY=$(echo "$CLIENT_PRIVATE_KEY" | wg pubkey)
elif [ -f "$CLIENT_KEY_FILE" ]; then
  echo "Using existing private key from $CLIENT_KEY_FILE"
  CLIENT_PRIVATE_KEY=$(cat "$CLIENT_KEY_FILE")
  CLIENT_PUBLIC_KEY=$(echo "$CLIENT_PRIVATE_KEY" | wg pubkey)
elif [ -f "$WG_CONF" ]; then
  echo "Extracting private key from existing config at $WG_CONF"
  CLIENT_PRIVATE_KEY=$(grep "PrivateKey" "$WG_CONF" | cut -d'=' -f2 | tr -d ' ')
  CLIENT_PUBLIC_KEY=$(echo "$CLIENT_PRIVATE_KEY" | wg pubkey)
  echo "$CLIENT_PRIVATE_KEY" > "$CLIENT_KEY_FILE"
  chmod 600 "$CLIENT_KEY_FILE"
else
  echo "Generating new WireGuard keypair..."
  CLIENT_PRIVATE_KEY=$(wg genkey)
  CLIENT_PUBLIC_KEY=$(echo "$CLIENT_PRIVATE_KEY" | wg pubkey)
  echo "$CLIENT_PRIVATE_KEY" > "$CLIENT_KEY_FILE"
  chmod 600 "$CLIENT_KEY_FILE"
fi

cat > "$WG_CONF" << EOF
[Interface]
PrivateKey = $CLIENT_PRIVATE_KEY
Address = $CLIENT_IP/24
DNS = 1.1.1.1, 8.8.8.8
MTU = 1280

[Peer]
PublicKey = $SERVER_PUBLIC_KEY
PresharedKey = $PRESHARED_KEY
Endpoint = 127.0.0.1:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF
chmod 600 "$WG_CONF"

cat > "$WSTUNNEL_CONF" << EOF
SERVER_IP=$SERVER_IP
WSTUNNEL_SECRET=$WSTUNNEL_SECRET
EOF
chmod 600 "$WSTUNNEL_CONF"

START_TUNNEL_SCRIPT="$CONFIG_DIR/start-tunnel.sh"
cat > "$START_TUNNEL_SCRIPT" << 'SCRIPT'
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/wstunnel.env"

cleanup() {
  echo "Stopping wstunnel..."
  pkill -f "wstunnel client.*$SERVER_IP" 2>/dev/null || true
  sudo route -n delete -host "$SERVER_IP" 2>/dev/null || true
  echo "Done. You can now disconnect WireGuard in the app."
}
trap cleanup EXIT INT TERM

pkill -f "wstunnel client.*$SERVER_IP" 2>/dev/null || true

DEFAULT_GW=$(route -n get default | awk '/gateway:/ {print $2}')
echo "Adding direct route to $SERVER_IP via $DEFAULT_GW..."
sudo route -n delete -host "$SERVER_IP" 2>/dev/null || true
sudo route -n add -host "$SERVER_IP" "$DEFAULT_GW"

echo "Starting wstunnel..."
wstunnel client \
  --http-upgrade-path-prefix "$WSTUNNEL_SECRET" \
  -L "udp://127.0.0.1:51820:127.0.0.1:51820" \
  "wss://$SERVER_IP:443" &

sleep 2
echo ""
echo "Ready! Now connect WireGuard in the app."
echo "Press Ctrl+C to stop (disconnect WireGuard first)."
echo ""

wait
SCRIPT
chmod +x "$START_TUNNEL_SCRIPT"

echo "Checking if peer exists on server..."
PEER_EXISTS=$(ssh admin@"$SERVER_IP" "sudo grep -q '$CLIENT_PUBLIC_KEY' /etc/wireguard/wg0.conf 2>/dev/null && echo yes || echo no")

if [ "$PEER_EXISTS" = "no" ]; then
  echo "Adding peer to server..."
  ssh admin@"$SERVER_IP" "sudo tee -a /etc/wireguard/wg0.conf > /dev/null << EOF

[Peer]
# $CLIENT_NAME
PublicKey = $CLIENT_PUBLIC_KEY
PresharedKey = $PRESHARED_KEY
AllowedIPs = $CLIENT_IP/32
EOF
"
  ssh admin@"$SERVER_IP" "sudo systemctl restart wg-quick@wg0"
  echo "Peer added and WireGuard restarted on server."
else
  echo "Peer already exists on server."
fi

echo ""
echo "Setup complete!"
echo ""
echo "Config directory: $CONFIG_DIR"
echo "  - $CLIENT_NAME.conf  (WireGuard config - import into WireGuard app)"
echo "  - $CLIENT_NAME.key   (Private key - back this up to reuse on rebuild)"
echo "  - wstunnel.env       (wstunnel settings)"
echo "  - start-tunnel.sh    (run before connecting WireGuard)"
echo ""
echo "Usage:"
echo "  1. Import $WG_CONF into WireGuard app"
echo "  2. Run: $CONFIG_DIR/start-tunnel.sh"
echo "  3. Connect VPN in WireGuard app"
echo "  4. To disconnect: Turn off VPN in app, then Ctrl+C the script"
echo ""
echo "To reuse this key after server rebuild:"
echo "  $0 $CLIENT_NAME $CLIENT_IP $CONFIG_DIR $CLIENT_KEY_FILE"
echo ""

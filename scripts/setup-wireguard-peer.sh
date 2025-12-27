#!/bin/bash
set -euo pipefail

ROUTER_HOST="admin@192.168.99.1"
ROUTER_PORT="2200"
ROUTER_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p $ROUTER_PORT $ROUTER_HOST"

usage() {
    echo "Usage: $0 -h <host> -n <peer-name> [-i <interface>] [-a <client-ip>]"
    echo ""
    echo "Options:"
    echo "  -h <host>       SSH target (e.g., user@192.168.1.100)"
    echo "  -n <peer-name>  Name for the WireGuard peer"
    echo "  -i <interface>  RouterOS WireGuard interface (default: mgmt-vpn)"
    echo "  -a <client-ip>  Client IP address (auto-assigned if not specified)"
    echo ""
    echo "Available interfaces:"
    echo "  mgmt-vpn  - Management VPN (192.168.98.0/24, port 32820)"
    echo "  vpn       - Regular VPN (172.16.2.0/24, port 31820)"
    exit 1
}

get_next_ip() {
    local interface=$1
    local network prefix

    case $interface in
        mgmt-vpn)
            network="192.168.98"
            ;;
        vpn)
            network="172.16.2"
            ;;
        *)
            echo "Unknown interface: $interface" >&2
            exit 1
            ;;
    esac

    local used_ips
    used_ips=$($ROUTER_SSH "/interface/wireguard/peers/print where interface=$interface" | \
        grep -oE "allowed-address=[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | \
        cut -d= -f2 | cut -d. -f4 | sort -n)

    local next_ip=10
    for ip in $used_ips; do
        if [ "$ip" -ge "$next_ip" ]; then
            next_ip=$((ip + 1))
        fi
    done

    echo "${network}.${next_ip}"
}

get_interface_config() {
    local interface=$1
    case $interface in
        mgmt-vpn)
            echo "32820 192.168.98.1 vpn.rholden.me"
            ;;
        vpn)
            echo "31820 172.16.2.1 vpn.rholden.me"
            ;;
        *)
            echo "Unknown interface" >&2
            exit 1
            ;;
    esac
}

HOST=""
PEER_NAME=""
WG_INTERFACE="mgmt-vpn"
CLIENT_IP=""

while getopts "h:n:i:a:" opt; do
    case $opt in
        h) HOST=$OPTARG ;;
        n) PEER_NAME=$OPTARG ;;
        i) WG_INTERFACE=$OPTARG ;;
        a) CLIENT_IP=$OPTARG ;;
        *) usage ;;
    esac
done

if [ -z "$HOST" ] || [ -z "$PEER_NAME" ]; then
    usage
fi

echo "==> Checking router connectivity..."
if ! $ROUTER_SSH "/system/identity/print" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to router"
    exit 1
fi

echo "==> Checking if peer name already exists..."
if $ROUTER_SSH "/interface/wireguard/peers/print where name=$PEER_NAME" 2>/dev/null | grep -q "$PEER_NAME"; then
    echo "ERROR: Peer '$PEER_NAME' already exists"
    exit 1
fi

read -r PORT DNS ENDPOINT <<< "$(get_interface_config "$WG_INTERFACE")"

if [ -z "$CLIENT_IP" ]; then
    echo "==> Auto-assigning IP address..."
    CLIENT_IP=$(get_next_ip "$WG_INTERFACE")
fi
echo "    Client IP: $CLIENT_IP"

echo "==> Getting router public key..."
ROUTER_PUBKEY=$($ROUTER_SSH "/interface/wireguard/print where name=$WG_INTERFACE" | \
    grep -oE 'public-key="[^"]+"' | cut -d'"' -f2)
echo "    Router public key: $ROUTER_PUBKEY"

echo "==> Generating keys on target host..."
KEYS=$(ssh "$HOST" bash -c "'
    if ! command -v wg &> /dev/null; then
        echo ERROR: wireguard-tools not installed >&2
        exit 1
    fi
    PRIVKEY=\$(wg genkey)
    PUBKEY=\$(echo \$PRIVKEY | wg pubkey)
    PSK=\$(wg genpsk)
    echo \$PRIVKEY \$PUBKEY \$PSK
'")

read -r CLIENT_PRIVKEY CLIENT_PUBKEY PSK <<< "$KEYS"
echo "    Client public key: $CLIENT_PUBKEY"

WG_CONF="[Interface]
PrivateKey = $CLIENT_PRIVKEY
Address = $CLIENT_IP/32

[Peer]
PublicKey = $ROUTER_PUBKEY
PresharedKey = $PSK
Endpoint = $ENDPOINT:$PORT
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25"

echo "==> Creating WireGuard config on target host..."
ssh "$HOST" "sudo mkdir -p /etc/wireguard && echo '$WG_CONF' | sudo tee /etc/wireguard/wg0.conf > /dev/null && sudo chmod 600 /etc/wireguard/wg0.conf"

echo "==> Adding peer to router..."
$ROUTER_SSH "/interface/wireguard/peers/add interface=$WG_INTERFACE name=$PEER_NAME public-key=\"$CLIENT_PUBKEY\" preshared-key=\"$PSK\" allowed-address=$CLIENT_IP/32 client-address=$CLIENT_IP/32 client-dns=$DNS client-endpoint=$ENDPOINT client-keepalive=25s"

echo "==> Enabling WireGuard on target host..."
ssh "$HOST" "sudo systemctl enable --now wg-quick@wg0 2>/dev/null || sudo wg-quick up wg0 2>/dev/null || true"

echo ""
echo "==> Done!"
echo "    Peer '$PEER_NAME' added to $WG_INTERFACE"
echo "    Client IP: $CLIENT_IP"
echo ""
echo "    To check status on host: sudo wg show"
echo "    To restart: sudo systemctl restart wg-quick@wg0"

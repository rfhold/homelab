# Coturn TURN/STUN Server

Coturn is a free, open-source implementation of TURN (Traversal Using Relays around NAT) and STUN (Session Traversal Utilities for NAT) protocols. It serves as a VoIP media traffic NAT traversal server and gateway.

- STUN: Allows clients to discover their public IP address and NAT type
- TURN: Relays media traffic when direct peer-to-peer connections fail

## Use Cases

- WebRTC applications (video conferencing, voice calls, screen sharing)
- VoIP systems requiring NAT traversal
- Real-time multiplayer gaming
- IoT devices behind firewalls

## Installation

### Package Manager (Ubuntu/Debian)

```shell
sudo apt-get update
sudo apt-get install coturn
```

### Docker

Basic run:

```shell
docker run -d -p 3478:3478 -p 3478:3478/udp \
  -p 5349:5349 -p 5349:5349/udp \
  -p 49152-65535:49152-65535/udp \
  coturn/coturn
```

Host network mode (better performance):

```shell
docker run -d --network=host coturn/coturn
```

With custom configuration:

```shell
docker run -d --network=host \
  -v $(pwd)/turnserver.conf:/etc/coturn/turnserver.conf \
  coturn/coturn
```

## Port Requirements

- 3478 UDP/TCP: Standard STUN/TURN listener
- 5349 TCP: TLS/DTLS listener (TURNS)
- 443 TCP: Alternative TLS port (firewall-friendly)
- 49152-65535 UDP: Relay endpoints range

Firewall configuration:

```shell
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp
sudo ufw allow 49152:65535/udp
```

## Basic Configuration

Configuration file location: `/etc/turnserver.conf` or `/etc/coturn/turnserver.conf`

```ini
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=0.0.0.0
min-port=49152
max-port=65535
realm=example.com
server-name=turn.example.com
log-file=/var/log/turnserver/turn.log
verbose
```

### NAT/Cloud Configuration

For servers behind NAT (AWS EC2, GCP, etc.):

```ini
external-ip=203.0.113.10
```

Or with private IP mapping:

```ini
external-ip=203.0.113.10/10.0.0.5
```

## Authentication

### Long-term Credentials

```ini
lt-cred-mech
user=username:password
realm=example.com
```

### REST API / Time-limited Credentials

```ini
lt-cred-mech
use-auth-secret
static-auth-secret=your-secret-key-here
realm=example.com
```

Generate REST API credentials:

```shell
#!/bin/bash
SECRET="your-secret-key-here"
USERNAME=$(date +%s)":myuser"
PASSWORD=$(echo -n $USERNAME | openssl dgst -binary -sha1 -hmac $SECRET | base64)
echo "Username: $USERNAME"
echo "Password: $PASSWORD"
```

## TLS Configuration

```ini
cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
cipher-list="ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
no-tlsv1
no-tlsv1_1
```

## Security Hardening

```ini
fingerprint
stale-nonce=600
no-cli
no-loopback-peers
no-multicast-peers
no-tcp-relay

denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
```

## Production Configuration

```ini
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=0.0.0.0
external-ip=YOUR_PUBLIC_IP
min-port=49152
max-port=65535

lt-cred-mech
use-auth-secret
static-auth-secret=GENERATE_WITH_openssl_rand_-hex_32
realm=turn.example.com

cert=/etc/coturn/certs/fullchain.pem
pkey=/etc/coturn/certs/privkey.pem
cipher-list="ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
no-tlsv1
no-tlsv1_1

fingerprint
stale-nonce=600
no-cli
no-loopback-peers
no-multicast-peers
no-tcp-relay

denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=169.254.0.0-169.254.255.255

log-file=/var/log/turnserver/turn.log
simple-log
verbose
```

## Running as Systemd Service

```shell
sudo systemctl enable coturn
sudo systemctl start coturn
sudo systemctl status coturn
sudo journalctl -u coturn -f
```

Systemd override for production at `/etc/systemd/system/coturn.service.d/override.conf`:

```ini
[Service]
LimitNOFILE=1048576
AmbientCapabilities=CAP_NET_BIND_SERVICE
ExecStart=
ExecStart=/usr/bin/turnserver --daemon -c /etc/turnserver.conf --pidfile /run/turnserver/turnserver.pid --no-stdout-log --simple-log --log-file /var/log/turnserver/turnserver.log
Restart=always
```

## Docker Compose

```yaml
services:
  coturn:
    image: coturn/coturn:latest
    container_name: coturn
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./config/turnserver.conf:/etc/coturn/turnserver.conf:ro
      - ./certs:/etc/coturn/certs:ro
      - ./logs:/var/log/turnserver
    environment:
      - DETECT_EXTERNAL_IP=yes
      - DETECT_RELAY_IP=yes
```

## Performance Tuning

### File Descriptor Limits

Each TURN allocation uses at least 1 file descriptor. Add to `/etc/security/limits.conf`:

```
turnserver soft nofile 1048576
turnserver hard nofile 1048576
```

Or via systemd:

```ini
[Service]
LimitNOFILE=1048576
```

### Threading

```ini
relay-threads=0
cpus=4
```

### Bandwidth Limits

```ini
max-bps=0
bps-capacity=0
user-quota=0
total-quota=0
```

## Load Balancing

### ALTERNATE-SERVER Mechanism

```ini
alternate-server=turn1.example.com:3478
alternate-server=turn2.example.com:3478
tls-alternate-server=turn1.example.com:5349
tls-alternate-server=turn2.example.com:5349
```

## Testing

### Trickle ICE Tool

Visit https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ and add:

- STUN: `stun:turn.example.com:3478`
- TURN: `turn:turn.example.com:3478` (with credentials)
- TURNS: `turns:turn.example.com:5349` (with credentials)

Success indicators:

- `srflx` candidate = STUN working
- `relay` candidate = TURN working

### Command-line Testing

Test STUN:

```shell
stunclient --mode full --localport 30000 turn.example.com 3478
```

Test TURN:

```shell
turnutils_uclient -u username -w password -m 10 -l 170 -p 3478 turn.example.com
```

Test TLS:

```shell
openssl s_client -connect turn.example.com:5349 -alpn "stun.turn" -servername turn.example.com </dev/null
```

### Firefox Debug

1. Open `about:config`
2. Set `media.peerconnection.ice.relay_only` to `true`
3. Test WebRTC application
4. Check `about:webrtc` for connection details

## WebRTC Client Configuration

```javascript
const configuration = {
  iceServers: [
    {
      urls: "stun:turn.example.com:3478"
    },
    {
      urls: "turn:turn.example.com:3478",
      username: "timestamp:userid",
      credential: "base64-hmac-password"
    },
    {
      urls: "turns:turn.example.com:5349",
      username: "timestamp:userid",
      credential: "base64-hmac-password"
    }
  ]
};

const peerConnection = new RTCPeerConnection(configuration);
```

## Common Issues

### Too many open files

Increase file descriptor limits in systemd or `/etc/security/limits.conf`.

### Clients can't connect through restrictive firewalls

Use port 443 for TURNS:

```ini
tls-listening-port=443
```

### WebRTC clients getting 401 errors

Check authentication configuration:

```ini
lt-cred-mech
use-auth-secret
static-auth-secret=your-secret
realm=your-realm.com
```

### Server behind NAT not working

Configure external-ip:

```ini
external-ip=PUBLIC_IP/PRIVATE_IP
```

### High CPU usage

Reduce relay port range, use relay-threads=0 with multiple instances.

## Quick Start Checklist

1. Deploy with Docker host networking or systemd
2. Configure realm, external-ip, authentication
3. Set up TLS certificates, disable TLS 1.0/1.1, deny private IPs
4. Open firewall ports: 3478 (UDP/TCP), 5349 (TCP), relay range (UDP)
5. Test with Trickle ICE or turnutils_uclient
6. Enable verbose logging initially, then reduce

## References

- Official repository: https://github.com/coturn/coturn
- Configuration reference: https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf
- Docker deployment: https://github.com/coturn/coturn/blob/master/docker/coturn/README.md
- Performance tuning: https://github.com/coturn/coturn/wiki/TURN-Performance-and-Load-Balance
- Testing tool: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

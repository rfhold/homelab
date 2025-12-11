# Technitium DNS Server

Technitium DNS Server is an open-source authoritative and recursive DNS server with a web-based admin console.

## Key Features

- Cross-platform (.NET 9): Windows, Linux, macOS, Raspberry Pi
- Official Docker image: `technitium/dns-server`
- Built-in DHCP server
- Supports DNS-over-TLS, DNS-over-HTTPS, DNS-over-QUIC
- DNSSEC validation and signing
- HTTP API for automation

## Docker Deployment

### Basic Configuration

```yaml
services:
  dns-server:
    container_name: dns-server
    hostname: dns-server
    image: technitium/dns-server:latest
    ports:
      - "5380:5380/tcp"   # DNS web console (HTTP)
      - "53:53/udp"       # DNS service
      - "53:53/tcp"       # DNS service
    environment:
      - DNS_SERVER_DOMAIN=dns-server
      - DNS_SERVER_ADMIN_PASSWORD=password
    volumes:
      - config:/etc/dns
    restart: unless-stopped
    sysctls:
      - net.ipv4.ip_local_port_range=1024 65535

volumes:
  config:
```

### Host Network Mode (Required for DHCP)

```yaml
services:
  dns-server:
    container_name: dns-server
    hostname: dns-server
    image: technitium/dns-server:latest
    network_mode: "host"
    environment:
      - DNS_SERVER_DOMAIN=dns01.home.arpa
      - DNS_SERVER_ADMIN_PASSWORD=password
    volumes:
      - /local/data/path:/etc/dns
    restart: unless-stopped
```

### Environment Variables

- DNS_SERVER_DOMAIN: Primary domain name for the DNS server
- DNS_SERVER_ADMIN_PASSWORD: Admin console password
- DNS_SERVER_RECURSION: Recursion policy (AllowOnlyForPrivateNetworks, Allow, Deny)
- DNS_SERVER_FORWARDERS: Comma-separated forwarder IPs
- DNS_SERVER_FORWARDER_PROTOCOL: Protocol for forwarders (Udp, Tcp, Tls, Https)

## Clustering with Catalog Zones

Technitium DNS Server v13+ supports Catalog Zones (RFC 9432) for automatic provisioning of secondary zones.

### Primary Server Setup

1. Create TSIG key for secure zone transfers:
   - Settings -> TSIG -> Add
   - Key Name: catalog.home.arpa
   - Shared Secret: auto-generate or specify
   - Algorithm: HMAC-SHA256

2. Create Catalog Zone:
   - Zones -> Add Zone
   - Domain: catalog.home.arpa
   - Type: Catalog Zone

3. Configure Zone Transfer:
   - Zone Options -> Zone Transfer
   - Select "Use Specified Network Access Control List (ACL)"
   - Add secondary server IP addresses
   - Set Zone Transfer TSIG Key Names

4. Configure Notify:
   - Zone Options -> Notify
   - Select "Specified Name Servers"
   - Add secondary server IP addresses

### Secondary Server Setup

1. Add same TSIG key configuration as primary

2. Create Secondary Catalog Zone:
   - Zones -> Add Zone
   - Domain: same as primary catalog zone
   - Type: Secondary Catalog Zone
   - Primary Name Server Addresses: Primary server IP
   - Select TSIG Key Name

### Adding Zones to Cluster

On the primary server, for any Primary zone:

1. Open Zone Options
2. In General section, select the Catalog Zone from dropdown
3. Secondary zones auto-provision on secondary servers

### Zone Transfer Protocols

- AXFR (full zone transfer)
- IXFR (incremental zone transfer)
- DNS NOTIFY for real-time sync
- XFR-over-TLS and XFR-over-QUIC for encrypted transfers
- TSIG authentication for secure transfers

## External DNS Integration

### Forwarders

Configure upstream resolvers with encrypted protocols via environment variables:

```bash
DNS_SERVER_FORWARDERS=1.1.1.1, 8.8.8.8
DNS_SERVER_FORWARDER_PROTOCOL=Tls
```

Common encrypted forwarder addresses:

- Cloudflare DoT: 1.1.1.1:853
- Cloudflare DoH: https://cloudflare-dns.com/dns-query
- Google DoT: 8.8.8.8:853
- Google DoH: https://dns.google/dns-query
- Quad9 DoT: 9.9.9.9:853

### Conditional Forwarding

Route specific domains to different DNS servers:

1. Zones -> Add Zone
2. Type: Conditional Forwarder Zone
3. Domain: internal.company.com
4. Forwarder addresses: IP of internal DNS server

### Recursion Control

Control which clients can use recursive resolution:

```bash
DNS_SERVER_RECURSION=AllowOnlyForPrivateNetworks
DNS_SERVER_RECURSION_NETWORK_ACL=192.168.10.0/24, !192.168.10.2
```

## API-Based Sync

For simpler setups without Catalog Zones, use API-based backup/restore sync.

### Create API Token

1. Administration -> Sessions -> Create Token
2. Name the token (e.g., backup_script)
3. Save the token securely

### Sync Script

```bash
#!/bin/bash
set -euxo pipefail

src_dns_server='192.168.100.5'
dst_dns_server='192.168.100.6'
src_dns_serverdomain='dns01.home.arpa'
dst_dns_serverdomain='dns02.home.arpa'
src_dns_token='SOURCE_TOKEN'
dst_dns_token='DEST_TOKEN'
backup_file="technitium-backup.zip"

# Check primary server health
status_code=$(curl --write-out %{http_code} --silent --output /dev/null http://$src_dns_server:5380)
if [[ "$status_code" -ne 200 ]]; then
  echo "Primary DNS server unavailable"
  exit 1
fi

# Backup from primary
curl -s "http://$src_dns_server:5380/api/settings/backup?token=$src_dns_token&blockLists=true&logs=false&scopes=true&stats=false&zones=true&allowedZones=true&blockedZones=true&dnsSettings=true&logSettings=true&authConfig=true&apps=true" -o $backup_file

# Restore to secondary
curl -s --form file="@$backup_file" "http://$dst_dns_server:5380/api/settings/restore?token=$dst_dns_token&blockLists=true&logs=true&scopes=true&stats=true&apps=true&zones=true&allowedZones=true&blockedZones=true&dnsSettings=true&logSettings=true&deleteExistingFiles=true&authConfig=true" --output /dev/null

sleep 10

# Update server domain on secondary
curl -X POST "http://$dst_dns_server:5380/api/settings/set?token=$dst_dns_token&dnsServerDomain=$dst_dns_serverdomain"

# Disable DHCP on secondary (prevent conflicts)
curl -X POST "http://$dst_dns_server:5380/api/dhcp/scopes/disable?token=$dst_dns_token&name=local-home"

rm -rf $backup_file
```

### Schedule with Cron

```bash
00 */12 * * * /root/technitium-sync.sh
```

## Best Practices

### Zone Replication

- Use Catalog Zones (v13+) for automatic secondary zone provisioning
- Configure TSIG for all zone transfers
- Set up DNS NOTIFY for real-time sync

### High Availability

- Deploy minimum 2 instances (primary + secondary)
- Configure both in DHCP scope as DNS servers
- Use Catalog Zones for zone replication OR API-based sync for config replication
- Disable DHCP on secondary to prevent conflicts

### Forwarders

- Use encrypted protocols (DoT/DoH/DoQ) for privacy
- Configure multiple forwarders for redundancy
- Use Conditional Forwarder zones for internal domains

### Docker

- Use bind mounts for persistent config (/etc/dns)
- Use network_mode: host if DHCP is needed
- Set DNS_SERVER_ADMIN_PASSWORD on first run

## References

- GitHub Repository: https://github.com/TechnitiumSoftware/DnsServer
- Catalog Zones Blog: https://blog.technitium.com/2024/10/how-to-configure-catalog-zones-for.html
- API Documentation: https://github.com/TechnitiumSoftware/DnsServer/blob/master/APIDOCS.md
- Docker Environment Variables: https://github.com/TechnitiumSoftware/DnsServer/blob/master/DockerEnvironmentVariables.md

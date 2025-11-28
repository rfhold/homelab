# TP-Link Omada Controller Container Deployment

## Overview

TP-Link Omada Controller is a Software-Defined Networking (SDN) management platform for centrally managing TP-Link Omada hardware including Access Points (EAPs), JetStream Switches, Omada Gateways/Routers, and OLT devices.

The controller provides unified management, multi-site capabilities, guest portal functionality, network monitoring, firmware management, and client device management. A single Omada Software Controller v5.4.6+ can manage up to 10,000 devices.

## Container Image

The recommended Docker image is `mbentley/omada-controller` - the de facto community standard with 1,000+ GitHub stars and active maintenance.

Image tags:

- `6.0`, `6` - Latest v6 (6.0.0.24, requires MongoDB 8)
- `latest`, `5.15`, `5` - Stable v5 release (5.15.24.19)
- `*-openj9` - OpenJ9 JVM variants

Do NOT use the `latest` tag in production - use explicit major.minor tags (e.g., `6.0`) to avoid unexpected upgrades.

Version 6.0+ requires MongoDB 8, which requires AVX instructions on amd64 or armv8.2-a on arm64.

## System Requirements

For small home/lab deployments (< 50 devices):

- Minimum: 2 vCPU, 1-2 GB RAM, 5 GB disk
- Recommended: 4 vCPU, 4 GB RAM, 20 GB disk

For larger deployments:

- 500 devices: 4 vCPU, 6 GB RAM, 50 GB disk
- 1,500 devices: 8 vCPU, 8 GB RAM, 100 GB disk
- 3,000 devices: 16 vCPU, 16 GB RAM, 150 GB disk
- 10,000 devices: 64 vCPU, 64 GB RAM, 500 GB disk

SSD storage is highly recommended for database performance.

## Required Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 8088 | TCP | HTTP management portal |
| 8043 | TCP | HTTPS management portal (primary) |
| 8843 | TCP | HTTPS captive portal |
| 27001 | UDP | Omada App discovery |
| 29810 | UDP | Device discovery |
| 29811 | TCP | Device management (v4 firmware) |
| 29812 | TCP | Device adoption (v4 firmware) |
| 29813 | TCP | Device firmware upgrade (v4 firmware) |
| 29814 | TCP | Device management (v5+ firmware) |
| 29815 | TCP | Device info/packet capture (v5.9+) |
| 29816 | TCP | Remote terminal (RTTY) (v5.9+) |
| 29817 | TCP | Device monitoring (v6.0+) |
| 19810 | UDP | OLT device discovery |

## Network Configuration

For Kubernetes deployments with LoadBalancer support, use a LoadBalancer service exposing both TCP and UDP ports. Devices will not auto-discover the controller via broadcast, so you must configure device adoption using either the Omada Discovery Utility or Controller Inform URL.

Required port mappings:

```yaml
ports:
  - 8088:8088      # HTTP management
  - 8043:8043      # HTTPS management
  - 8843:8843      # HTTPS captive portal
  - 19810:19810/udp # OLT discovery
  - 27001:27001/udp # App discovery
  - 29810:29810/udp # Device discovery
  - 29811-29817:29811-29817 # Device management
```

Ensure your LoadBalancer supports UDP protocols for the discovery ports.

## Persistent Volumes

| Volume Mount | Container Path | Purpose |
|--------------|----------------|---------|
| omada-data | /opt/tplink/EAPController/data | Database, settings, configuration |
| omada-logs | /opt/tplink/EAPController/logs | Application and MongoDB logs |

## Environment Variables

Essential:

- TZ: Timezone (e.g., America/New_York)
- PUID: Process user ID (default: 508)
- PGID: Process group ID (default: 508)

Ports (all have sensible defaults):

- MANAGE_HTTP_PORT: 8088
- MANAGE_HTTPS_PORT: 8043
- PORTAL_HTTP_PORT: 8088
- PORTAL_HTTPS_PORT: 8843
- PORT_DISCOVERY: 29810
- PORT_APP_DISCOVERY: 27001
- PORT_MANAGER_V1: 29811
- PORT_ADOPT_V1: 29812
- PORT_UPGRADE_V1: 29813
- PORT_MANAGER_V2: 29814
- PORT_TRANSFER_V2: 29815
- PORT_RTTY: 29816
- PORT_DEVICE_MONITOR: 29817

Advanced:

- SHOW_SERVER_LOGS: true (output server logs to stdout)
- SHOW_MONGODB_LOGS: false (output MongoDB logs to stdout)
- SSL_CERT_NAME: tls.crt
- SSL_KEY_NAME: tls.key
- ROOTLESS: false (run in rootless mode)

## Kubernetes Deployment

```shell
helm install omada-controller oci://registry-1.docker.io/mbentley/omada-controller-helm
```

Example values.yaml for LoadBalancer with MetalLB:

```yaml
service:
  type: LoadBalancer
  annotations:
    metallb.io/loadBalancerIPs: 192.168.1.20

persistence:
  data:
    size: 5Gi
    storageClassName: local-path
  logs:
    size: 2Gi
    storageClassName: local-path

config:
  timezone: America/New_York
  rootless: true

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi
```

Kubernetes considerations:

- Ensure LoadBalancer supports both TCP and UDP
- UDP ports (27001, 29810, 19810) are critical for discovery
- The startupProbe has a 5-minute timeout for first boot
- Use rootless: true for environments that block root containers

## Device Adoption

Devices cannot auto-discover the controller via broadcast when running in Kubernetes. Use one of these methods:

### Omada Discovery Utility (Recommended for Initial Setup)

1. Install Omada Discovery Utility on a computer in the same network as devices
2. Select discovered devices
3. Click "Batch Setting"
4. Enter Controller Hostname/IP (LoadBalancer IP)
5. Enter device credentials (default: admin/admin)
6. Click Apply

### Controller Inform URL (Per-Device)

Configure on each device's standalone web interface:

- Routers/Gateways: System > Controller Settings
- Switches: System > Controller Settings
- EAPs: System Tools > Controller Settings

Set the Inform URL to: `http://<loadbalancer-ip>:29810/inform`

## SSL/HTTPS Configuration

By default, Omada Controller uses self-signed certificates generated at first startup.

For custom certificates:

1. Mount certificates to /cert in the container:

```yaml
volumes:
  - /path/to/certs:/cert:ro
```

2. Place files named tls.crt (full certificate chain) and tls.key (private key) in the directory

3. Optionally customize filenames via environment variables:

```yaml
environment:
  - SSL_CERT_NAME=custom.crt
  - SSL_KEY_NAME=custom.key
```

## Backup and Restore

### Controller's Built-in Backup (Recommended)

1. Navigate to Settings > Maintenance > Backup
2. Configure Auto Backup for scheduled backups
3. Download manual backups before upgrades

### Manual Data Backup

1. Stop the container cleanly (critical to prevent corruption):

```shell
docker stop -t 60 omada-controller
```

2. Backup the data volume:

```shell
tar -czvf omada-backup-$(date +%Y%m%d).tar.gz /path/to/omada/data
```

3. Restart the container

### Restore Process

1. Create a fresh controller with new persistent volumes
2. Access the setup wizard
3. Restore from backup file during setup

## Common Issues and Solutions

### MongoDB Corruption

Cause: Container killed without clean shutdown

Prevention: Always use adequate stop timeout:

```shell
docker stop -t 60 omada-controller
```

Or in compose:

```yaml
stop_grace_period: 60s
```

### Devices Fail to Adopt

Cause: Controller not reachable or devices not configured with controller address

Solution: Configure devices using Omada Discovery Utility or Controller Inform URL pointing to the LoadBalancer IP

### Blank Page After Port Changes

Cause: Port environment variables don't match port mappings

Solution: Ensure internal ports match external ports. If you map -p 9043:8043, you MUST also set MANAGE_HTTPS_PORT=9043

### v6 Controller Won't Start (AVX/ARM Issues)

Cause: MongoDB 8 requires AVX (amd64) or armv8.2-a (arm64)

Solutions:

- Use external MongoDB without AVX requirement
- For Proxmox: Change CPU model to expose AVX instructions
- Use v5.15 on older hardware

### Controller Takes Long Time to Start

Normal Behavior: First startup can take 5+ minutes

## Best Practices

Networking:

- Use LoadBalancer service with TCP and UDP support
- Configure device adoption via Discovery Utility or Inform URL before deploying devices
- Ensure UDP ports (27001, 29810, 19810) are exposed on the LoadBalancer

Storage:

- Use bind mounts (not Docker volumes) for data directory for easier backup access
- Use SSD storage for the MongoDB database
- Allocate sufficient disk space for logs and backups

Container Management:

- Never use latest tag - use explicit version tags (e.g., 6.0)
- Always use stop_grace_period: 60s or longer
- Set ulimits.nofile to 4096/8192 as shown in examples

Backups:

- Enable Auto Backup in controller settings
- Take a manual backup before every upgrade
- Test backup restoration periodically

Security:

- Use custom SSL certificates in production
- Restrict management port access via firewall
- Consider running rootless (ROOTLESS=true) in Kubernetes
- Change default device credentials (admin/admin) after adoption

## References

- mbentley/docker-omada-controller GitHub: https://github.com/mbentley/docker-omada-controller
- mbentley/omada-controller Docker Hub: https://hub.docker.com/r/mbentley/omada-controller
- Helm Chart: https://github.com/mbentley/docker-omada-controller/blob/master/helm/omada-controller-helm/README.md
- TP-Link FAQ #3281 (Ports v5+): https://www.tp-link.com/us/support/faq/3281/
- TP-Link FAQ #2967 (System Requirements): https://www.tp-link.com/us/support/faq/2967/
- TP-Link FAQ #3087 (Remote Adoption): https://www.tp-link.com/us/support/faq/3087/

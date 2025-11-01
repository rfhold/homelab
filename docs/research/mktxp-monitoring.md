# MKTXP - MikroTik Monitoring with Prometheus

## Overview

**MKTXP** (MikroTik eXporter for Prometheus) is a comprehensive Prometheus exporter for MikroTik RouterOS devices. It collects and exports a rich set of metrics from multiple RouterOS devices, making them available for monitoring in Prometheus and visualization in Grafana.

### Core Functionality

- **Multi-router Support**: Monitor multiple MikroTik devices from a single exporter instance
- **Rich Metrics Collection**: Comprehensive metrics covering all aspects of RouterOS
- **API-based Collection**: Uses RouterOS API for reliable data collection
- **Efficient Processing**: Supports parallel fetching and connection pooling
- **DHCP Resolution**: Automatic IP address resolution with local and remote DHCP servers
- **Custom Labels**: Injectable labels for device grouping and organization

## Architecture

### System Requirements

- **Supported Operating Systems**:
  - Linux (recommended for production)
  - macOS
  - FreeBSD
  - Runs in Docker containers (Alpine Linux-based)

- **Dependencies**:
  - Python 3.8+
  - RouterOS API access
  - Network connectivity to MikroTik devices

### Connection Architecture

```
MikroTik Devices --> RouterOS API (Port 8728/8729) --> MKTXP Exporter --> Prometheus (Port 49090)
                                                                      --> Grafana Dashboards
```

### Ports and Protocols

- **RouterOS API**: Port 8728 (plain), 8729 (SSL)
- **MKTXP HTTP Endpoint**: Port 49090 (configurable)
- **Protocol**: Uses RouterOS API protocol over TCP
- **Authentication**: Username/password with API permissions

## Container Deployment

### Official Docker Image

```bash
# Official image from GitHub Container Registry
docker pull ghcr.io/akpw/mktxp:latest
```

### Image Details

- **Base**: Python 3 Alpine Linux (lightweight)
- **Size**: ~100MB
- **User**: Runs as non-root `mktxp` user
- **Entrypoint**: `/usr/local/bin/mktxp export`

### Environment Variables

```yaml
PYTHONUNBUFFERED: "1"  # For proper logging output
```

### Volume Mounts

```yaml
volumes:
  - ./mktxp:/home/mktxp/mktxp  # Configuration directory
```

## Configuration

### Main Configuration File (mktxp.conf)

```ini
[Router-Name]
    enabled = True                  # Enable/disable this router
    hostname = 192.168.1.1         # RouterOS IP address
    port = 8728                    # API port (8728 plain, 8729 SSL)
    
    # Authentication
    username = mktxp_user          # RouterOS API user
    password = mktxp_password      # User password
    credentials_file = ""          # Optional YAML credentials file
    
    # SSL Configuration
    use_ssl = False                # Use API-SSL service
    no_ssl_certificate = False     # Connect without certificate
    ssl_certificate_verify = False # Verify SSL certificate
    ssl_check_hostname = True      # Verify hostname matches cert
    ssl_ca_file = ""              # CA file path (empty = system store)
    
    # Custom Labels (injected into all metrics)
    custom_labels = dc:homelab, rack:luna, environment:prod
    
    # Feature Toggles - Core Metrics
    health = True                  # System health (temperature, voltage, fans)
    installed_packages = True      # Installed packages info
    interface = True               # Interface traffic metrics
    route = True                   # IPv4 routing table
    pool = True                    # IP pool usage
    firewall = True                # Firewall rules traffic
    neighbor = True                # ARP neighbors
    dns = True                     # DNS statistics
    
    # DHCP Metrics
    dhcp = True                    # DHCP server statistics
    dhcp_lease = True             # DHCP lease details
    
    # Connection Metrics
    connections = True             # Connection tracking
    connection_stats = False       # Detailed connection statistics
    
    # Wireless Metrics
    wireless = True                # WLAN statistics
    wireless_clients = True        # Connected clients
    capsman = True                 # CAPsMAN controller
    capsman_clients = True         # CAPsMAN client details
    w60g = False                   # 60GHz wireless
    
    # Network Services
    poe = True                     # PoE statistics
    monitor = True                 # Interface monitor
    netwatch = True               # Netwatch results
    public_ip = True              # Public IP detection
    
    # VPN and Tunnels
    ipsec = False                  # IPSec peers
    eoip = False                   # EoIP tunnels
    gre = False                    # GRE tunnels
    ipip = False                   # IPIP tunnels
    
    # Advanced Features
    lte = False                    # LTE modem metrics
    switch_port = False            # Switch port statistics
    user = True                    # Active users
    queue = True                   # Queue statistics
    bgp = False                    # BGP sessions
    bfd = False                    # BFD sessions
    routing_stats = False          # Routing process stats
    certificate = False            # Certificate expiry
    container = False              # Container metrics
    
    # Kid Control
    kid_control_assigned = False   # Devices with assigned users
    kid_control_dynamic = False    # All connected devices
    
    # Address Lists
    address_list = blocklist,allowlist     # IPv4 address lists to monitor
    ipv6_address_list = ipv6_blocklist    # IPv6 address lists
    
    # Remote Resolution
    remote_dhcp_entry = None       # Remote DHCP server entry
    remote_capsman_entry = None    # Remote CAPsMAN entry
    
    # Display Options
    use_comments_over_names = True # Prefer interface comments
    check_for_updates = False      # Check for RouterOS updates

[default]
    # Default settings for all routers
    # Individual router entries override these
```

### System Configuration (_mktxp.conf)

```ini
[MKTXP]
    listen = '0.0.0.0:49090'              # Listen address(es)
    socket_timeout = 2                     # Connection timeout
    
    # Failure handling
    initial_delay_on_failure = 120        # Initial retry delay
    max_delay_on_failure = 900            # Maximum retry delay
    delay_inc_div = 5                     # Delay increment divisor
    
    # Performance
    fetch_routers_in_parallel = True      # Parallel fetching
    max_worker_threads = 5                # Worker thread limit
    max_scrape_duration = 10              # Per-router timeout
    total_max_scrape_duration = 30        # Total scrape timeout
    minimal_collect_interval = 5          # Minimum interval
    
    # Connection Management
    persistent_router_connection_pool = True  # Keep connections alive
    persistent_dhcp_cache = True              # Cache DHCP data
    
    # Bandwidth Testing
    bandwidth = False                      # Enable bandwidth tests
    bandwidth_test_interval = 600         # Test interval (seconds)
    
    # Output
    verbose_mode = False                   # Debug logging
    compact_default_conf_values = False   # Compact config format
    prometheus_headers_deduplication = False  # Deduplicate headers
```

## MikroTik RouterOS Configuration

### Create API User

```routeros
# Create group with minimal permissions
/user group add name=mktxp_group policy=api,read

# Create user
/user add name=mktxp_user group=mktxp_group password=SecurePassword123

# For LTE metrics on RouterOS v6, add test permission
/user group set mktxp_group policy=api,read,test
```

### Enable API Service

```routeros
# Enable API service (if not already enabled)
/ip service enable api

# For SSL API (recommended)
/ip service enable api-ssl
/ip service set api-ssl certificate=your-certificate
```

### Firewall Rules (if needed)

```routeros
# Allow API access from MKTXP host
/ip firewall filter add chain=input protocol=tcp dst-port=8728 \
    src-address=<mktxp-host-ip> action=accept \
    comment="Allow MKTXP API access" place-before=1
```

## Kubernetes Deployment for Luna Node

### ConfigMap for Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mktxp-config
  namespace: monitoring
data:
  mktxp.conf: |
    [MikroTik-Main]
        enabled = True
        hostname = 192.168.1.1
        port = 8728
        username = mktxp_user
        password = ${MKTXP_PASSWORD}  # Use secret reference
        custom_labels = location:homelab, node:luna
        
        # Core metrics
        health = True
        interface = True
        dhcp = True
        dhcp_lease = True
        connections = True
        firewall = True
        
        # Wireless
        wireless = True
        wireless_clients = True
        capsman = True
        capsman_clients = True
        
        # Additional metrics as needed
        public_ip = True
        dns = True
        netwatch = True

  _mktxp.conf: |
    [MKTXP]
        listen = '0.0.0.0:49090'
        fetch_routers_in_parallel = True
        max_worker_threads = 3
        persistent_router_connection_pool = True
        verbose_mode = False
```

### Secret for Credentials

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mktxp-credentials
  namespace: monitoring
type: Opaque
stringData:
  MKTXP_PASSWORD: "your-secure-password"
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mktxp-exporter
  namespace: monitoring
  labels:
    app: mktxp-exporter
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mktxp-exporter
  template:
    metadata:
      labels:
        app: mktxp-exporter
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "49090"
        prometheus.io/path: "/metrics"
    spec:
      nodeSelector:
        kubernetes.io/hostname: luna  # Pin to luna node
      containers:
      - name: mktxp
        image: ghcr.io/akpw/mktxp:latest
        imagePullPolicy: IfNotPresent
        ports:
        - name: metrics
          containerPort: 49090
          protocol: TCP
        env:
        - name: PYTHONUNBUFFERED
          value: "1"
        envFrom:
        - secretRef:
            name: mktxp-credentials
        volumeMounts:
        - name: config
          mountPath: /home/mktxp/mktxp
          readOnly: true
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /metrics
            port: metrics
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /metrics
            port: metrics
          initialDelaySeconds: 10
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: mktxp-config
          items:
          - key: mktxp.conf
            path: mktxp.conf
          - key: _mktxp.conf
            path: _mktxp.conf
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mktxp-exporter
  namespace: monitoring
  labels:
    app: mktxp-exporter
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "49090"
spec:
  type: ClusterIP
  ports:
  - name: metrics
    port: 49090
    targetPort: 49090
    protocol: TCP
  selector:
    app: mktxp-exporter
```

### ServiceMonitor for Prometheus Operator

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: mktxp-exporter
  namespace: monitoring
  labels:
    app: mktxp-exporter
spec:
  selector:
    matchLabels:
      app: mktxp-exporter
  endpoints:
  - port: metrics
    interval: 30s
    scrapeTimeout: 20s
    path: /metrics
```

## Metrics Exported

### System Metrics
- **Identity**: RouterBoard model, version, uptime
- **System Resources**: CPU, memory, disk usage
- **Health**: Temperature, voltage, fan speeds
- **Packages**: Installed packages and versions

### Network Metrics
- **Interfaces**: Traffic (bytes/packets), errors, drops
- **Connections**: Active connections, NAT stats
- **Firewall**: Rule hit counts, traffic stats
- **Routes**: Routing table entries
- **Neighbors**: ARP/IPv6 neighbor table

### DHCP Metrics
- **Server Stats**: Leases, pools usage
- **Lease Details**: Client info, expiry times

### Wireless Metrics
- **AP Stats**: Channel, frequency, noise floor
- **Client Info**: Signal strength, rates, uptime
- **CAPsMAN**: Managed APs and clients

### Service Metrics
- **DNS**: Query stats, cache hits
- **Netwatch**: Host availability
- **POE**: Power consumption per port
- **Queues**: Traffic shaping stats

### VPN/Tunnel Metrics
- **IPSec**: Active peers, traffic
- **GRE/EoIP/IPIP**: Tunnel status

## Prometheus Integration

### Scrape Configuration

```yaml
scrape_configs:
  - job_name: 'mktxp'
    static_configs:
      - targets: ['mktxp-exporter.monitoring:49090']
    scrape_interval: 30s
    scrape_timeout: 20s
    metrics_path: /metrics
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: mikrotik-main
```

### Example Queries

```promql
# CPU Usage
mktxp_system_cpu_load{routerboard_name="MikroTik-Main"}

# Interface Traffic Rate
rate(mktxp_interface_rx_byte[5m])

# DHCP Leases Count
mktxp_dhcp_leases_count

# Wireless Clients
mktxp_wlan_clients_count

# Temperature
mktxp_health_temperature

# Memory Usage
mktxp_system_memory_usage_percentage
```

## Grafana Dashboards

### Official Dashboard
- **Dashboard ID**: 13679
- **Name**: Mikrotik MKTXP Exporter
- **URL**: https://grafana.com/grafana/dashboards/13679

### Dashboard Features
- System overview with health metrics
- Network interface statistics
- Wireless and CAPsMAN monitoring
- DHCP lease tracking
- Firewall and connection stats
- Queue and bandwidth monitoring
- Historical trends and alerts

### Import Dashboard

```bash
# Via Grafana UI
1. Go to Dashboards → Import
2. Enter ID: 13679
3. Select Prometheus datasource
4. Click Import

# Via API
curl -X POST http://grafana:3000/api/dashboards/import \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard": {
      "id": 13679
    },
    "overwrite": true,
    "inputs": [{
      "name": "DS_PROMETHEUS",
      "type": "datasource",
      "pluginId": "prometheus",
      "value": "Prometheus"
    }]
  }'
```

## Best Practices

### Security
1. **Use dedicated API user** with minimal permissions
2. **Enable SSL API** for encrypted communication
3. **Restrict API access** via firewall rules
4. **Store credentials** in Kubernetes secrets
5. **Rotate passwords** regularly

### Performance
1. **Enable parallel fetching** for multiple routers
2. **Use connection pooling** to reduce overhead
3. **Adjust scrape intervals** based on needs
4. **Monitor scrape duration** metrics
5. **Limit concurrent connections** to prevent overload

### Monitoring
1. **Start with essential metrics** and expand gradually
2. **Use custom labels** for device organization
3. **Set up alerting** for critical metrics
4. **Monitor exporter health** via Prometheus
5. **Regular dashboard reviews** for optimization

### High Availability
1. **Single instance** is usually sufficient
2. **Use persistent storage** for cache if needed
3. **Configure proper health checks**
4. **Set resource limits** to prevent resource exhaustion
5. **Monitor scrape failures** and adjust timeouts

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify RouterOS API is enabled
   - Check firewall rules
   - Confirm credentials are correct
   - Test with RouterOS API tools

2. **Slow Scrapes**
   - Enable parallel fetching
   - Reduce metrics scope
   - Check network latency
   - Increase timeout values

3. **Missing Metrics**
   - Verify feature is enabled in config
   - Check RouterOS version compatibility
   - Ensure user has required permissions
   - Review verbose logs

4. **High Memory Usage**
   - Limit concurrent connections
   - Reduce metrics retention
   - Disable unused collectors
   - Check for memory leaks

### Debug Mode

```yaml
# Enable verbose logging
[MKTXP]
    verbose_mode = True

# Check logs
kubectl logs -f deployment/mktxp-exporter -n monitoring

# Test connection from CLI
docker run --rm -it \
  -v ./mktxp:/home/mktxp/mktxp \
  ghcr.io/akpw/mktxp:latest \
  mktxp print -en MikroTik-Main
```

## Complete Stack with MKTXP-Stack

For a complete monitoring solution with log aggregation:

### Docker Compose Stack

```yaml
version: '3.8'

services:
  mktxp:
    image: ghcr.io/akpw/mktxp:latest
    container_name: mktxp
    volumes:
      - ./mktxp:/home/mktxp/mktxp
    ports:
      - "49090:49090"
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3000:3000"
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "3100:3100"
    volumes:
      - ./loki/loki-config.yml:/etc/loki/loki-config.yml
    command: -config.file=/etc/loki/loki-config.yml
    restart: unless-stopped

  syslog-ng:
    image: balabit/syslog-ng:latest
    container_name: syslog-ng
    ports:
      - "514:514/udp"
      - "601:601/tcp"
    volumes:
      - ./syslog-ng/syslog-ng.conf:/etc/syslog-ng/syslog-ng.conf
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
```

### MikroTik Syslog Configuration

```routeros
# Configure remote syslog
/system logging action
add name=remote target=remote remote=<docker-host-ip> \
    remote-port=514 bsd-syslog=yes syslog-facility=local0

# Send logs to remote syslog
/system logging
add action=remote topics=info prefix=":Info"
add action=remote topics=error prefix=":Error"
add action=remote topics=warning prefix=":Warning"
add action=remote topics=critical prefix=":Critical"
add action=remote topics=firewall prefix=":Firewall"
add action=remote topics=wireless prefix=":Wireless"
```

## Resources

- **GitHub Repository**: https://github.com/akpw/mktxp
- **Docker Image**: https://github.com/akpw/mktxp/pkgs/container/mktxp
- **MKTXP Stack**: https://github.com/akpw/mktxp-stack
- **Grafana Dashboard**: https://grafana.com/grafana/dashboards/13679
- **RouterOS API Docs**: https://wiki.mikrotik.com/wiki/Manual:API
- **Community Forum**: https://forum.mikrotik.com/
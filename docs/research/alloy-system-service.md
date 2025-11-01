# Grafana Alloy as a System Service for Linux Node Monitoring

## Overview

Grafana Alloy is a vendor-neutral OpenTelemetry Collector distribution with Prometheus pipelines that can be deployed as a systemd service on Linux hosts to collect metrics, logs, and traces. The "simple mode" configuration approach provides a streamlined way to monitor non-Kubernetes infrastructure like bare-metal servers, VMs, and NAS devices.

Alloy replaces the older Grafana Agent and provides a modern, component-based configuration approach that makes it easy to collect telemetry data and send it to self-hosted observability backends like Mimir and Loki.

## Architecture Overview

### Components

- **Grafana Alloy**: The telemetry collection agent running as a systemd service on each Linux host
- **prometheus.exporter.unix**: Built-in component for collecting node metrics (replaces node_exporter)
- **loki.source.journal**: Component for collecting systemd journal logs
- **loki.source.file**: Component for collecting log files
- **Remote write endpoints**: Self-hosted Mimir (metrics) and Loki (logs) backends

### Data Flow

```
Linux Host → Alloy → Remote Write → Self-hosted Backend
    ├── System Metrics → prometheus.exporter.unix → Mimir
    ├── Journal Logs → loki.source.journal → Loki
    └── File Logs → loki.source.file → Loki
```

## Installation Methods

### 1. Package Manager Installation (Recommended)

Alloy can be installed via official Grafana repositories on most Linux distributions:

#### Debian/Ubuntu

```bash
# Import GPG key and add repository
sudo mkdir -p /etc/apt/keyrings/
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list

# Update and install
sudo apt-get update
sudo apt-get install alloy
```

#### RHEL/Fedora

```bash
# Import GPG key and add repository
wget -q -O gpg.key https://rpm.grafana.com/gpg.key
sudo rpm --import gpg.key
echo -e '[grafana]\nname=grafana\nbaseurl=https://rpm.grafana.com\nrepo_gpgcheck=1\nenabled=1\ngpgcheck=1\ngpgkey=https://rpm.grafana.com/gpg.key' | sudo tee /etc/yum.repos.d/grafana.repo

# Update and install
yum update
sudo dnf install alloy
```

### 2. Binary Installation

For systems where package management isn't available:

```bash
# Download the latest release
wget https://github.com/grafana/alloy/releases/latest/download/alloy-linux-amd64.zip
unzip alloy-linux-amd64.zip

# Move to system location
sudo mv alloy-linux-amd64 /usr/local/bin/alloy
sudo chmod +x /usr/local/bin/alloy

# Create systemd service file manually (see below)
```

### 3. Ansible Deployment

For managing multiple Linux nodes, use the Grafana Ansible collection:

```yaml
- name: Install and configure Alloy
  hosts: linux_nodes
  roles:
    - role: grafana.grafana.alloy
      vars:
        alloy_config_file: /etc/alloy/config.alloy
        alloy_env_file: /etc/alloy/environment
```

## Simple Mode Configuration

The simple mode configuration provides a working setup with minimal configuration required. This approach uses Alloy's built-in components to collect node metrics and logs without requiring separate exporters.

### Basic Configuration Structure

```alloy
// /etc/alloy/config.alloy

// Global constants
constants {
  hostname = env("HOSTNAME")
}

// Metrics collection using built-in node exporter
prometheus.exporter.unix "node" {
  // Disable collectors that generate high cardinality metrics
  disable_collectors = ["ipvs", "btrfs", "infiniband", "xfs", "zfs"]
  
  filesystem {
    // Exclude temporary and virtual filesystems
    fs_types_exclude = "^(autofs|binfmt_misc|bpf|cgroup2?|configfs|debugfs|devpts|devtmpfs|tmpfs|fusectl|hugetlbfs|iso9660|mqueue|nsfs|overlay|proc|procfs|pstore|rpc_pipefs|securityfs|selinuxfs|squashfs|sysfs|tracefs)$"
    mount_points_exclude = "^/(dev|proc|run/credentials/.+|sys|var/lib/docker/.+)($|/)"
    mount_timeout = "5s"
  }
  
  netclass {
    // Ignore virtual network interfaces
    ignored_devices = "^(veth.*|cali.*|[a-f0-9]{15})$"
  }
  
  netdev {
    device_exclude = "^(veth.*|cali.*|[a-f0-9]{15})$"
  }
}

// Discovery and relabeling for metrics
discovery.relabel "node" {
  targets = prometheus.exporter.unix.node.targets
  
  rule {
    target_label = "instance"
    replacement = constants.hostname
  }
  
  rule {
    target_label = "job"
    replacement = "node"
  }
}

// Scrape metrics from the node exporter
prometheus.scrape "node" {
  targets = discovery.relabel.node.output
  forward_to = [prometheus.relabel.node.receiver]
  scrape_interval = "30s"
}

// Filter out unnecessary metrics
prometheus.relabel "node" {
  forward_to = [prometheus.remote_write.mimir.receiver]
  
  rule {
    source_labels = ["__name__"]
    regex = "node_scrape_collector_.+"
    action = "drop"
  }
}

// Remote write to self-hosted Mimir
prometheus.remote_write "mimir" {
  endpoint {
    url = "http://mimir.example.local:9009/api/v1/push"
    
    // Optional: Add authentication if required
    // basic_auth {
    //   username = "alloy"
    //   password = env("MIMIR_PASSWORD")
    // }
  }
}

// Collect systemd journal logs
loki.source.journal "system" {
  max_age = "24h"
  forward_to = [loki.process.system.receiver]
  relabel_rules = loki.relabel.journal.rules
}

// Relabel journal entries
loki.relabel "journal" {
  rule {
    source_labels = ["__journal__systemd_unit"]
    target_label = "unit"
  }
  
  rule {
    source_labels = ["__journal__transport"]
    target_label = "transport"
  }
  
  rule {
    source_labels = ["__journal_priority_keyword"]
    target_label = "level"
  }
}

// Process logs (add labels)
loki.process "system" {
  forward_to = [loki.write.loki.receiver]
  
  stage.labels {
    values = {
      instance = constants.hostname,
      job = "systemd-journal",
    }
  }
}

// Collect log files
local.file_match "logs" {
  path_targets = [
    {
      __address__ = "localhost",
      __path__ = "/var/log/*.log",
    },
    {
      __address__ = "localhost", 
      __path__ = "/var/log/syslog",
    },
    {
      __address__ = "localhost",
      __path__ = "/var/log/messages",
    },
  ]
}

loki.source.file "logs" {
  targets = local.file_match.logs.targets
  forward_to = [loki.process.files.receiver]
}

loki.process "files" {
  forward_to = [loki.write.loki.receiver]
  
  stage.labels {
    values = {
      instance = constants.hostname,
      job = "file-logs",
    }
  }
}

// Remote write to self-hosted Loki
loki.write "loki" {
  endpoint {
    url = "http://loki.example.local:3100/loki/api/v1/push"
    
    // Optional: Add authentication if required
    // basic_auth {
    //   username = "alloy"
    //   password = env("LOKI_PASSWORD")
    // }
  }
}
```

## Configuration Patterns

### Environment Variables

Store sensitive configuration in `/etc/alloy/environment`:

```bash
# /etc/alloy/environment
HOSTNAME=$(hostname -f)
MIMIR_PASSWORD=secure_password
LOKI_PASSWORD=secure_password
MIMIR_URL=http://mimir.example.local:9009
LOKI_URL=http://loki.example.local:3100
```

### Label Management

Consistent labeling is crucial for querying and dashboarding:

```alloy
// Standard labels for all telemetry
stage.labels {
  values = {
    instance = constants.hostname,
    environment = env("ENVIRONMENT"),  // prod, staging, dev
    datacenter = env("DATACENTER"),    // us-east-1, eu-west-1
    role = env("NODE_ROLE"),           // web, db, cache, etc.
  }
}
```

### Service Discovery for Dynamic Infrastructure

For environments with dynamic hosts, use file-based service discovery:

```alloy
discovery.file "nodes" {
  files = ["/etc/alloy/targets/*.yaml"]
}

// targets/webservers.yaml
- targets:
    - web1.example.local
    - web2.example.local
  labels:
    role: webserver
    environment: production
```

## Required Components

### Built-in Components (No Installation Required)

- **prometheus.exporter.unix**: Replaces node_exporter, bundled with Alloy
- **loki.source.journal**: Journal reader, bundled with Alloy
- **loki.source.file**: File tailer, bundled with Alloy

### Optional External Components

For specific use cases, you may want to scrape metrics from external exporters:

```alloy
// Scrape external exporters
prometheus.scrape "external_exporters" {
  targets = [
    {__address__ = "localhost:9100", job = "node_exporter"},     // If using standalone node_exporter
    {__address__ = "localhost:9104", job = "mysql_exporter"},    // MySQL metrics
    {__address__ = "localhost:9187", job = "postgres_exporter"}, // PostgreSQL metrics
  ]
  forward_to = [prometheus.remote_write.mimir.receiver]
}
```

## Remote Write Configuration

### Self-hosted Mimir Configuration

```alloy
prometheus.remote_write "mimir" {
  endpoint {
    url = "http://mimir.example.local:9009/api/v1/push"
    
    // Batching configuration
    batch_send_deadline = "5s"
    max_shards = 10
    min_shards = 1
    max_samples_per_send = 5000
    
    // Queue configuration for reliability
    capacity = 10000
    min_backoff = "30ms"
    max_backoff = "5s"
    
    // Optional TLS configuration
    // tls_config {
    //   ca_file = "/etc/alloy/ca.crt"
    //   cert_file = "/etc/alloy/client.crt"
    //   key_file = "/etc/alloy/client.key"
    // }
  }
}
```

### Self-hosted Loki Configuration

```alloy
loki.write "loki" {
  endpoint {
    url = "http://loki.example.local:3100/loki/api/v1/push"
    
    // Batching configuration
    batch_wait = "1s"
    batch_size = 1048576  // 1MB
    
    // Optional tenant ID for multi-tenancy
    // tenant_id = "team-a"
    
    // Rate limiting
    min_backoff = "500ms"
    max_backoff = "5m"
    max_retries = 10
  }
}
```

## Authentication Options

### Basic Authentication

```alloy
basic_auth {
  username = "alloy"
  password = env("REMOTE_WRITE_PASSWORD")
}
```

### Bearer Token Authentication

```alloy
bearer_token = env("BEARER_TOKEN")
// Or from file
bearer_token_file = "/var/run/secrets/token"
```

### mTLS Authentication

```alloy
tls_config {
  ca_file = "/etc/alloy/ca.crt"
  cert_file = "/etc/alloy/client.crt"
  key_file = "/etc/alloy/client.key"
  server_name = "mimir.example.local"
  insecure_skip_verify = false
}
```

## Label Conventions

### Standard Labels

- **instance**: Unique identifier for the host (FQDN recommended)
- **job**: Logical grouping of similar targets
- **environment**: Deployment environment (prod, staging, dev)
- **datacenter/region**: Physical or cloud region
- **team**: Owning team for multi-tenant environments

### Custom Labels for Homelab

```alloy
rule {
  target_label = "location"
  replacement = env("PHYSICAL_LOCATION")  // rack1, basement, office
}

rule {
  target_label = "hardware_type"  
  replacement = env("HARDWARE_TYPE")  // raspberry_pi, dell_server, vm
}

rule {
  target_label = "os_family"
  replacement = env("OS_FAMILY")  // debian, rhel, alpine
}
```

## Best Practices

### 1. Resource Management

Configure Alloy to use appropriate resources:

```bash
# /etc/alloy/environment
GOGC=80                          # More aggressive garbage collection
GOMEMLIMIT=500MiB                # Memory limit
GOMAXPROCS=2                     # CPU cores to use
```

### 2. High Availability

Run multiple Alloy instances in clustering mode for redundancy:

```alloy
clustering {
  enabled = true
  
  // Use Kubernetes service discovery or static list
  join_addresses = ["alloy-1:12345", "alloy-2:12345", "alloy-3:12345"]
}
```

### 3. Monitoring Alloy Itself

```alloy
// Self-monitoring
prometheus.exporter.self "alloy" {}

prometheus.scrape "alloy" {
  targets = prometheus.exporter.self.alloy.targets
  forward_to = [prometheus.remote_write.mimir.receiver]
}
```

### 4. Configuration Validation

Always validate configuration before deployment:

```bash
# Validate configuration
alloy fmt --check /etc/alloy/config.alloy
alloy run --dry-run /etc/alloy/config.alloy

# Format configuration
alloy fmt --write /etc/alloy/config.alloy
```

### 5. Gradual Rollout

Start with a subset of metrics/logs and expand:

```alloy
// Start with essential metrics only
prometheus.exporter.unix "node" {
  enable_collectors = ["cpu", "meminfo", "diskstats", "filesystem", "netdev", "loadavg"]
}
```

## Use Cases for Non-Kubernetes Infrastructure

### Bare-metal Servers

Monitor physical servers in datacenters or homelab environments:

```alloy
// Additional hardware monitoring
prometheus.scrape "ipmi" {
  targets = [{__address__ = "localhost:9290", job = "ipmi_exporter"}]
  forward_to = [prometheus.remote_write.mimir.receiver]
}
```

### Virtual Machines

Monitor VMs across different hypervisors:

```alloy
// Add VM-specific labels
rule {
  target_label = "hypervisor"
  replacement = env("HYPERVISOR_TYPE")  // vmware, proxmox, kvm
}

rule {
  target_label = "vm_id"
  replacement = env("VM_ID")
}
```

### NAS Devices

Monitor storage appliances:

```alloy
// SNMP monitoring for NAS devices
prometheus.exporter.snmp "nas" {
  config_file = "/etc/alloy/snmp.yml"
  targets = [
    {__address__ = "nas.local", module = "synology"},
    {__address__ = "truenas.local", module = "freenas"},
  ]
}
```

### IoT and Edge Devices

Monitor resource-constrained devices:

```alloy
// Reduced scraping for low-power devices
prometheus.scrape "iot" {
  scrape_interval = "5m"  // Less frequent scraping
  scrape_timeout = "30s"
  
  targets = discovery.relabel.iot.output
  forward_to = [prometheus.remote_write.mimir.receiver]
}
```

## Integration with Existing Infrastructure

### Grafana Dashboards

Import or create dashboards that work with Alloy-collected metrics:

```json
{
  "dashboard": {
    "title": "Linux Node Metrics",
    "panels": [
      {
        "targets": [
          {
            "expr": "100 - (avg(rate(node_cpu_seconds_total{mode=\"idle\",instance=\"$instance\"}[5m])) * 100)",
            "legendFormat": "CPU Usage %"
          }
        ]
      }
    ],
    "templating": {
      "list": [
        {
          "name": "instance",
          "query": "label_values(node_cpu_seconds_total, instance)"
        }
      ]
    }
  }
}
```

### Alert Rules

Configure alerts in Mimir/Prometheus:

```yaml
groups:
  - name: node_alerts
    interval: 30s
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          
      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes{fstype!~"tmpfs|fuse.lxcfs|squashfs"} / node_filesystem_size_bytes < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"
```

## Comparison with Other Approaches

### Alloy vs node_exporter + Promtail

| Feature | Alloy | node_exporter + Promtail |
|---------|-------|--------------------------|
| Installation | Single binary/package | Multiple components |
| Configuration | Unified configuration | Separate configs |
| Resource Usage | ~100-200MB RAM | ~150-300MB RAM combined |
| Maintenance | Single service | Multiple services |
| Features | Full telemetry pipeline | Metrics and logs only |
| Extensibility | Component-based | Fixed functionality |

### Alloy vs Prometheus + Grafana Agent

| Feature | Alloy | Prometheus + Grafana Agent |
|---------|-------|---------------------------|
| Architecture | Distributed scraping | Centralized or federated |
| Scalability | Built-in clustering | Manual sharding |
| Configuration | Declarative | Mix of declarative and imperative |
| Cloud Native | Designed for cloud | Traditional datacenter focus |

### Alloy vs OpenTelemetry Collector

| Feature | Alloy | OpenTelemetry Collector |
|---------|-------|------------------------|
| Prometheus Support | Native | Via receiver |
| Configuration | Alloy syntax | YAML |
| Built-in Exporters | Many included | Requires separate exporters |
| Learning Curve | Moderate | Steep |

## Troubleshooting

### Common Issues and Solutions

#### 1. High Memory Usage

```alloy
// Limit series cardinality
prometheus.relabel "cardinality_limit" {
  rule {
    source_labels = ["__name__"]
    regex = "node_network_.*"
    target_label = "__tmp_interface"
    replacement = "${1}"
  }
  
  rule {
    source_labels = ["__tmp_interface"]
    regex = "^(eth|ens|bond).*"
    action = "keep"
  }
}
```

#### 2. Connection Failures

```alloy
// Add retry logic and circuit breaking
prometheus.remote_write "mimir" {
  endpoint {
    url = "http://mimir.example.local:9009/api/v1/push"
    
    retry_on_http_429 = true
    max_retries = 10
    min_backoff = "1s"
    max_backoff = "30s"
  }
}
```

#### 3. Missing Metrics

```bash
# Check Alloy's internal metrics
curl http://localhost:12345/metrics | grep alloy_

# Check component health
curl http://localhost:12345/api/v0/component/prometheus.exporter.unix.node
```

### Debug Mode

Enable debug logging for troubleshooting:

```alloy
logging {
  level = "debug"
  format = "json"
}

livedebugging {
  enabled = true
}
```

## Migration from Grafana Agent

For users migrating from Grafana Agent static mode:

```bash
# Convert existing configuration
alloy convert --source-format=static --output=/etc/alloy/config.alloy /etc/grafana-agent/agent.yaml

# Review and test converted configuration
alloy run --dry-run /etc/alloy/config.alloy
```

## Recommendations for Homelab Use

### Minimal Configuration

For homelab environments with limited resources:

```alloy
// Minimal metrics collection
prometheus.exporter.unix "node" {
  enable_collectors = ["cpu", "meminfo", "diskstats", "filesystem", "loadavg"]
  
  // Disable detailed network stats
  netdev {
    device_exclude = ".*"
  }
}

// Reduce scraping frequency
prometheus.scrape "node" {
  scrape_interval = "60s"  // Every minute instead of 30s
  targets = discovery.relabel.node.output
  forward_to = [prometheus.remote_write.mimir.receiver]
}

// Only collect important logs
loki.source.journal "system" {
  max_age = "12h"  // Keep less history
  matches = "_TRANSPORT=kernel"  // Only kernel messages
  forward_to = [loki.write.loki.receiver]
}
```

### Multi-node Deployment

For managing multiple nodes in a homelab:

1. **Use Configuration Management**: Deploy with Ansible, Puppet, or Chef
2. **Centralize Configuration**: Store common configuration in Git
3. **Use Service Discovery**: Implement file-based or DNS-based discovery
4. **Monitor the Monitors**: Set up a dedicated Alloy instance to monitor other Alloy instances

### Security Considerations

```alloy
// Bind to localhost only
http {
  listen_address = "127.0.0.1"
  listen_port = 12345
}

// Use TLS for remote endpoints
prometheus.remote_write "mimir" {
  endpoint {
    url = "https://mimir.example.local:9009/api/v1/push"
    
    tls_config {
      insecure_skip_verify = false
      min_version = "TLS13"
    }
  }
}
```

## Conclusion

Grafana Alloy provides a modern, efficient way to monitor Linux infrastructure without Kubernetes. Its simple mode configuration offers an easy starting point while maintaining the flexibility to scale and customize as needed. For homelab and production environments alike, Alloy's unified approach to metrics and logs collection, combined with its native support for self-hosted backends, makes it an excellent choice for infrastructure monitoring.

Key advantages for non-Kubernetes environments:
- Single agent for all telemetry types
- Built-in node_exporter functionality
- Native clustering for high availability
- Efficient resource usage
- Easy integration with existing Grafana stack
- Strong community support and active development

The transition from traditional monitoring stacks to Alloy represents a significant simplification in operational complexity while maintaining all the capabilities needed for comprehensive infrastructure monitoring.
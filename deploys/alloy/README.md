# Grafana Alloy Node Deployment

This PyInfra deployment installs and configures Grafana Alloy as a system service on Linux hosts for collecting metrics and logs.

## Overview

Grafana Alloy is deployed as a systemd service that:
- Collects node metrics using the built-in `prometheus.exporter.unix` component
- Collects system logs from journald and log files
- Sends metrics to a Mimir endpoint
- Sends logs to a Loki endpoint

## Usage

Deploy Alloy to a host:

```bash
pyinfra @inventory/host.py deploys/alloy-node-deploy.py
```

## Configuration

### Inventory Configuration

Add the `alloy` configuration block to your host data in `inventory.py`:

```python
("hostname.example.com", {
    "alloy": {
        "telemetry_host": "telemetry.holdenitdown.net",
        "telemetry_port": 8080,
        "mimir_path": "/mimir/api/v1/push",
        "loki_path": "/loki/api/v1/push",
    }
})
```

### Default Values

If no configuration is provided, the following defaults are used:

- **telemetry_host**: `telemetry.holdenitdown.net`
- **telemetry_port**: `8080`
- **mimir_path**: `/mimir/api/v1/push`
- **loki_path**: `/loki/api/v1/push`

### Environment Variables

The deployment creates `/etc/alloy/environment` with:

- `HOSTNAME`: The hostname of the system
- `MIMIR_ENDPOINT`: Full URL to Mimir remote write endpoint
- `LOKI_ENDPOINT`: Full URL to Loki push endpoint

## Files Created

- `/etc/alloy/config.alloy`: Alloy configuration file
- `/etc/alloy/environment`: Environment variables for Alloy
- `/etc/systemd/system/alloy.service.d/environment.conf`: Systemd override to load environment file

## Metrics Collected

The deployment configures the following node_exporter metrics:

- CPU usage
- Memory usage
- Disk usage and I/O
- Network statistics
- Filesystem metrics
- Load average

Disabled collectors (high cardinality):
- ipvs
- btrfs
- infiniband
- xfs
- zfs

## Logs Collected

### Systemd Journal
- All systemd journal entries from the last 12 hours
- Labeled with: unit, boot_id, transport, level

### Log Files
- `/var/log/syslog`
- `/var/log/messages`
- `/var/log/*.log`

## Supported Operating Systems

- Ubuntu/Debian (via APT)
- CentOS/RHEL/Fedora/Rocky (via YUM/DNF)

## Service Management

After deployment, manage the service with systemd:

```bash
systemctl status alloy
systemctl restart alloy
systemctl stop alloy
```

## Configuration Validation

The deployment automatically validates the Alloy configuration before restarting the service using:

```bash
alloy fmt --check /etc/alloy/config.alloy
```

## Label Schema

Metrics and logs are labeled with:

- `instance`: Hostname of the system
- `job`: `integrations/node_exporter`

## Architecture

```
Linux Host
    ├── Alloy Service
    │   ├── prometheus.exporter.unix → Metrics
    │   ├── loki.source.journal → Journal Logs
    │   └── loki.source.file → File Logs
    │
    ├── prometheus.remote_write → Mimir
    └── loki.write → Loki
```

## Troubleshooting

### Check Alloy Status
```bash
systemctl status alloy
journalctl -u alloy -f
```

### Validate Configuration
```bash
alloy fmt --check /etc/alloy/config.alloy
```

### Check Metrics Endpoint
```bash
curl http://localhost:12345/metrics
```

### Test Remote Write Connectivity
```bash
curl -I http://telemetry.holdenitdown.net:8080/mimir/api/v1/push
curl -I http://telemetry.holdenitdown.net:8080/loki/api/v1/push
```

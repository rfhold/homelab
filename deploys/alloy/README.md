# Grafana Alloy Host Deploy

This guide describes [`../alloy-node-deploy.py`](../alloy-node-deploy.py) and its tracked templates. It does not prove that Alloy is installed, running, or delivering telemetry on any host.

The setup path supports Debian and Ubuntu through APT: it configures the Grafana APT repository and installs `alloy`. On Arch Linux and CachyOS Linux, it updates Pacman package metadata and installs `grafana-alloy`; it does not configure the Grafana APT repository on those systems. The implementation rejects other Linux names and does not contain YUM or DNF support.

## Host Data

The entry point accepts an optional `alloy` block. If it is absent, the deploy warns and uses source defaults.

| Key | Default | Tracked effect |
| --- | --- | --- |
| `telemetry_host` | `telemetry.holdenitdown.net` | Host used for Mimir and Loki URLs |
| `unix_exporter_enabled` | `true` | Enables the built-in Unix exporter and filtered node metrics |
| `log_collection_enabled` | `true` | Enables journald and local log-file collection |
| `smartctl_exporter_enabled` | `false` | Installs, manages, and scrapes smartctl exporter |
| `mimir.port` | `9090` | Mimir HTTP port |
| `mimir.path` | `/api/v1/metrics/write` | Mimir remote-write path |
| `loki.port` | `3100` | Loki HTTP port |
| `loki.path` | `/loki/api/v1/push` | Loki push path |
| `smartctl.port` | `9633` | smartctl exporter listen port |
| `smartctl.interval` | `60s` | smartctl collection interval |
| `smartctl.rescan_interval` | `10m` | smartctl device rescan interval |
| `smartctl.device_exclude` | `^(loop|ram|sr)` | smartctl device exclusion expression |

The Alloy template currently scrapes smartctl exporter at `localhost:9633`, so `smartctl.port` must remain `9633` unless the service and scrape templates are changed together.

When `k3s_cluster.name` identifies a managed cluster, the template uses that name and `k3s_cluster.node_role` to add host-local K3s metrics. Scheduler at HTTPS `127.0.0.1:10259` and Controller Manager at HTTPS `127.0.0.1:10257` are enabled only for `cluster-init` and `server` nodes; their local certificates are not verified. Proxy at HTTP `127.0.0.1:10249` is enabled for those roles and `agent`. These scrapes attach the inventory cluster name, `namespace=kube-system`, the managed Kubernetes integration job, and the host name as `instance`, then forward an allowlisted metric set to the common Mimir remote-write receiver.

## Rendered State

[`configure.py`](configure.py) renders:

- `/etc/alloy/environment` with `HOSTNAME`, `MIMIR_ENDPOINT`, `LOKI_ENDPOINT`, and `CONFIG_FILE=/etc/alloy/config.alloy`
- `/etc/alloy/config.alloy`

The package-specific files and commands are selected from the immutable `LinuxName` fact:

| Linux names | Binary | Systemd unit | Override directory | Reporting defaults |
| --- | --- | --- | --- | --- |
| Debian, Ubuntu | `alloy` | `alloy.service` | `/etc/systemd/system/alloy.service.d` | `/etc/default/alloy` |
| Arch Linux, CachyOS Linux | `/usr/bin/grafana-alloy` | `grafana-alloy.service` | `/etc/systemd/system/grafana-alloy.service.d` | `/etc/default/grafana-alloy` |

It writes `environment.conf` in the selected override directory and replaces the selected reporting-default file with `CUSTOM_ARGS="--disable-reporting"`. The systemd drop-in separately appends `/etc/alloy/environment`, preserving `CONFIG_FILE` for the package unit. It runs the selected binary's `fmt` command when the configuration changes, reloads systemd when managed files change, unconditionally enables and starts the selected service, and restarts it when a managed environment, configuration, or service-override file changes.

The template always collects Alloy self-metrics. Optional Unix exporter metrics use the `integrations/node_exporter` job, optional journal collection reads up to eight hours of history, and optional file collection targets `/var/log/syslog`, `/var/log/messages`, and `/var/log/*.log`.

## Execution

This command can install packages, write system files, and restart services on the selected host:

```bash
uv run pyinfra inventory.py --limit <authorized-host> deploys/alloy-node-deploy.py
```

Use only after explicit target authorization. Source configuration is not evidence that the service is deployed or healthy.

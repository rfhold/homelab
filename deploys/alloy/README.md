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
| `rocm_metrics_exporter_enabled` | `false` | Manages and scrapes the ROCm Metrics Exporter container |
| `mimir.port` | `9090` | Mimir HTTP port |
| `mimir.path` | `/api/v1/metrics/write` | Mimir remote-write path |
| `loki.port` | `3100` | Loki HTTP port |
| `loki.path` | `/loki/api/v1/push` | Loki push path |
| `smartctl.port` | `9633` | smartctl exporter listen port |
| `smartctl.interval` | `60s` | smartctl collection interval |
| `smartctl.rescan_interval` | `10m` | smartctl device rescan interval |
| `smartctl.device_exclude` | `^(loop|ram|sr)` | smartctl device exclusion expression |
| `rocm_metrics_exporter.image` | Required | Pinned image with a non-`latest` tag or digest; Vulkan specifies `rocm/device-metrics-exporter:v1.5.1` |
| `rocm_metrics_exporter.port` | Required | Loopback port Alloy scrapes on the host |
| `rocm_metrics_exporter.container_port` | Required | Exporter port exposed inside the container |
| `rocm_metrics_exporter.devices` | Required | Required GPU device paths passed to Docker |
| `rocm_metrics_exporter.docker_args` | Required | Explicit additional Docker arguments for the selected image |
| `rocm_metrics_exporter.metrics_allowlist` | Required | Non-empty Prometheus metric-name regular-expression allowlist |

The Alloy template currently scrapes smartctl exporter at `localhost:9633`, so `smartctl.port` must remain `9633` unless the service and scrape templates are changed together.

ROCm Metrics Exporter is an optional, host-local Docker service named `rocm-metrics-exporter`. Docker is a prerequisite when `rocm_metrics_exporter_enabled` is true; this Alloy deploy does not install Docker. When enabled, the service binds only to `127.0.0.1:<rocm_metrics_exporter.port>` and Alloy scrapes `/metrics` with the `integrations/rocm_metrics_exporter` job and the host name as `instance`. Its relabel stage forwards only the configured `metrics_allowlist` to the common Mimir remote-write receiver.

Official Docker installation evidence specifies `rocm/device-metrics-exporter:v1.5.1`, container port `5000`, `--privileged`, `--device=/dev/dri`, `--device=/dev/kfd`, and a read-only `/sys` bind mount. Vulkan supplies the device paths through `devices` and the other required arguments as separate `docker_args` tokens: `--privileged`, `--mount`, and `type=bind,source=/sys,target=/sys,readonly`. The official image documentation does not require a host `/opt/rocm` mount.

The official image documents Ubuntu 22.04+ and ROCm 6.2+. The tracked Vulkan configuration passed an authorized CachyOS preflight with the selected image, Docker arguments, device paths, `/sys` mount, listener port, and GPU metric forwarding. A new image, host platform, Docker argument set, device set, or metric allowlist requires a new authorized preflight before enablement.

After authorization and deployment, verify the local endpoint with `curl --fail http://127.0.0.1:<port>/metrics`, inspect `systemctl status rocm-metrics-exporter.service`, and confirm the Alloy configuration has the integration scrape before checking Mimir for the integration job. The source does not establish that any of these checks pass on a host.

To roll back an enabled deployment, set `rocm_metrics_exporter_enabled` to `false`, apply the authorized host deploy, then disable and remove `rocm-metrics-exporter.service` and its container under separate explicit host-mutation authorization. The current optional-exporter pattern does not remove a previously managed unit when its flag is disabled.

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

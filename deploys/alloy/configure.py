import io

from pyinfra.context import host
from pyinfra.operations import files, server, systemd
from pyinfra.facts.server import Hostname, LinuxName
from pyinfra.operations.util import any_changed


ALLOY_OS_CONFIG = {
    "Debian": (
        "alloy",
        "alloy.service",
        "/etc/systemd/system/alloy.service.d",
        "/etc/default/alloy",
    ),
    "Ubuntu": (
        "alloy",
        "alloy.service",
        "/etc/systemd/system/alloy.service.d",
        "/etc/default/alloy",
    ),
    "Arch Linux": (
        "/usr/bin/grafana-alloy",
        "grafana-alloy.service",
        "/etc/systemd/system/grafana-alloy.service.d",
        "/etc/default/grafana-alloy",
    ),
    "CachyOS Linux": (
        "/usr/bin/grafana-alloy",
        "grafana-alloy.service",
        "/etc/systemd/system/grafana-alloy.service.d",
        "/etc/default/grafana-alloy",
    ),
}


def configure() -> None:
    linux_name = host.get_fact(LinuxName)

    try:
        binary, service, override_directory, reporting_file = ALLOY_OS_CONFIG[linux_name]
    except KeyError as error:
        raise ValueError(
            "The Alloy deploy supports Debian/Ubuntu and Arch/CachyOS hosts only"
        ) from error

    hostname = host.get_fact(Hostname)

    config = host.data.get("alloy") or {}

    telemetry_host = config.get("telemetry_host", "telemetry.holdenitdown.net")
    unix_exporter_enabled = config.get("unix_exporter_enabled", True)
    log_collection_enabled = config.get("log_collection_enabled", True)
    smartctl_exporter_enabled = config.get("smartctl_exporter_enabled", False)
    rocm_metrics_exporter_enabled = config.get("rocm_metrics_exporter_enabled", False)
    rocm_metrics_exporter_config = config.get("rocm_metrics_exporter") or {}
    rocm_metrics_exporter_port = rocm_metrics_exporter_config.get("port", 5000)
    rocm_metrics_exporter_metrics_allowlist = rocm_metrics_exporter_config.get(
        "metrics_allowlist", []
    )
    if rocm_metrics_exporter_enabled and not rocm_metrics_exporter_metrics_allowlist:
        raise ValueError(
            "ROCm Metrics Exporter requires a non-empty metrics_allowlist when enabled"
        )

    k3s_config = host.data.get("k3s_cluster") or {}
    k3s_cluster_name = k3s_config.get("name")
    k3s_node_role = k3s_config.get("node_role")

    mimir_config = config.get("mimir") or {}
    mimir_port = mimir_config.get("port", 9090)
    mimir_path = mimir_config.get("path", "/api/v1/metrics/write")

    loki_config = config.get("loki") or {}
    loki_port = loki_config.get("port", 3100)
    loki_path = loki_config.get("path", "/loki/api/v1/push")

    mimir_endpoint = f"http://{telemetry_host}:{mimir_port}{mimir_path}"
    loki_endpoint = f"http://{telemetry_host}:{loki_port}{loki_path}"

    files.directory(
        name="Create Alloy config directory",
        _sudo=True,
        path="/etc/alloy",
        mode="0755",
        user="root",
        group="root",
        present=True,
    )

    env_file = files.template(
        name="Create Alloy environment file",
        _sudo=True,
        src="deploys/alloy/templates/environment.j2",
        dest="/etc/alloy/environment",
        user="root",
        group="root",
        mode="0644",
        backup=True,
        hostname=hostname,
        mimir_endpoint=mimir_endpoint,
        loki_endpoint=loki_endpoint,
    )

    config_file = files.template(
        name="Create Alloy configuration file",
        _sudo=True,
        src="deploys/alloy/templates/config.alloy.j2",
        dest="/etc/alloy/config.alloy",
        user="root",
        group="root",
        mode="0644",
        backup=True,
        unix_exporter_enabled=unix_exporter_enabled,
        log_collection_enabled=log_collection_enabled,
        smartctl_exporter_enabled=smartctl_exporter_enabled,
        rocm_metrics_exporter_enabled=rocm_metrics_exporter_enabled,
        rocm_metrics_exporter_port=rocm_metrics_exporter_port,
        rocm_metrics_exporter_metrics_allowlist=rocm_metrics_exporter_metrics_allowlist,
        k3s_cluster_name=k3s_cluster_name,
        k3s_node_role=k3s_node_role,
    )

    server.shell(
        name="Format Alloy configuration",
        _sudo=True,
        commands=[f"{binary} fmt /etc/alloy/config.alloy"],
        _if=config_file.did_change,
    )

    files.directory(
        name="Create Alloy systemd override directory",
        _sudo=True,
        path=override_directory,
        mode="0755",
        user="root",
        group="root",
        present=True,
    )

    service_override = files.put(
        name="Set Alloy environment file in systemd service",
        _sudo=True,
        src=io.StringIO("[Service]\nEnvironmentFile=/etc/alloy/environment\n"),
        dest=f"{override_directory}/environment.conf",
        mode="0644",
        user="root",
        group="root",
    )

    reporting_override = files.put(
        name="Disable Alloy usage reporting",
        _sudo=True,
        src=io.StringIO('CUSTOM_ARGS="--disable-reporting"\n'),
        dest=reporting_file,
        mode="0644",
        user="root",
        group="root",
    )

    systemd.daemon_reload(
        name="Reload systemd daemon if service changed",
        _sudo=True,
        _if=any_changed(env_file, config_file, service_override, reporting_override),
    )

    systemd.service(
        name="Enable and start Alloy service",
        _sudo=True,
        service=service,
        running=True,
        enabled=True,
    )

    systemd.service(
        name="Restart Alloy service if managed files changed",
        _sudo=True,
        service=service,
        restarted=True,
        _if=any_changed(
            env_file, config_file, service_override, reporting_override
        ),
    )

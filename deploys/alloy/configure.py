import io

from pyinfra.context import host
from pyinfra.operations import files, server, systemd
from pyinfra.facts.server import Hostname
from pyinfra.operations.util import any_changed


def configure() -> None:
    hostname = host.get_fact(Hostname)
    
    config = host.data.get("alloy", {})
    
    telemetry_host = config.get("telemetry_host", "telemetry.holdenitdown.net")
    
    mimir_config = config.get("mimir", {})
    mimir_port = mimir_config.get("port", 9090)
    mimir_path = mimir_config.get("path", "/api/v1/metrics/write")
    
    loki_config = config.get("loki", {})
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
    )
    
    server.shell(
        name="Format Alloy configuration",
        _sudo=True,
        commands=["alloy fmt /etc/alloy/config.alloy"],
        _if=config_file.did_change,
    )
    
    files.directory(
        name="Create Alloy systemd override directory",
        _sudo=True,
        path="/etc/systemd/system/alloy.service.d",
        mode="0755",
        user="root",
        group="root",
        present=True,
    )
    
    service_override = files.put(
        name="Set Alloy environment file in systemd service",
        _sudo=True,
        src=io.StringIO("[Service]\nEnvironmentFile=/etc/alloy/environment\n"),
        dest="/etc/systemd/system/alloy.service.d/environment.conf",
        mode="0644",
        user="root",
        group="root",
    )
    
    systemd.daemon_reload(
        name="Reload systemd daemon if service changed",
        _sudo=True,
        _if=any_changed(env_file, config_file, service_override),
    )
    
    systemd.service(
        name="Enable and start Alloy service",
        _sudo=True,
        service="alloy.service",
        running=True,
        enabled=True,
        restarted=any_changed(env_file, config_file, service_override),
    )

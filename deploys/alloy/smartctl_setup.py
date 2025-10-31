from pyinfra import host
from pyinfra.facts.files import File
from pyinfra.facts.server import Arch
from pyinfra.operations import apt, files, server, systemd


def install_smartmontools() -> None:
    apt.packages(
        name="Install smartmontools package",
        packages=["smartmontools"],
        update=True,
        _sudo=True,
    )


def install_smartctl_exporter() -> None:
    version = "0.14.0"
    binary_path = "/usr/local/bin/smartctl_exporter"
    
    existing_binary = host.get_fact(File, binary_path)
    
    if existing_binary is None:
        arch_map = {
            "x86_64": "amd64",
            "amd64": "amd64",
            "aarch64": "arm64",
            "arm64": "arm64",
            "armv7l": "armv7",
            "armv6l": "armv6",
            "i386": "386",
            "i686": "386",
        }
        
        system_arch = host.get_fact(Arch)
        arch = arch_map.get(system_arch.lower(), "amd64")
        
        tarball = f"smartctl_exporter-{version}.linux-{arch}.tar.gz"
        url = f"https://github.com/prometheus-community/smartctl_exporter/releases/download/v{version}/{tarball}"
        
        server.shell(
            name=f"Download smartctl_exporter binary ({arch})",
            _sudo=True,
            commands=[
                f"curl -sL {url} -o /tmp/{tarball}",
                f"tar xzf /tmp/{tarball} -C /tmp",
                f"install -m 755 /tmp/smartctl_exporter-{version}.linux-{arch}/smartctl_exporter {binary_path}",
                "rm -rf /tmp/smartctl_exporter*",
            ],
        )


def configure_smartctl_service(smartctl_config: dict) -> None:
    port = smartctl_config.get("port", 9633)
    interval = smartctl_config.get("interval", "60s")
    rescan_interval = smartctl_config.get("rescan_interval", "10m")
    device_exclude = smartctl_config.get("device_exclude", "^(loop|ram|sr)")
    
    exec_start_parts = [
        "/usr/local/bin/smartctl_exporter",
        f"--web.listen-address=:{port}",
        "--web.telemetry-path=/metrics",
        "--smartctl.path=/usr/sbin/smartctl",
        f"--smartctl.interval={interval}",
        f"--smartctl.rescan={rescan_interval}",
    ]
    
    if device_exclude:
        exec_start_parts.append(f'--smartctl.device-exclude="{device_exclude}"')
    
    exec_start = " \\\n    ".join(exec_start_parts)
    
    service_file = files.template(
        name="Create smartctl_exporter systemd service",
        _sudo=True,
        src="deploys/alloy/templates/smartctl_exporter.service.j2",
        dest="/etc/systemd/system/smartctl_exporter.service",
        user="root",
        group="root",
        mode="0644",
        backup=True,
        exec_start=exec_start,
    )
    
    systemd.daemon_reload(
        name="Reload systemd daemon if smartctl service changed",
        _sudo=True,
        _if=service_file.did_change,
    )
    
    systemd.service(
        name="Enable and start smartctl_exporter service",
        _sudo=True,
        service="smartctl_exporter.service",
        running=True,
        enabled=True,
        restarted=service_file.did_change,
    )

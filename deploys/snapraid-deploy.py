from pyinfra.context import host
from pyinfra.operations import apt, files, systemd
from pyinfra.operations.util import any_changed

SNAPRAID_VERSION = "12.4"
SNAPRAID_URL = f"https://github.com/amadvance/snapraid/releases/download/v{
    SNAPRAID_VERSION}/snapraid-{SNAPRAID_VERSION}.tar.gz"

snapraid_config = host.data.get("snapraid_config")
if not snapraid_config:
    exit("No snapraid_config found in host data")

parity_disks = snapraid_config.get("parity_disks", [])
if not parity_disks:
    exit("No parity_disks configured in snapraid_config")

content_files = snapraid_config.get("content_files", [])
if not content_files:
    exit("No content_files configured in snapraid_config")

data_disks = snapraid_config.get("data_disks", [])
if not data_disks:
    exit("No data_disks configured in snapraid_config")

exclude_patterns = snapraid_config.get("exclude_patterns", [])
schedule = snapraid_config.get("schedule", {})

apt.packages(
    name="Install smartmontools package",
    packages=["smartmontools"],
    _sudo=True,
)

files.template(
    name="Configure /etc/snapraid.conf",
    src="deploys/snapraid/templates/snapraid.conf.j2",
    dest="/etc/snapraid.conf",
    user="root",
    group="root",
    mode="644",
    parity_disks=parity_disks,
    content_files=content_files,
    data_disks=data_disks,
    exclude_patterns=exclude_patterns,
    _sudo=True,
)

sync_config = schedule.get("sync", {})
if sync_config.get("enabled", False):
    sync_service = files.template(
        name="Configure snapraid-sync.service",
        src="deploys/snapraid/templates/snapraid-sync.service.j2",
        dest="/etc/systemd/system/snapraid-sync.service",
        user="root",
        group="root",
        mode="644",
        _sudo=True,
    )

    sync_timer = files.template(
        name="Configure snapraid-sync.timer",
        src="deploys/snapraid/templates/snapraid-sync.timer.j2",
        dest="/etc/systemd/system/snapraid-sync.timer",
        user="root",
        group="root",
        mode="644",
        schedule=schedule,
        _sudo=True,
    )

    systemd.daemon_reload(
        name="Reload systemd daemon for snapraid-sync",
        _sudo=True,
        _if=any_changed(sync_service, sync_timer),
    )

    systemd.service(
        name="Enable and start snapraid-sync.timer",
        service="snapraid-sync.timer",
        enabled=True,
        running=True,
        _sudo=True,
    )

scrub_config = schedule.get("scrub", {})
if scrub_config.get("enabled", False):
    scrub_service = files.template(
        name="Configure snapraid-scrub.service",
        src="deploys/snapraid/templates/snapraid-scrub.service.j2",
        dest="/etc/systemd/system/snapraid-scrub.service",
        user="root",
        group="root",
        mode="644",
        schedule=schedule,
        _sudo=True,
    )

    scrub_timer = files.template(
        name="Configure snapraid-scrub.timer",
        src="deploys/snapraid/templates/snapraid-scrub.timer.j2",
        dest="/etc/systemd/system/snapraid-scrub.timer",
        user="root",
        group="root",
        mode="644",
        schedule=schedule,
        _sudo=True,
    )

    systemd.daemon_reload(
        name="Reload systemd daemon for snapraid-scrub",
        _sudo=True,
        _if=any_changed(scrub_service, scrub_timer),
    )

    systemd.service(
        name="Enable and start snapraid-scrub.timer",
        service="snapraid-scrub.timer",
        enabled=True,
        running=True,
        _sudo=True,
    )

smart_config = schedule.get("smart", {})
if smart_config.get("enabled", False):
    smart_service = files.template(
        name="Configure snapraid-smart.service",
        src="deploys/snapraid/templates/snapraid-smart.service.j2",
        dest="/etc/systemd/system/snapraid-smart.service",
        user="root",
        group="root",
        mode="644",
        _sudo=True,
    )

    smart_timer = files.template(
        name="Configure snapraid-smart.timer",
        src="deploys/snapraid/templates/snapraid-smart.timer.j2",
        dest="/etc/systemd/system/snapraid-smart.timer",
        user="root",
        group="root",
        mode="644",
        schedule=schedule,
        _sudo=True,
    )

    systemd.daemon_reload(
        name="Reload systemd daemon for snapraid-smart",
        _sudo=True,
        _if=any_changed(smart_service, smart_timer),
    )

    systemd.service(
        name="Enable and start snapraid-smart.timer",
        service="snapraid-smart.timer",
        enabled=True,
        running=True,
        _sudo=True,
    )

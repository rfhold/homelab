from pyinfra.context import host
from pyinfra.operations import apt, files, server


mergerfs_config = host.data.get("mergerfs_config")
if not mergerfs_config:
    exit("No mergerfs_config found in host data")

apt.packages(
    name="Install mergerfs package",
    packages=["mergerfs"],
    _sudo=True,
)

pools = mergerfs_config.get("pools", [])
if not pools:
    exit("No pools configured in mergerfs_config")

for pool in pools:
    pool_name = pool["name"]
    sources = pool["sources"]
    mount_point = pool["mount_point"]
    options = pool.get("options", "defaults")

    files.directory(
        name=f"Ensure mount point {mount_point} exists",
        path=mount_point,
        present=True,
        _sudo=True,
    )

    sources_str = ":".join(sources)
    fstab_entry = f"{sources_str} {mount_point} mergerfs {options} 0 0"

    files.line(
        name=f"Ensure {pool_name} pool in /etc/fstab",
        path="/etc/fstab",
        line=fstab_entry,
        present=True,
        _sudo=True,
        backup=True,
    )

    server.mount(
        name=f"Mount {pool_name} at {mount_point}",
        path=mount_point,
        mounted=True,
        _sudo=True,
    )


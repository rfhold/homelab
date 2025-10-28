from pyinfra.context import host
from pyinfra.operations import files, server

disk_mounts = host.data.get("disk_mounts")
if not disk_mounts:
    exit("No disk_mounts found in host data")

for mount_config in disk_mounts:
    uuid = mount_config["uuid"]
    mount_point = mount_config["mount"]
    fstype = mount_config.get("fstype", "xfs")
    options = mount_config.get("options", "defaults")

    files.directory(
        name=f"Ensure mount point {mount_point} exists",
        path=mount_point,
        present=True,
        _sudo=True,
    )

    fstab_entry = f"/dev/disk/by-uuid/{uuid} {mount_point} {fstype} {options} 0 0"

    files.line(
        name=f"Ensure {mount_point} in /etc/fstab",
        path="/etc/fstab",
        line=fstab_entry,
        present=True,
        _sudo=True,
        backup=True,
    )

    server.mount(
        name=f"Mount {mount_point}",
        path=mount_point,
        mounted=True,
        _sudo=True,
    )

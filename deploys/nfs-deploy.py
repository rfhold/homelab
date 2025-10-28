from pyinfra.context import host
from pyinfra.operations import apt, files, server

mergerfs_config = host.data.get("mergerfs_config")
if not mergerfs_config:
    exit("No mergerfs_config found in host data")

nfs_export_config = mergerfs_config.get("nfs_export")
if not nfs_export_config or not nfs_export_config.get("enabled"):
    exit("NFS export not enabled in mergerfs_config")

exports = nfs_export_config.get("exports", [])
if not exports:
    exit("No exports configured in nfs_export configuration")

apt.packages(
    name="Install NFS server package",
    packages=["nfs-kernel-server"],
    _sudo=True,
)

config_changed = files.template(
    name="Configure /etc/exports",
    src="deploys/nfs/templates/exports.j2",
    dest="/etc/exports",
    user="root",
    group="root",
    mode="644",
    exports=exports,
    _sudo=True,
)

server.service(
    name="Enable NFS server service",
    service="nfs-server",
    enabled=True,
    running=True,
    _sudo=True,
)

server.shell(
    name="Reload NFS exports",
    commands=["exportfs -ra"],
    _if=config_changed.did_change,
    _sudo=True,
)

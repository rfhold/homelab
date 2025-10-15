from pyinfra.context import host
from pyinfra.facts.zfs import ZfsPools
from pyinfra.operations import zfs, server, files


"""
Deploy ZFS pools and datasets based on host configuration.

This function creates ZFS pools and datasets idempotently based on the
zfs_config data in the host inventory. It will:

1. Create ZFS pools if they don't exist
2. Create ZFS datasets/filesystems with specified properties
3. Ensure mountpoints exist with proper permissions
"""
zfs_config = host.data.get("zfs_config")
if not zfs_config:
    exit("No zfs_config found in host data - check inventory.py")

existing_pools = host.get_fact(ZfsPools) or []

for pool_name, pool_config in zfs_config.get("pools", {}).items():
    if pool_name not in existing_pools:
        devices = " ".join(pool_config["devices"])
        pool_type = pool_config.get("type", "")
        ashift = pool_config.get("ashift")

        create_cmd = "zpool create"
        if ashift:
            create_cmd += f" -o ashift={ashift}"
        create_cmd += f" {pool_name}"
        if pool_type:
            create_cmd += f" {pool_type}"
        create_cmd += f" {devices}"

        server.shell(
            name=f"Create ZFS pool {pool_name}",
            commands=[create_cmd],
            _sudo=True,
        )

for dataset_name, dataset_config in zfs_config.get("datasets", {}).items():
    zfs_properties = {k: v for k, v in dataset_config.items()
                      if k not in ['user', 'group', 'mode']}

    zfs.dataset(
        name=f"Create ZFS dataset {dataset_name}",
        dataset_name=dataset_name,
        present=True,
        properties=zfs_properties,
        _sudo=True,
    )

    mountpoint = dataset_config.get("mountpoint")
    if mountpoint:
        user = dataset_config.get("user", "nobody")
        group = dataset_config.get("group", "nogroup")
        mode = dataset_config.get("mode", "777")

        files.directory(
            name=f"Ensure mountpoint {
                mountpoint} exists with proper ownership",
            path=mountpoint,
            present=True,
            user=user,
            group=group,
            mode=mode,
            _sudo=True,
        )

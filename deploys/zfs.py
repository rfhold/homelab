import posixpath

from pyinfra.context import host
from pyinfra.facts.zfs import ZfsDatasets, ZfsPools
from pyinfra.operations import files, server, systemd, zfs


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

existing_datasets = host.get_fact(ZfsDatasets) or {}
dataset_mountpoints = {
    dataset_name: posixpath.normpath(dataset["mountpoint"])
    for dataset_name, dataset in existing_datasets.items()
    if dataset.get("type") == "filesystem"
    and dataset.get("canmount") not in ("off", "noauto")
    and dataset.get("mountpoint", "").startswith("/")
}
dataset_mountpoints.update({
    dataset_name: posixpath.normpath(dataset_config["mountpoint"])
    for dataset_name, dataset_config in zfs_config.get("datasets", {}).items()
    if dataset_config.get("mountpoint")
    and dataset_config.get("canmount") not in ("off", "noauto")
})
ordered_mounts = sorted(
    [
        (dataset_name, mountpoint)
        for dataset_name, mountpoint in dataset_mountpoints.items()
        if any(
            mountpoint.startswith(f"{other_mountpoint}/")
            or other_mountpoint.startswith(f"{mountpoint}/")
            for other_name, other_mountpoint in dataset_mountpoints.items()
            if other_name != dataset_name
        )
    ],
    key=lambda item: (item[1].count("/"), item[1]),
)

if ordered_mounts:
    mount_order_service = files.template(
        name="Configure nested ZFS mount ordering",
        src="deploys/zfs-mount-order.service.j2",
        dest="/etc/systemd/system/zfs-mount-order.service",
        user="root",
        group="root",
        mode="0644",
        backup=True,
        unmount_paths=[mountpoint for _, mountpoint in reversed(ordered_mounts)],
        mount_datasets=[dataset_name for dataset_name, _ in ordered_mounts],
        _sudo=True,
    )

    systemd.daemon_reload(
        name="Reload systemd for nested ZFS mount ordering",
        _sudo=True,
        _if=mount_order_service.did_change,
    )

    systemd.service(
        name="Enable nested ZFS mount ordering",
        service="zfs-mount-order.service",
        running=None,
        enabled=True,
        _sudo=True,
    )
else:
    systemd.service(
        name="Disable nested ZFS mount ordering",
        service="zfs-mount-order.service",
        running=None,
        enabled=False,
        _sudo=True,
    )

    removed_mount_order_service = files.file(
        name="Remove nested ZFS mount ordering",
        path="/etc/systemd/system/zfs-mount-order.service",
        present=False,
        _sudo=True,
    )

    systemd.daemon_reload(
        name="Reload systemd after removing nested ZFS mount ordering",
        _sudo=True,
        _if=removed_mount_order_service.did_change,
    )

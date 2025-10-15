from pyinfra.operations import apt

_ = apt.packages(
    name="Install ZFS utilities and kernel modules",
    _sudo=True,
    packages=[
        "zfsutils-linux",
        "nfs-kernel-server",
    ],
    update=True,
)

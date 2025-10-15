from pyinfra.context import host
from pyinfra.operations import server, apt
import sys

disk_config = host.data.get("wipe_disk")
if not disk_config:
    sys.exit("No wipe_disk configuration found in host data - check inventory.py")

disk_path = disk_config.get("path")
if not disk_path:
    sys.exit("No disk path specified in wipe_disk.path configuration")

confirm_wipe = disk_config.get("confirm_wipe", False)
if not confirm_wipe:
    sys.exit(f"Disk wipe not confirmed - set wipe_disk.confirm_wipe=True to proceed with wiping {disk_path}")

zero_size_mb = disk_config.get("zero_size_mb", 100)

PROTECTED_DEVICES = ["/dev/sda", "/dev/vda", "/dev/nvme0n1", "/dev/mmcblk0"]
PROTECTED_MOUNT_PATHS = ["/", "/boot", "/boot/efi", "/boot/firmware", "/home", "/var", "/usr"]

if disk_path in PROTECTED_DEVICES:
    sys.exit(f"Cannot wipe protected system device: {disk_path}")

_ = server.shell(
    name=f"Verify {disk_path} exists",
    _sudo=True,
    commands=[
        f"test -b {disk_path} || (echo 'ERROR: {disk_path} is not a block device or does not exist' && exit 1)",
    ],
)

_ = apt.packages(
    name="Install disk management utilities",
    _sudo=True,
    packages=[
        "util-linux",
        "parted",
    ],
)

mount_check = server.shell(
    name=f"Check if {disk_path} or its partitions are mounted",
    _sudo=True,
    commands=[
        f"mount | grep '^{disk_path}' || true",
    ],
)

_ = server.shell(
    name=f"Verify {disk_path} is not mounted on protected paths",
    _sudo=True,
    commands=[
        f"""
        if mount | grep '^{disk_path}' | grep -E '({"|".join(PROTECTED_MOUNT_PATHS)})$'; then
            echo "ERROR: {disk_path} is mounted on a protected system path"
            exit 1
        fi
        """,
    ],
)

_ = server.shell(
    name=f"Unmount all partitions on {disk_path}",
    _sudo=True,
    commands=[
        f"umount {disk_path}* 2>/dev/null || true",
    ],
)

_ = server.shell(
    name=f"Wipe filesystem signatures from {disk_path}",
    _sudo=True,
    commands=[
        f"wipefs --all --force {disk_path}",
    ],
)

_ = server.shell(
    name=f"Zero first {zero_size_mb}MB of {disk_path}",
    _sudo=True,
    commands=[
        f"dd if=/dev/zero of={disk_path} bs=1M count={zero_size_mb} status=progress",
    ],
)

_ = server.shell(
    name=f"Verify {disk_path} has no partition table",
    _sudo=True,
    commands=[
        f"parted --script {disk_path} print || echo 'No partition table found (expected)'",
    ],
)

_ = server.shell(
    name=f"Display final status of {disk_path}",
    _sudo=True,
    commands=[
        f"echo 'Successfully wiped {disk_path}'",
        f"lsblk {disk_path}",
    ],
)

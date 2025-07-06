from pyinfra.operations import files, server, apt
from pyinfra.facts.server import LinuxName
from pyinfra.facts.files import File
from pyinfra.context import host
from io import StringIO
import os

# Configuration
BOOT_CONFIG_PATH = "/boot/firmware/config.txt"
EEPROM_CONFIG_BOOT_ORDER = "0xf416"  # NVMe first, then other devices
RPI_CLONE_URL = "https://github.com/geerlingguy/rpi-clone"

PCIE_GEN_SPEED = host.data.get("raspberry_pi.pcie_gen_speed", 2)  # Default to Gen 2 (Pi 5 rated speed)
ENABLE_PCIE_PROBE = host.data.get("raspberry_pi.enable_pcie_probe", True)
SET_BOOT_ORDER = host.data.get("raspberry_pi.set_boot_order", False)
CLONE_TO_NVME = host.data.get("raspberry_pi.clone_to_nvme", True)
NVME_DEVICE = host.data.get("raspberry_pi.nvme_device", "nvme0n1")
ROOT_PARTITION_SIZE = host.data.get("raspberry_pi.root_partition_size", "128G")  # Custom root partition size
BOOT_PARTITION_SIZE = host.data.get("raspberry_pi.boot_partition_size", "512M")  # Boot partition size
PARTITION_TABLE_TYPE = "msdos"  # Use MSDOS for compatibility

distro = host.get_fact(LinuxName)
if not (distro and "raspbian" in distro.lower()):
    print("Warning: This script is designed for Raspberry Pi OS")

_ = apt.packages(
    name="Install git and parted",
    _sudo=True,
    packages=[
        "git",
        "parted",
    ],
)

_ = files.line(
    name="Add pciex1 dtparam to config.txt",
    _sudo=True,
    path=BOOT_CONFIG_PATH,
    line="dtparam=pciex1",
    present=True,
)

_ = files.line(
    name=f"Add pciex1_gen={PCIE_GEN_SPEED} dtparam to config.txt",
    _sudo=True,
    path=BOOT_CONFIG_PATH,
    line=f"dtparam=pciex1_gen={PCIE_GEN_SPEED}",
    present=True,
)

if SET_BOOT_ORDER:
    _ = server.shell(
        name="Set NVMe boot priority using raspi-config",
        _sudo=True,
        commands=[
            "raspi-config nonint do_boot_order B2",  # B2 = NVMe/USB Boot
        ],
    )

_ = server.shell(
    name="Unmount all partitions",
    _sudo=True,
    commands=[
        f"umount /dev/{NVME_DEVICE}* || true",  # Don't fail if nothing mounted
    ],
)

_ = server.shell(
    name="Force wipe all partitions",
    _sudo=True,
    commands=[
        f"wipefs --all --force /dev/{NVME_DEVICE}",
    ],
)

_ = server.shell(
    name="Zero out NVMe partition table",
    _sudo=True,
    commands=[
        f"dd if=/dev/zero of=/dev/{NVME_DEVICE} bs=1024 count=1024",
    ],
)

# Create GPT partition table and partitions
_ = server.shell(
    name="Create GPT partition table",
    _sudo=True,
    commands=[
        f"parted --script /dev/{NVME_DEVICE} mklabel {PARTITION_TABLE_TYPE}",
    ],
)

_ = server.shell(
    name="Create boot partition (FAT32)",
    _sudo=True,
    commands=[
        f"parted --script /dev/{NVME_DEVICE} mkpart primary fat32 1MiB {BOOT_PARTITION_SIZE}",
        f"parted --script /dev/{NVME_DEVICE} set 1 boot on",
    ],
)

_ = server.shell(
    name="Create root partition (ext4)",
    _sudo=True,
    commands=[
        f"parted --script /dev/{NVME_DEVICE} mkpart primary ext4 {BOOT_PARTITION_SIZE} {ROOT_PARTITION_SIZE}",
    ],
)

# Create data partition using remaining space
_ = server.shell(
    name="Create data partition (ext4)",
    _sudo=True,
    commands=[
        f"parted --script /dev/{NVME_DEVICE} mkpart primary ext4 {ROOT_PARTITION_SIZE} 100%",
    ],
)

# Format the partitions
_ = server.shell(
    name="Format boot partition as FAT32",
    _sudo=True,
    commands=[
        f"mkfs.vfat -F 32 /dev/{NVME_DEVICE}p1",
    ],
)

_ = server.shell(
    name="Format root partition as ext4",
    _sudo=True,
    commands=[
        f"mkfs.ext4 -F /dev/{NVME_DEVICE}p2",
    ],
)

_ = server.shell(
    name="Format data partition as ext4",
    _sudo=True,
    commands=[
        f"mkfs.ext4 -F /dev/{NVME_DEVICE}p3",
    ],
)

# Download rpi-clone
_ = server.shell(
    name="Clone rpi-clone repository",
    _sudo=True,
    commands=[
        "rm -rf /tmp/rpi-clone",
        f"git clone {RPI_CLONE_URL} /tmp/rpi-clone",
    ],
)

_ = server.shell(
    name="Install rpi-clone",
    _sudo=True,
    commands=[
        "chmod +x /tmp/rpi-clone/rpi-clone",
        "cp /tmp/rpi-clone/rpi-clone /usr/local/bin/",
    ],
)

# Clone SD card to NVMe using rpi-clone
if CLONE_TO_NVME:
    _ = server.shell(
        name="Clone SD card to NVMe using rpi-clone",
        _sudo=True,
        commands=[
            f"/usr/local/bin/rpi-clone -u {NVME_DEVICE}",
        ],
    )

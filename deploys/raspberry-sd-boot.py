from pyinfra.operations import files, server, apt
from pyinfra.facts.server import LinuxName
from pyinfra.facts.files import File
from pyinfra.context import host
from io import StringIO

# Configuration
BOOT_CONFIG_PATH = "/boot/firmware/config.txt"
REMOVE_PCIE_CONFIG = host.data.get("raspberry_pi.remove_pcie_config", False)  # Remove PCIe config by default

# Check if this is a Raspberry Pi system
distro = host.get_fact(LinuxName)
if not (distro and "raspbian" in distro.lower()):
    print("Warning: This script is designed for Raspberry Pi OS")

# Reset boot order to SD card using raspi-config
_ = server.shell(
    name="Reset boot order to SD card using raspi-config",
    _sudo=True,
    commands=[
        "raspi-config nonint do_boot_order B1",  # B1 = SD Card Boot
    ],
    _ignore_errors=True,
)

# Remove PCIe configuration from config.txt if requested
if REMOVE_PCIE_CONFIG:
    # Remove NVMe configuration comment
    _ = files.line(
        name="Remove NVMe configuration comment from config.txt",
        _sudo=True,
        path=BOOT_CONFIG_PATH,
        line="# NVMe SSD Boot Configuration",
        present=False,
        _ignore_errors=True,
    )
    
    # Remove PCIe enable parameter
    _ = files.line(
        name="Remove dtparam=pciex1 from config.txt",
        _sudo=True,
        path=BOOT_CONFIG_PATH,
        line="dtparam=pciex1",
        present=False,
        _ignore_errors=True,
    )
    
    # Remove PCIe gen speed parameters (Gen 2 and Gen 3)
    _ = files.line(
        name=f"Remove dtparam=pciex1_gen=3|4 from config.txt",
        _sudo=True,
        path=BOOT_CONFIG_PATH,
        line=r"dtparam=pciex1_gen=3|4",
        present=False,
        _ignore_errors=True,
    )


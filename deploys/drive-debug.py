from pyinfra.operations import apt, server

apt.packages(
    name="Install NVMe diagnostic tools",
    _sudo=True,
    packages=[
        "smartmontools",
        "nvme-cli",
        "pciutils",
        "hdparm",
    ],
    update=True,
)

server.shell(
    name="Display PCI NVMe devices",
    _sudo=True,
    commands=[
        "echo '=== PCI NVMe Devices ==='",
        "lspci -nn -D | grep -i nvme || echo 'No NVMe devices found in PCI'",
    ],
)

server.shell(
    name="List all NVMe subsystems and namespaces",
    _sudo=True,
    commands=[
        "echo '=== NVMe Device List ==='",
        "nvme list || echo 'No NVMe devices detected by nvme-cli'",
    ],
)

server.shell(
    name="List block devices including NVMe",
    _sudo=True,
    commands=[
        "echo '=== Block Device Tree ==='",
        "lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL,SERIAL,STATE || lsblk",
    ],
)

server.shell(
    name="Check kernel NVMe device recognition",
    _sudo=True,
    commands=[
        "echo '=== Kernel NVMe Devices ==='",
        "ls -lah /dev/nvme* || echo 'No /dev/nvme* devices found'",
    ],
)

server.shell(
    name="Get SMART data for nvme0 (working drive)",
    _sudo=True,
    commands=[
        "echo '=== SMART Data for nvme0 (Kingston OM8PGP4) ==='",
        "smartctl -a /dev/nvme0 || echo 'Failed to read SMART data from nvme0'",
    ],
)

server.shell(
    name="Get NVMe SMART log for nvme0",
    _sudo=True,
    commands=[
        "echo '=== NVMe SMART Log for nvme0 ==='",
        "nvme smart-log /dev/nvme0 || echo 'Failed to get nvme smart-log for nvme0'",
    ],
)

server.shell(
    name="Get NVMe error log for nvme0",
    _sudo=True,
    commands=[
        "echo '=== NVMe Error Log for nvme0 ==='",
        "nvme error-log /dev/nvme0 || echo 'Failed to get error log for nvme0'",
    ],
)

server.shell(
    name="Attempt to detect nvme1 (failed Lexar drive)",
    _sudo=True,
    commands=[
        "echo '=== Attempting nvme1 Detection ==='",
        "ls -lah /dev/nvme1* 2>&1 || echo 'nvme1 device not found in /dev'",
    ],
)

server.shell(
    name="Try to get SMART data for nvme1 if device exists",
    _sudo=True,
    commands=[
        "echo '=== SMART Data Attempt for nvme1 (Lexar NM790) ==='",
        "if [ -e /dev/nvme1 ]; then smartctl -a /dev/nvme1; else echo 'nvme1 device not accessible for SMART query'; fi",
    ],
)

server.shell(
    name="Check kernel messages for NVMe errors",
    _sudo=True,
    commands=[
        "echo '=== Recent Kernel Messages for NVMe ==='",
        "dmesg | grep -i nvme | tail -n 50",
    ],
)

server.shell(
    name="Check NVMe driver and module status",
    _sudo=True,
    commands=[
        "echo '=== NVMe Kernel Module Status ==='",
        "lsmod | grep nvme || echo 'No NVMe modules loaded'",
    ],
)

server.shell(
    name="Get detailed PCI information for NVMe controllers",
    _sudo=True,
    commands=[
        "echo '=== Detailed PCI Info for NVMe Controllers ==='",
        "for dev in $(lspci -D | grep -i nvme | cut -d' ' -f1); do echo \"--- Device: $dev ---\"; lspci -vvv -s $dev; done",
    ],
)

server.shell(
    name="Scan for any uninitialized NVMe devices",
    _sudo=True,
    commands=[
        "echo '=== NVMe Device Scan ==='",
        "nvme list-subsys || echo 'Failed to list NVMe subsystems'",
    ],
)

server.shell(
    name="Check NVMe namespace information",
    _sudo=True,
    commands=[
        "echo '=== NVMe Namespace Information ==='",
        "for dev in /dev/nvme[0-9]; do if [ -e $dev ]; then echo \"--- $dev ---\"; nvme id-ctrl $dev 2>&1 || echo \"Failed to query $dev\"; fi; done",
    ],
)

server.shell(
    name="Display drive temperatures and health summary",
    _sudo=True,
    commands=[
        "echo '=== Drive Health Summary ==='",
        "for dev in /dev/nvme[0-9]; do if [ -e $dev ]; then echo \"--- $dev ---\"; smartctl -A $dev | grep -E 'Temperature|Percentage Used|Available Spare|Critical Warning' || echo \"Limited health data for $dev\"; fi; done",
    ],
)

server.shell(
    name="Check for PCIe link errors or issues",
    _sudo=True,
    commands=[
        "echo '=== PCIe Link Status for NVMe ==='",
        "for dev in $(lspci -D | grep -i nvme | cut -d' ' -f1); do echo \"--- Device: $dev ---\"; lspci -vvv -s $dev | grep -E 'LnkCap|LnkSta|DevSta' || echo \"No PCIe link info\"; done",
    ],
)

server.shell(
    name="Summary - Detected NVMe devices",
    _sudo=True,
    commands=[
        "echo '=== SUMMARY ==='",
        "echo 'PCI NVMe Controllers:'",
        "lspci -D | grep -i nvme | wc -l",
        "echo 'Kernel /dev/nvme* devices:'",
        "ls -1 /dev/nvme* 2>/dev/null | wc -l || echo '0'",
        "echo 'nvme-cli detected devices:'",
        "nvme list 2>/dev/null | grep -c '/dev/nvme' || echo '0'",
    ],
)

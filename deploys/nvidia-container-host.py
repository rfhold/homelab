from pyinfra.operations import apt, files

# Configuration variables
NVIDIA_DRIVER_VERSION = "580"
NVIDIA_GPG_KEY_URL = "https://nvidia.github.io/libnvidia-container/gpgkey"
NVIDIA_TOOLKIT_LIST_URL = "https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list"
NVIDIA_KERNEL_MODULES_PACKAGE = f"linux-modules-nvidia-{
    NVIDIA_DRIVER_VERSION}-server-generic"
NVIDIA_DRIVER_PACKAGE = f"nvidia-driver-{NVIDIA_DRIVER_VERSION}-server"

_ = apt.packages(
    name=f"Add {NVIDIA_KERNEL_MODULES_PACKAGE}",
    _sudo=True,
    packages=[
        NVIDIA_KERNEL_MODULES_PACKAGE,
    ],
)

_ = apt.key(
    name=f"Add NVIDIA GPG key from {NVIDIA_GPG_KEY_URL}",
    _sudo=True,
    src=NVIDIA_GPG_KEY_URL,
)

_ = files.download(
    name=f"Download NVIDIA container toolkit source list from {
        NVIDIA_TOOLKIT_LIST_URL}",
    _sudo=True,
    src=NVIDIA_TOOLKIT_LIST_URL,
    dest="/etc/apt/sources.list.d/nvidia-container-toolkit.list",
)

_ = apt.packages(
    name=f"Add NVIDIA server driver {NVIDIA_DRIVER_PACKAGE}",
    _sudo=True,
    update=True,
    packages=[
        NVIDIA_DRIVER_PACKAGE,
    ],
)

_ = apt.packages(
    name=f"Add nvidia-container-runtime and nvidia-container-toolkit",
    _sudo=True,
    packages=[
        "nvidia-container-runtime",
        "nvidia-container-toolkit",
    ],
)

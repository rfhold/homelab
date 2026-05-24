from pyinfra.context import host
from pyinfra.facts.files import File
from pyinfra.operations import apt, files, server

NVIDIA_DRIVER_VERSION = "580"
NVIDIA_GPG_KEY_URL = "https://nvidia.github.io/libnvidia-container/gpgkey"
NVIDIA_TOOLKIT_LIST_URL = "https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list"
NVIDIA_DRIVER_PACKAGES = [
    "linux-headers-generic",
    f"nvidia-driver-{NVIDIA_DRIVER_VERSION}-server",
    f"nvidia-dkms-{NVIDIA_DRIVER_VERSION}-server",
    f"nvidia-utils-{NVIDIA_DRIVER_VERSION}-server",
]
NVIDIA_TOOLKIT_PACKAGES = [
    "nvidia-container-runtime",
    "nvidia-container-toolkit",
]

_ = apt.packages(
    name="Add NVIDIA container toolkit repository dependencies",
    _sudo=True,
    packages=[
        "ca-certificates",
        "gnupg",
        "wget",
    ],
)

_ = files.directory(
    name="Create APT keyrings directory",
    _sudo=True,
    path="/etc/apt/keyrings/",
    mode="0755",
    user="root",
    group="root",
    present=True,
)

gpg_key_path = "/etc/apt/keyrings/nvidia-container-toolkit.gpg"
existing_key = host.get_fact(File, gpg_key_path)

if existing_key is None:
    _ = server.shell(
        name=f"Download and install NVIDIA GPG key from {NVIDIA_GPG_KEY_URL}",
        _sudo=True,
        commands=[
            f"wget -q -O - {NVIDIA_GPG_KEY_URL} | gpg --dearmor > {gpg_key_path}"
        ],
    )

sources_list_path = "/etc/apt/sources.list.d/nvidia-container-toolkit.list"
existing_sources = host.get_fact(File, sources_list_path)

if existing_sources is None:
    _ = server.shell(
        name=f"Download and configure NVIDIA container toolkit source list from {NVIDIA_TOOLKIT_LIST_URL}",
        _sudo=True,
        commands=[
            f"wget -q -O - {NVIDIA_TOOLKIT_LIST_URL} | sed 's|^deb |deb [signed-by={gpg_key_path}] |' > {sources_list_path}"
        ],
    )

_ = apt.packages(
    name="Add NVIDIA server driver packages",
    _sudo=True,
    update=True,
    packages=NVIDIA_DRIVER_PACKAGES,
)

_ = apt.packages(
    name="Add NVIDIA container runtime and toolkit",
    _sudo=True,
    packages=NVIDIA_TOOLKIT_PACKAGES,
)

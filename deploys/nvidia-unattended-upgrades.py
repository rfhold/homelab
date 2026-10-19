from pathlib import Path

from pyinfra.operations import files

_ = files.put(
    name="Exclude NVIDIA packages from unattended upgrades",
    _sudo=True,
    src=str(Path(__file__).parent / "files" / "52unattended-upgrades-nvidia"),
    dest="/etc/apt/apt.conf.d/52unattended-upgrades-nvidia",
    user="root",
    group="root",
    mode="0644",
    create_remote_dir=False,
)

import io

from pyinfra.context import host
from pyinfra.facts.files import File
from pyinfra.operations import files, server
from pyinfra.operations.util import any_changed

UDEV_RULES_PATH = "/etc/udev/rules.d/99-amd-kfd.rules"
UDEV_RULES_CONTENT = """SUBSYSTEM=="kfd", GROUP="render", MODE="0666", OPTIONS+="last_rule"
SUBSYSTEM=="drm", KERNEL=="card[0-9]*", GROUP="render", MODE="0666", OPTIONS+="last_rule"
"""

existing_rules = host.get_fact(File, UDEV_RULES_PATH)

if existing_rules is None or existing_rules != UDEV_RULES_CONTENT.strip():
    rules_file = files.put(
        name="Create AMD KFD udev rules for container GPU access",
        _sudo=True,
        src=io.StringIO(UDEV_RULES_CONTENT),
        dest=UDEV_RULES_PATH,
        mode="0644",
        user="root",
        group="root",
        create_remote_dir=False,
    )

    _ = server.shell(
        name="Reload udev rules",
        _sudo=True,
        commands=["udevadm control --reload-rules", "udevadm trigger"],
        _if=any_changed(rules_file),
    )

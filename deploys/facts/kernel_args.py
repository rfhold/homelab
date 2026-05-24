import shlex
from collections.abc import Iterable
from typing import TypedDict

from pyinfra.api import FactBase

GRUB_CONFIG_PATH = "/etc/default/grub"
GRUB_MARKER = "__PYINFRA_KERNEL_ARGS_GRUB__"
UNAVAILABLE_MARKER = "__PYINFRA_KERNEL_ARGS_UNAVAILABLE__"


class KernelArgsFact(TypedDict):
    available: bool
    backend: str
    configured: bool
    arguments: list[str]


def parse_grub_cmdline(value: str) -> list[str]:
    stripped = value.strip()
    if not stripped:
        return []

    values = shlex.split(stripped, comments=False, posix=True)
    if len(values) == 1:
        stripped = values[0]

    return shlex.split(stripped, comments=False, posix=True)


class KernelArgs(FactBase[KernelArgsFact]):
    def command(self, path: str = GRUB_CONFIG_PATH) -> str:
        quoted_path = shlex.quote(path)
        return (
            f"if [ -f {quoted_path} ]; then "
            f"printf '%s\\n' {shlex.quote(GRUB_MARKER)}; "
            f"grep -E '^GRUB_CMDLINE_LINUX_DEFAULT=' {quoted_path} | sed 's/^[^=]*=//' | head -n 1; "
            f"else printf '%s\\n' {shlex.quote(UNAVAILABLE_MARKER)}; fi"
        )

    def process(self, output: Iterable[str]) -> KernelArgsFact:
        lines = list(output)
        if not lines or lines[0] == UNAVAILABLE_MARKER:
            return {
                "available": False,
                "backend": "grub",
                "configured": False,
                "arguments": [],
            }

        configured = len(lines) > 1
        value = lines[1] if configured else ""

        return {
            "available": True,
            "backend": "grub",
            "configured": configured,
            "arguments": parse_grub_cmdline(value),
        }

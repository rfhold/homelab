import shlex
from collections.abc import Iterator, Mapping
from typing import cast

from pyinfra.api import operation
from pyinfra.context import host
from pyinfra.facts.server import Which

from deploys.facts.kernel_args import GRUB_CONFIG_PATH, KernelArgs


KernelArgValue = str | None


def split_kernel_arg(argument: str) -> tuple[str, str | None]:
    name, separator, value = argument.partition("=")
    return name, value if separator else None


def format_kernel_arg(name: str, value: KernelArgValue) -> str:
    return name if value is None or value == "" else f"{name}={value}"


def merge_kernel_args(existing: list[str], desired: Mapping[str, KernelArgValue]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()

    for argument in existing:
        name, _ = split_kernel_arg(argument)
        if name not in desired:
            merged.append(argument)
            continue

        if name not in seen:
            merged.append(format_kernel_arg(name, desired[name]))
            seen.add(name)

    for name, value in desired.items():
        if name not in seen:
            merged.append(format_kernel_arg(name, value))

    return merged


def grub_cmdline_line(arguments: list[str]) -> str:
    return f'GRUB_CMDLINE_LINUX_DEFAULT="{shlex.join(arguments)}"'


def sed_replacement(value: str) -> str:
    return value.replace("\\", "\\\\").replace("&", r"\&").replace("|", r"\|")


@operation()
def kernel_args(
    arguments: Mapping[str, KernelArgValue],
    path: str = GRUB_CONFIG_PATH,
    update_command: str = "update-grub",
) -> Iterator[str]:
    current = cast(dict[str, object], host.get_fact(KernelArgs, path=path))
    if not current["available"]:
        raise ValueError(f"kernel arguments are unavailable: supported GRUB config {path} not found")

    update_grub = host.get_fact(Which, update_command)
    if not update_grub:
        raise ValueError(f"kernel arguments cannot be applied: {update_command} command not found")

    existing = cast(list[str], current["arguments"])
    desired = merge_kernel_args(existing, arguments)

    if existing == desired:
        host.noop("kernel arguments already match desired state")
        return

    line = grub_cmdline_line(desired)
    quoted_path = shlex.quote(path)

    if current["configured"]:
        yield (
            f"sed -i.bak 's|^GRUB_CMDLINE_LINUX_DEFAULT=.*|{sed_replacement(line)}|' "
            f"{quoted_path}"
        )
    else:
        yield f"printf '%s\\n' {shlex.quote(line)} >> {quoted_path}"

    yield shlex.quote(update_command)

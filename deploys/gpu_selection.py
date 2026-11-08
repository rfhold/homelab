import argparse
import json
import os
import re
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any


GPU_HELPER = "/usr/local/libexec/homelab-gpu-selection.py"


def systemd_quote(value: object, expand_dollars: bool = True) -> str:
    text = str(value)
    if any(ord(character) < 32 for character in text):
        raise ValueError("Systemd values must not contain control characters")
    quoted = json.dumps(text, ensure_ascii=False).replace("%", "%%")
    return quoted.replace("$", "$$") if expand_dollars else quoted


def systemd_text(value: object) -> str:
    text = str(value)
    if any(ord(character) < 32 for character in text):
        raise ValueError("Systemd values must not contain control characters")
    return text.replace("%", "%%")


def gpu_command(configuration: Mapping[str, Any], mode: str) -> list[str]:
    return [
        "/usr/bin/python3",
        GPU_HELPER,
        mode,
        configuration["gpu_vendor"],
        configuration["gpu_device"],
        "optional" if configuration.get("gpu_optional", False) else "required",
    ]


class SelectionError(ValueError):
    pass


def select_render_node(
    vendor: str,
    device: str,
    sysfs: Path = Path("/sys/class/drm"),
    dev: Path = Path("/dev/dri"),
) -> str | None:
    if not all(re.fullmatch(r"[0-9a-f]{4}", value) for value in (vendor, device)):
        raise SelectionError("GPU vendor and device must be four lowercase hex digits")
    matches = []
    for entry in sysfs.glob("renderD*"):
        if not re.fullmatch(r"renderD[0-9]+", entry.name):
            continue
        try:
            identity = tuple(
                (entry / "device" / key).read_text().strip().lower()
                for key in ("vendor", "device")
            )
        except OSError as error:
            raise SelectionError(f"Cannot inspect GPU identity: {entry.name}") from error
        if not all(re.fullmatch(r"0x[0-9a-f]{4}", value) for value in identity):
            raise SelectionError(f"Invalid GPU identity: {entry.name}")
        if identity == (f"0x{vendor}", f"0x{device}"):
            matches.append(str(dev / entry.name))
    if len(matches) > 1:
        raise SelectionError("GPU identity is ambiguous")
    return matches[0] if matches else None


def main(arguments: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("check", "run"))
    parser.add_argument("vendor")
    parser.add_argument("device")
    parser.add_argument("policy", choices=("required", "optional"))
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(arguments)
    try:
        node = select_render_node(args.vendor, args.device)
        if node is None:
            print("Selected GPU is absent", file=sys.stderr)
            return 1 if args.mode == "check" and args.policy == "optional" else 255
        if not Path(node).is_char_device():
            raise SelectionError("Selected GPU render node is unavailable")
        if args.mode == "run":
            command = args.command
            if command[:1] == ["--"]:
                command = command[1:]
            if not command or "@GPU_RENDER@" not in command:
                raise SelectionError("GPU run command must contain a render-node argument")
            os.execv(
                command[0],
                [node if argument == "@GPU_RENDER@" else argument for argument in command],
            )
        return 0
    except (SelectionError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 255


if __name__ == "__main__":
    sys.exit(main())

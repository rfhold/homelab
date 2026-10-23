import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest


KURI_ROOT = Path(sys.argv.pop(1)).resolve() if len(sys.argv) > 1 else None
IMAGE_ROOT = Path(__file__).resolve().parent


class ProtobufImageContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if KURI_ROOT is None:
            raise RuntimeError("Usage: python3 test_protobuf_image_contract.py /path/to/kuri")
        cls.checker = KURI_ROOT / "scripts/check-protobuf-tools.sh"
        cls.pins = dict(
            line.split()
            for line in subprocess.check_output(
                ["sh", str(cls.checker), "--versions"], text=True
            ).splitlines()
        )
        cls.dockerfile = (IMAGE_ROOT / "Dockerfile").read_text()
        cls.versions = (IMAGE_ROOT / "versions.sh").read_text()

    def test_image_install_and_runtime_checks_match_kuri(self) -> None:
        self.assertEqual(set(self.pins), {"protoc-gen-prost", "protoc-gen-tonic"})
        for tool, version in self.pins.items():
            variable = "PROST_PLUGIN_VERSION" if tool.endswith("prost") else "TONIC_PLUGIN_VERSION"
            self.assertRegex(self.dockerfile, rf"(?m)^ARG {variable}={re.escape(version)}$")
            self.assertRegex(
                self.dockerfile,
                rf'(?m)^    cargo install --locked {re.escape(tool)} --version "\$\{{{variable}\}}" && \\$',
            )
            self.assertIn(f'test "$({tool} --version)" = "{version}"', self.versions)
            self.assertRegex(
                (KURI_ROOT / "buf.gen.yaml").read_text(),
                rf"(?m)^\s+- local: {re.escape(tool)}$",
            )
        self.assertNotRegex(self.dockerfile, r"(?m)^FROM --platform=")
        self.assertIn('registry = "sparse+https://mirrors.holdenitdown.net/cargo/api/v1/cratesio/"', self.dockerfile)

    def run_checker(self, overrides: dict[str, str]) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory(prefix="protobuf-contract-") as directory:
            for tool, version in self.pins.items():
                path = Path(directory) / tool
                path.write_text(f"#!/bin/sh\nprintf '%s\\n' '{overrides.get(tool, version)}'\n")
                path.chmod(0o755)
            return subprocess.run(
                ["/bin/sh", str(self.checker)],
                env={**os.environ, "PATH": directory},
                capture_output=True,
                text=True,
                check=False,
            )

    def test_checker_accepts_pinned_tools(self) -> None:
        result = self.run_checker({})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_checker_rejects_each_mismatched_tool(self) -> None:
        for tool in self.pins:
            with self.subTest(tool=tool):
                result = self.run_checker({tool: "0.0.0"})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"{tool}: expected", result.stderr)

    def test_checker_reports_missing_tools(self) -> None:
        with tempfile.TemporaryDirectory(prefix="protobuf-contract-") as directory:
            result = subprocess.run(
                ["/bin/sh", str(self.checker)],
                env={**os.environ, "PATH": directory},
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cargo install --locked protoc-gen-prost --version", result.stderr)


if __name__ == "__main__":
    unittest.main()

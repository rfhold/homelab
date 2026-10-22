import ast
import shlex
import unittest
from pathlib import Path

from jinja2 import Environment, FileSystemLoader


ROOT = Path(__file__).resolve().parents[2]


def vulkan_llama_cpp() -> dict:
    tree = ast.parse((ROOT / "inventory.py").read_text())
    for node in ast.walk(tree):
        if not isinstance(node, ast.Tuple) or len(node.elts) != 2:
            continue
        hostname, data = node.elts
        if (
            not isinstance(hostname, ast.Constant)
            or hostname.value != "vulkan.holdenitdown.net"
        ):
            continue
        if not isinstance(data, ast.Dict):
            continue
        for key, value in zip(data.keys, data.values):
            if isinstance(key, ast.Constant) and key.value == "llama_cpp":
                return ast.literal_eval(value)
    raise AssertionError("Vulkan llama_cpp configuration not found")


class VulkanInventoryTest(unittest.TestCase):
    def test_flint_configuration(self) -> None:
        self.assertEqual(
            vulkan_llama_cpp(),
            {
                "unit": "llama-cpp-flint.service",
                "container_name": "flint",
                "service_description": "llama.cpp Flint inference service",
                "image": "ghcr.io/ggml-org/llama.cpp:server-vulkan@sha256:a644fb651975d9dea49140302577a3b945993fd5efd3400bf89c7d525d03c103",
                "model_cache_dir": "/var/lib/llama-cpp/models/flint",
                "hf_repo": "unsloth/flint-GGUF",
                "hf_file": "flint-Q8_0.gguf",
                "alias": "flint",
                "cosmos_labels": ["cosmos"],
                "context_size": 262144,
                "devices": ["Vulkan0"],
                "gpu_layers": "auto",
                "split_mode": "none",
                "tensor_split": [1],
                "fit": "on",
                "fit_target": [2048],
                "parallel_requests": 1,
                "port": 8000,
            },
        )

    def test_flint_unit_render(self) -> None:
        environment = Environment(
            loader=FileSystemLoader(ROOT / "deploys/llama_cpp/templates")
        )
        rendered = environment.get_template("llama-cpp.service.j2").render(
            **vulkan_llama_cpp()
        )
        command = next(
            line.removeprefix("ExecStart=")
            for line in rendered.splitlines()
            if line.startswith("ExecStart=")
        )
        arguments = shlex.split(command)
        server = arguments[arguments.index("--hf-repo") :]
        for flag, value in {
            "--hf-repo": "unsloth/flint-GGUF",
            "--hf-file": "flint-Q8_0.gguf",
            "--alias": "flint",
            "--ctx-size": "262144",
            "--device": "Vulkan0",
            "--n-gpu-layers": "auto",
            "--split-mode": "none",
            "--tensor-split": "1",
            "--fit": "on",
            "--fit-target": "2048",
            "--parallel": "1",
            "--port": "8000",
        }.items():
            self.assertEqual(server[server.index(flag) + 1], value)
        self.assertEqual(
            arguments[arguments.index("--hf-repo") - 1], vulkan_llama_cpp()["image"]
        )
        self.assertNotIn("ROCm", rendered)
        self.assertNotIn("Vulkan1", rendered)
        self.assertIn('Environment="COSMOS_LABELS=cosmos"', rendered)
        self.assertIn("source=/var/lib/llama-cpp/models/flint,target=/models", rendered)


if __name__ == "__main__":
    unittest.main()

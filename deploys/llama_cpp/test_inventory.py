import ast
import importlib
import runpy
import shlex
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from jinja2 import Environment, FileSystemLoader

from deploys.llama_cpp.render import configurations, render_context


ROOT = Path(__file__).resolve().parents[2]


def vulkan_llama_cpp(key_name: str = "llama_cpp") -> dict | list:
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
            if isinstance(key, ast.Constant) and key.value == key_name:
                return ast.literal_eval(value)
    raise AssertionError("Vulkan llama_cpp configuration not found")


class VulkanInventoryTest(unittest.TestCase):
    def test_flint_configuration(self) -> None:
        self.assertEqual(
            vulkan_llama_cpp(),
            {
                "gpu_vendor": "1002",
                "gpu_device": "1586",
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
            **render_context(vulkan_llama_cpp())
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
        self.assertIn("After=network-online.target docker.service systemd-udev-settle.service", rendered)
        self.assertIn("source=/var/lib/llama-cpp/models/flint,target=/models", rendered)
        self.assertIn('"check" "1002" "1586" "required"', rendered)
        docker = arguments[arguments.index("/usr/bin/docker"):arguments.index(vulkan_llama_cpp()["image"])]
        self.assertEqual([docker[index + 1] for index, item in enumerate(docker) if item == "--device"], ["/dev/kfd", "@GPU_RENDER@"])

    def test_qwen_contract(self) -> None:
        configuration = vulkan_llama_cpp("llama_cpp_services")[0]
        self.assertEqual(configuration["port"], 8002)
        self.assertEqual(configuration["gpu_device"], "744c")
        self.assertTrue(configuration["gpu_optional"])
        context = render_context(configuration)
        self.assertIn('"check" "1002" "744c" "optional"', context["condition_command"])
        arguments = shlex.split(context["start_command"])
        server = arguments[arguments.index("--hf-repo"):]
        for flag, value in {
            "--hf-repo": "HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive",
            "--hf-file": "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf",
            "--alias": "qwen3.5-9b-hauhaucs-aggressive",
            "--ctx-size": "262144", "--device": "Vulkan0", "--n-gpu-layers": "999",
            "--fit": "off", "--parallel": "1", "--cache-type-k": "q8_0", "--cache-type-v": "q8_0",
            "--reasoning": "on", "--reasoning-format": "deepseek", "--temp": "0.6", "--top-p": "0.95",
            "--top-k": "20", "--min-p": "0", "--presence-penalty": "0", "--repeat-penalty": "1",
        }.items():
            self.assertEqual(server[server.index(flag) + 1], value)
        self.assertIn("--jinja", server)
        self.assertNotIn("--mtp", server)
        self.assertNotIn("--no-mmproj", server)
        kwargs = server[server.index("--chat-template-kwargs") + 1]
        self.assertEqual(kwargs.replace("$$", "$"), '{"enable_thinking":false}')
        self.assertNotIn('"/dev/dri"', context["start_command"])

    def test_singleton_and_multiple_services(self) -> None:
        from pyinfra.api.host import HostData

        flint = vulkan_llama_cpp()
        qwen = vulkan_llama_cpp("llama_cpp_services")[0]
        self.assertEqual(configurations({"llama_cpp": flint}), [flint])
        self.assertEqual(configurations(HostData(SimpleNamespace(), {"llama_cpp": flint})), [flint])
        self.assertEqual(configurations({"llama_cpp": flint, "llama_cpp_services": [qwen]}), [flint, qwen])
        with self.assertRaises(ValueError):
            configurations({"llama_cpp": flint, "llama_cpp_services": [flint]})

    def test_unit_escaping(self) -> None:
        configuration = vulkan_llama_cpp()
        literal = 'a space "quote" \\slash 100% $HOME ; false'
        configuration["alias"] = literal
        configuration["cosmos_labels"] = ["literal$LABEL%"]
        configuration["service_description"] = "literal$DESCRIPTION%"
        context = render_context(configuration)
        arguments = shlex.split(context["start_command"].replace("%%", "%").replace("$$", "$"))
        self.assertEqual(arguments[arguments.index("--alias") + 1], literal)
        self.assertEqual(context["labels"], '"COSMOS_LABELS=literal$LABEL%%"')
        self.assertEqual(context["description"], "literal$DESCRIPTION%%")
        configuration["service_description"] = "bad\nExecStart=bad"
        with self.assertRaises(ValueError):
            render_context(configuration)

    def test_entrypoint_gate_and_deferred_operations(self) -> None:
        import pyinfra.context

        flint = vulkan_llama_cpp()
        qwen = vulkan_llama_cpp("llama_cpp_services")[0]
        for data, expected in [({}, 0), ({"llama_cpp": flint}, 1), ({"llama_cpp_services": [qwen]}, 1)]:
            with patch.object(pyinfra.context, "host", SimpleNamespace(name="test", data=data)), patch("deploys.llama_cpp.configure.configure") as configure:
                runpy.run_path(str(ROOT / "deploys/llama-cpp-deploy.py"))
                self.assertEqual(configure.call_count, expected)
        module = importlib.import_module("deploys.llama_cpp.configure")
        changed = Mock(return_value=False)
        result = SimpleNamespace(did_change=changed)
        with patch.object(module, "files") as files, patch.object(module, "systemd") as systemd:
            files.template.return_value = result
            module.configure_service(qwen, result)
            changed.assert_not_called()
            start, restart = systemd.service.call_args_list
            self.assertTrue(start.kwargs["_if"]())
            self.assertFalse(restart.kwargs["_if"]())
            changed.return_value = True
            self.assertFalse(start.kwargs["_if"]())
            self.assertTrue(restart.kwargs["_if"]())
            self.assertIs(systemd.daemon_reload.call_args.kwargs["_if"], changed)
            self.assertTrue(restart.kwargs["restarted"])


if __name__ == "__main__":
    unittest.main()

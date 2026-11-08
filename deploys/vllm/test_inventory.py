import ast
import importlib
import runpy
import shlex
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from deploys.vllm.render import missing_keys, render_context, systemd_quote


ROOT = Path(__file__).resolve().parents[2]


def vulkan_vllm() -> dict:
    tree = ast.parse((ROOT / "inventory.py").read_text())
    for node in ast.walk(tree):
        if not isinstance(node, ast.Tuple) or len(node.elts) != 2:
            continue
        hostname, data = node.elts
        if not isinstance(hostname, ast.Constant) or hostname.value != "vulkan.holdenitdown.net":
            continue
        if not isinstance(data, ast.Dict):
            continue
        for key, value in zip(data.keys, data.values):
            if isinstance(key, ast.Constant) and key.value == "vllm":
                return ast.literal_eval(value)
    raise AssertionError("Vulkan vllm configuration not found")


def render_unit(configuration: dict) -> str:
    environment = Environment(
        loader=FileSystemLoader(ROOT / "deploys/vllm/templates"),
        undefined=StrictUndefined,
    )
    return environment.get_template("vllm.service.j2").render(**render_context(configuration))


class VulkanVllmTest(unittest.TestCase):
    def test_inventory(self) -> None:
        self.assertEqual(vulkan_vllm(), {
            "gpu_vendor": "1002",
            "gpu_device": "1586",
            "unit": "vllm-qwen3-embedding.service",
            "container_name": "qwen3-embedding",
            "service_description": "vLLM Qwen3 embedding service",
            "image": "rocm/vllm-dev:rocm7.2.1_navi_ubuntu24.04_py3.12_pytorch_2.9_vllm_0.16.0@sha256:b5de46c4bee72a3a22937f74e4f138bc1cdcdc7c23fc8533fe8d6c9c0a955e6a",
            "model_cache_dir": "/var/lib/vllm/models/qwen3-embedding",
            "model": "Qwen/Qwen3-Embedding-0.6B",
            "served_model_name": "Qwen/Qwen3-Embedding-0.6B",
            "cosmos_labels": ["cosmos"],
            "dtype": "bfloat16",
            "max_model_len": 32768,
            "gpu_memory_utilization": 0.1,
            "max_num_seqs": 4,
            "max_num_batched_tokens": 32768,
            "port": 8001,
        })

    def test_command_and_health_probe(self) -> None:
        configuration = vulkan_vllm()
        rendered = render_unit(configuration)
        command = next(line.split("=", 1)[1] for line in rendered.splitlines() if line.startswith("ExecStart="))
        arguments = shlex.split(command)
        for flag, value in {
            "--name": "qwen3-embedding",
            "--publish": "8001:8001",
            "--entrypoint": "python3",
            "--model": "Qwen/Qwen3-Embedding-0.6B",
            "--served-model-name": "Qwen/Qwen3-Embedding-0.6B",
            "--runner": "pooling",
            "--dtype": "bfloat16",
            "--max-model-len": "32768",
            "--gpu-memory-utilization": "0.1",
            "--max-num-seqs": "4",
            "--max-num-batched-tokens": "32768",
            "--tensor-parallel-size": "1",
            "--port": "8001",
            "--health-start-period": "1h",
        }.items():
            self.assertEqual(arguments[arguments.index(flag) + 1], value)
        image_index = arguments.index(configuration["image"])
        self.assertEqual(arguments[image_index + 1:image_index + 3], ["-m", "vllm.entrypoints.openai.api_server"])
        self.assertIn("--enforce-eager", arguments)
        self.assertIn("--no-enable-chunked-prefill", arguments)
        self.assertNotIn("--privileged", arguments)
        self.assertEqual([arguments[i + 1] for i, arg in enumerate(arguments) if arg == "--device"], ["/dev/kfd", "@GPU_RENDER@"])
        self.assertIn('"check" "1002" "1586" "required"', rendered)
        self.assertIn("type=bind,source=/var/lib/vllm/models/qwen3-embedding,target=/models", arguments)
        self.assertIn("HF_HOME=/models/huggingface", arguments)
        health = shlex.split(arguments[arguments.index("--health-cmd") + 1])
        self.assertEqual(health[:2], ["python3", "-c"])
        compile(health[2], "healthcheck", "exec")
        self.assertIn("http://127.0.0.1:8001/health", health[2])
        with patch("urllib.request.urlopen") as urlopen:
            exec(health[2], {})
            urlopen.assert_called_once_with("http://127.0.0.1:8001/health", timeout=5)
            urlopen.return_value.close.assert_called_once_with()
        with patch("urllib.request.urlopen", side_effect=OSError("unavailable")):
            with self.assertRaises(OSError):
                exec(health[2], {})
        self.assertIn('Environment="COSMOS_LABELS=cosmos"', rendered)
        self.assertIn('ExecStop=-/usr/bin/docker stop --time 120 "qwen3-embedding"', rendered)
        self.assertIn("TimeoutStartSec=0", rendered)
        self.assertIn("TimeoutStopSec=150s", rendered)
        self.assertNotIn("flint", rendered)
        self.assertNotIn("8000", rendered)

    def test_escaping(self) -> None:
        value = 'a space "quote" \\slash 100% $HOME'
        self.assertEqual(shlex.split(systemd_quote(value))[0], value.replace("%", "%%").replace("$", "$$"))
        with self.assertRaises(ValueError):
            systemd_quote("bad\nvalue")

    def test_configuration_validation(self) -> None:
        self.assertEqual(missing_keys(vulkan_vllm()), [])
        configuration = vulkan_vllm()
        del configuration["image"]
        self.assertEqual(missing_keys(configuration), ["image"])
        with self.assertRaises(ValueError):
            render_context(configuration)
        configuration = vulkan_vllm()
        configuration["max_num_batched_tokens"] = 8192
        with self.assertRaises(ValueError):
            render_context(configuration)

    def test_entrypoint_data_gate(self) -> None:
        import pyinfra.context

        for configuration, expected_calls in [(None, 0), ({"unit": "incomplete.service"}, 0), (vulkan_vllm(), 1)]:
            fake_host = SimpleNamespace(name="local-test", data={"vllm": configuration})
            with patch.object(pyinfra.context, "host", fake_host), patch("deploys.vllm.configure.configure") as configure:
                runpy.run_path(str(ROOT / "deploys/vllm-deploy.py"))
                self.assertEqual(configure.call_count, expected_calls)

    def test_deferred_restart_and_isolation(self) -> None:
        module = importlib.import_module("deploys.vllm.configure")
        configuration = vulkan_vllm()
        fake_host = SimpleNamespace(data={"vllm": configuration})
        changed = Mock(return_value=False)
        unchanged = Mock(return_value=True)
        service_file = SimpleNamespace(did_change=changed, did_not_change=unchanged)
        with patch.object(module, "host", fake_host), patch.object(module, "files") as files, patch.object(module, "systemd") as systemd:
            files.template.return_value = service_file
            module.configure()
            changed.assert_not_called()
            unchanged.assert_not_called()
            self.assertIs(systemd.daemon_reload.call_args.kwargs["_if"], changed)
            self.assertEqual(systemd.service.call_count, 2)
            start, restart = systemd.service.call_args_list
            self.assertTrue(start.kwargs["running"])
            self.assertTrue(start.kwargs["enabled"])
            self.assertTrue(restart.kwargs["restarted"])
            self.assertTrue(restart.kwargs["running"])
            self.assertTrue(restart.kwargs["enabled"])
            files.put.return_value.did_change.return_value = False
            self.assertTrue(start.kwargs["_if"]())
            self.assertFalse(restart.kwargs["_if"]())
            changed.return_value = True
            self.assertFalse(start.kwargs["_if"]())
            self.assertTrue(restart.kwargs["_if"]())
            for call in systemd.service.call_args_list:
                self.assertEqual(call.kwargs["service"], configuration["unit"])
                self.assertTrue(call.kwargs["_sudo"])
            self.assertEqual(files.directory.call_count, 1)
            self.assertEqual(files.directory.call_args.kwargs["path"], configuration["model_cache_dir"])
            self.assertEqual(files.template.call_args.kwargs["dest"], "/etc/systemd/system/vllm-qwen3-embedding.service")


if __name__ == "__main__":
    unittest.main()

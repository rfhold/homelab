import shlex
from collections.abc import Mapping
from typing import Any

from deploys.gpu_selection import gpu_command, systemd_quote, systemd_text


REQUIRED_KEYS = (
    "unit",
    "container_name",
    "service_description",
    "image",
    "model_cache_dir",
    "model",
    "served_model_name",
    "cosmos_labels",
    "dtype",
    "max_model_len",
    "gpu_memory_utilization",
    "max_num_seqs",
    "max_num_batched_tokens",
    "port",
    "gpu_vendor",
    "gpu_device",
)


def missing_keys(configuration: Mapping[str, Any]) -> list[str]:
    return [key for key in REQUIRED_KEYS if configuration.get(key) is None]


def render_context(configuration: Mapping[str, Any]) -> dict[str, str]:
    missing = missing_keys(configuration)
    if missing:
        raise ValueError(f"Incomplete vLLM configuration: {', '.join(missing)}")
    if configuration["max_num_batched_tokens"] < configuration["max_model_len"]:
        raise ValueError("Pooling batch-token limit must cover the model context")
    health_code = (
        "import urllib.request; "
        f"urllib.request.urlopen('http://127.0.0.1:{configuration['port']}/health', timeout=5).close()"
    )
    health_command = shlex.join(["python3", "-c", health_code])
    arguments = [
        "/usr/bin/docker",
        "run",
        "--rm",
        "--name", configuration["container_name"],
        "--publish", f"{configuration['port']}:{configuration['port']}",
        "--health-cmd", health_command,
        "--health-interval", "30s",
        "--health-timeout", "10s",
        "--health-retries", "5",
        "--health-start-period", "1h",
        "--device", "/dev/kfd",
        "--device", "@GPU_RENDER@",
        "--ipc", "host",
        "--mount", f"type=bind,source={configuration['model_cache_dir']},target=/models",
        "--env", "HF_HOME=/models/huggingface",
        "--env", "HUGGINGFACE_HUB_CACHE=/models/huggingface/hub",
        "--entrypoint", "python3",
        configuration["image"],
        "-m", "vllm.entrypoints.openai.api_server",
        "--model", configuration["model"],
        "--served-model-name", configuration["served_model_name"],
        "--host", "0.0.0.0",
        "--port", configuration["port"],
        "--runner", "pooling",
        "--dtype", configuration["dtype"],
        "--max-model-len", configuration["max_model_len"],
        "--gpu-memory-utilization", configuration["gpu_memory_utilization"],
        "--max-num-seqs", configuration["max_num_seqs"],
        "--max-num-batched-tokens", configuration["max_num_batched_tokens"],
        "--tensor-parallel-size", "1",
        "--enforce-eager",
        "--no-enable-chunked-prefill",
    ]
    return {
        "description": systemd_text(configuration["service_description"]),
        "container": systemd_quote(configuration["container_name"]),
        "labels": systemd_quote("COSMOS_LABELS=" + ",".join(configuration["cosmos_labels"]), expand_dollars=False),
        "condition_command": " ".join(map(systemd_quote, gpu_command(configuration, "check"))),
        "start_command": " ".join(map(systemd_quote, gpu_command(configuration, "run") + ["--"] + arguments)),
    }

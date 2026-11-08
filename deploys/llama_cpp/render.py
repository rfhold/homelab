from collections.abc import Mapping
from typing import Any

from deploys.gpu_selection import gpu_command, systemd_quote, systemd_text


REQUIRED_KEYS = (
    "unit", "container_name", "service_description", "image", "model_cache_dir",
    "hf_repo", "hf_file", "alias", "cosmos_labels", "context_size", "devices",
    "gpu_layers", "split_mode", "tensor_split", "fit", "fit_target",
    "parallel_requests", "port", "gpu_vendor", "gpu_device",
)


def configurations(data: Mapping[str, Any]) -> list[dict]:
    singleton = data.get("llama_cpp")
    services = ([singleton] if singleton else []) + list(
        data.get("llama_cpp_services", [])
    )
    for key in ("unit", "container_name", "port"):
        values = [service[key] for service in services if service.get(key) is not None]
        if len(set(values)) != len(values):
            raise ValueError(f"Duplicate llama.cpp {key}")
    return services


def render_context(configuration: Mapping[str, Any]) -> dict[str, str]:
    missing = [key for key in REQUIRED_KEYS if configuration.get(key) is None]
    if missing:
        raise ValueError(f"Incomplete llama.cpp configuration: {', '.join(missing)}")
    arguments = [
        "/usr/bin/docker", "run", "--rm", "--name", configuration["container_name"],
        "--publish", f"{configuration['port']}:{configuration['port']}",
        "--health-cmd", f"curl --fail --silent --show-error http://127.0.0.1:{configuration['port']}/health",
        "--health-interval", "30s", "--health-timeout", "10s", "--health-retries", "5", "--health-start-period", "1h",
        "--device", "/dev/kfd", "--device", "@GPU_RENDER@",
        "--mount", f"type=bind,source={configuration['model_cache_dir']},target=/models",
        "--env", "HF_HOME=/models/huggingface", "--env", "HUGGINGFACE_HUB_CACHE=/models/huggingface/hub",
        configuration["image"],
    ]
    for flag, key in (
        ("--hf-repo", "hf_repo"), ("--hf-file", "hf_file"), ("--alias", "alias"),
        ("--port", "port"), ("--ctx-size", "context_size"), ("--device", "devices"),
        ("--n-gpu-layers", "gpu_layers"), ("--split-mode", "split_mode"),
        ("--tensor-split", "tensor_split"), ("--fit", "fit"), ("--fit-target", "fit_target"),
        ("--parallel", "parallel_requests"),
    ):
        value = configuration[key]
        arguments.extend([
            flag,
            ",".join(map(str, value)) if isinstance(value, list) else str(value),
        ])
    arguments.extend(["--models-dir", "/models", "--host", "0.0.0.0"])
    arguments.extend(configuration.get("extra_args", []))
    return {
        "description": systemd_text(configuration["service_description"]),
        "container": systemd_quote(configuration["container_name"]),
        "labels": systemd_quote(
            "COSMOS_LABELS=" + ",".join(configuration["cosmos_labels"]),
            expand_dollars=False,
        ),
        "condition_command": " ".join(
            map(systemd_quote, gpu_command(configuration, "check"))
        ),
        "start_command": " ".join(
            map(systemd_quote, gpu_command(configuration, "run") + ["--"] + arguments)
        ),
    }

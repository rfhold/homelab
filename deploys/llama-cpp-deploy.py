#!/usr/bin/env python3

from pyinfra import logger
from pyinfra.context import host

from deploys.llama_cpp.configure import configure

REQUIRED_LLAMA_CPP_KEYS = (
    "service_id",
    "unit",
    "container_name",
    "service_description",
    "image",
    "model_cache_dir",
    "hf_repo",
    "hf_file",
    "alias",
    "catalog_labels",
    "context_size",
    "gpu_layers",
    "parallel_requests",
    "port",
)


def check_configuration() -> bool:
    llama_cpp_config = host.data.get("llama_cpp")
    if not llama_cpp_config:
        logger.warning("No llama.cpp configuration found for host %s", host.name)
        return False

    missing_keys = [
        key for key in REQUIRED_LLAMA_CPP_KEYS if llama_cpp_config.get(key) is None
    ]
    if missing_keys:
        logger.warning(
            "llama.cpp configuration for host %s is missing: %s",
            host.name,
            ", ".join(missing_keys),
        )
        return False

    return True


if check_configuration():
    configure()

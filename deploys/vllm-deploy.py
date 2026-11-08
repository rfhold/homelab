#!/usr/bin/env python3

from pyinfra import logger
from pyinfra.context import host

from deploys.vllm.configure import configure
from deploys.vllm.render import missing_keys


def check_configuration() -> bool:
    configuration = host.data.get("vllm")
    if not configuration:
        logger.warning("No vLLM configuration found for host %s", host.name)
        return False
    missing = missing_keys(configuration)
    if missing:
        logger.warning(
            "vLLM configuration for host %s is missing: %s",
            host.name,
            ", ".join(missing),
        )
        return False
    return True


if check_configuration():
    configure()

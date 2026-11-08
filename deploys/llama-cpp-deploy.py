#!/usr/bin/env python3

from pyinfra import logger
from pyinfra.context import host

from deploys.llama_cpp.configure import configure
from deploys.llama_cpp.render import REQUIRED_KEYS, configurations

def check_configuration() -> bool:
    services = configurations(host.data)
    if not services:
        logger.warning("No llama.cpp configuration found for host %s", host.name)
        return False

    missing_keys = sorted({
        key
        for service in services
        for key in REQUIRED_KEYS
        if service.get(key) is None
    })
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

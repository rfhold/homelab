#!/usr/bin/env python3

from pyinfra import logger
from pyinfra.context import host

from deploys.cosmosctl.configure import configure

REQUIRED_COSMOSCTL_KEYS = ("user", "home", "unit", "repository", "branch")


def check_configuration() -> bool:
    cosmosctl_config = host.data.get("cosmosctl")
    if not cosmosctl_config:
        logger.warning("No cosmosctl configuration found for host %s", host.name)
        return False

    missing_keys = [
        key for key in REQUIRED_COSMOSCTL_KEYS if cosmosctl_config.get(key) is None
    ]
    if missing_keys:
        logger.warning(
            "cosmosctl configuration for host %s is missing: %s",
            host.name,
            ", ".join(missing_keys),
        )
        return False

    return True


if check_configuration():
    configure()

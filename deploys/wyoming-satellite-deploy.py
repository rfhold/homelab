#!/usr/bin/env python3

from pyinfra import logger
from pyinfra.context import host
from deploys.wyoming_satellite.setup import install
from deploys.wyoming_satellite.configure import configure


def check_configuration():
    config = host.data.get("wyoming_satellite")
    if not config:
        logger.warning(
            "No wyoming_satellite configuration found for host %s", host.name)
        logger.warning(
            "See deploys/wyoming_satellite/README.md for configuration examples")
        return False
    return True


if check_configuration():
    install()
    configure()

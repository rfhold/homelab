#!/usr/bin/env python3

from pyinfra import logger
from pyinfra.context import host
from deploys.alloy.setup import install
from deploys.alloy.configure import configure


def check_configuration() -> bool:
    config = host.data.get("alloy")
    if not config:
        logger.warning(
            "No alloy configuration found for host %s, using defaults", host.name)
    return True


if check_configuration():
    install()
    configure()

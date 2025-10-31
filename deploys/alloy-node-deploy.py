#!/usr/bin/env python3

from pyinfra import logger
from pyinfra.context import host
from deploys.alloy.setup import install
from deploys.alloy.configure import configure
from deploys.alloy import smartctl_setup


def check_configuration() -> bool:
    config = host.data.get("alloy")
    if not config:
        logger.warning(
            "No alloy configuration found for host %s, using defaults", host.name)
    return True


if check_configuration():
    install()
    
    config = host.data.get("alloy", {})
    if config.get("smartctl_exporter_enabled", False):
        smartctl_config = config.get("smartctl", {})
        smartctl_setup.install_smartmontools()
        smartctl_setup.install_smartctl_exporter()
        smartctl_setup.configure_smartctl_service(smartctl_config)
    
    configure()

# Tracked Voice Implementation

This page describes code paths in the repository, not applied host state.

[`../../deploys/wyoming-satellite-deploy.py`](../../deploys/wyoming-satellite-deploy.py) requires a non-empty `wyoming_satellite` host-data block. When it is absent, the entry point warns and returns without running setup or configuration.

When configuration is present, [`../../deploys/wyoming_satellite/setup.py`](../../deploys/wyoming_satellite/setup.py) contains Debian-oriented package setup, repository checkout, Python environment setup, and optional ReSpeaker and LED dependencies. [`../../deploys/wyoming_satellite/configure.py`](../../deploys/wyoming_satellite/configure.py) renders and manages the main `wyoming-satellite.service`.

The configuration source also contains optional branches for audio enhancements, LED event services, ReSpeaker setup, and openWakeWord with optional downloaded models. Those branches demonstrate available implementation paths only. They do not show that a host selects them.

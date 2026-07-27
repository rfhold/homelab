# Host Provisioning Verification

Inventory, source, and tests describe desired host configuration but do not prove application.

| Unverified state | Repository evidence | Evidence needed |
| --- | --- | --- |
| Athena and Artemis are joined with the tracked roles and labels | [`../../inventory.py`](../../inventory.py) and [`../../tests/test_add_pantheon_server_nodes.py`](../../tests/test_add_pantheon_server_nodes.py) | Authorized K3s and Kubernetes node inspection |
| Athena has working NVIDIA drivers and container tooling | [`../../deploys/nvidia-container-host.py`](../../deploys/nvidia-container-host.py) | Authorized package, driver, and runtime inspection on Athena |
| Managed NVMe/PCIe arguments are active | The deploy updates GRUB but deliberately does not reboot | Authorized bootloader and running kernel command-line inspection after an operator-controlled reboot |
| Artemis is running with the canary shutdown timing | Inventory and rendering logic contain the values | Authorized host file and systemd unit inspection |

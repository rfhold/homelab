# Host Provisioning Verification

Inventory and source describe desired host configuration but do not prove application.

| Unverified state | Repository evidence | Evidence needed |
| --- | --- | --- |
| Athena and Artemis are joined with the tracked roles and labels | [`../../inventory.py`](../../inventory.py) | Authorized K3s and Kubernetes node inspection |
| Athena has working NVIDIA drivers and container tooling | [`../../deploys/nvidia-container-host.py`](../../deploys/nvidia-container-host.py) | Authorized package, driver, and runtime inspection on Athena |
| Managed NVMe/PCIe arguments are active | The deploy updates GRUB but deliberately does not reboot | Authorized bootloader and running kernel command-line inspection after an operator-controlled reboot |
| Artemis is running with the canary shutdown timing | Inventory and rendering logic contain the values | Authorized host file and systemd unit inspection |
| Vulkan has Docker, the requested ROCm llama.cpp image, and the Qwen3.6-35B-A3B model cache | [`../../deploys/llama-cpp-deploy.py`](../../deploys/llama-cpp-deploy.py) and [`../../deploys/llama_cpp/configure.py`](../../deploys/llama_cpp/configure.py) declare package, unit, and cache state | Authorized host inspection, image pull, and model-download evidence |
| Vulkan exposes a working Qwen3.6-35B-A3B llama.cpp API with ROCm GPU access and Docker reports the container healthy at the declared maximum `262144`-token context | The rendered unit mounts `/dev/kfd` and `/dev/dri`, binds port `8000`, configures a loopback `/health` Docker probe with a one-hour start period, and receives the inventory context | Authorized host apply, systemd and container inspection, long reload observation, runtime memory-fit check, Docker health, ROCm, API, and model-inference checks |
| llama.cpp service reachability and DNS behavior | The host unit publishes port `8000`; repository source has no llama.cpp DNS or routing configuration | Authorized network and DNS inspection from intended clients |
| Vulkan has the `grafana-alloy` package, `/usr/bin/grafana-alloy`, `grafana-alloy.service`, its package defaults, and the tracked configuration | [`../../deploys/alloy/setup.py`](../../deploys/alloy/setup.py) and [`../../deploys/alloy/configure.py`](../../deploys/alloy/configure.py) declare Pacman package, package-specific binary, defaults, override, configuration, and unit state | Authorized package, file, and systemd unit inspection on Vulkan |
| Vulkan Alloy service is running and delivers telemetry | Source defines configuration and restart behavior but cannot establish runtime health or delivery | Authorized systemd status, Alloy diagnostics, and telemetry-ingestion inspection |

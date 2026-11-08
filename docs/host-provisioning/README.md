# Host Provisioning

Feature specifications define intended host behavior. Tracked PyInfra source and tests establish repository implementation, not the state of any host.

| Document | Covers |
| --- | --- |
| [`implementation.md`](implementation.md) | Source-verified Pantheon node, NVIDIA, kernel argument, K3s, llama.cpp, and vLLM host behavior |
| [`spec/llama-cpp-host.md`](spec/llama-cpp-host.md) | Standalone Flint and optional RX 7900 XTX Qwen contracts, GPU identity selection, and capacity boundary |
| [`spec/vllm-host.md`](spec/vllm-host.md) | Intended standalone ROCm Qwen3 embedding service on Vulkan |
| [`spec/nvidia-updates.md`](spec/nvidia-updates.md) | Intended NVIDIA unattended-upgrade exclusions and scheduled maintenance boundary |
| [`spec/pantheon-server-nodes.md`](spec/pantheon-server-nodes.md) | Intended Athena and Artemis server roles and scheduling metadata |
| [`spec/kernel-arguments.md`](spec/kernel-arguments.md) | Intended GRUB fact, operation, and NVMe/PCIe arguments |
| [`spec/k3s-shutdown.md`](spec/k3s-shutdown.md) | Intended per-host K3s shutdown timing and Artemis canary |
| [`verification.md`](verification.md) | Host state that remains unverified |
| [`../../deploys/README.md`](../../deploys/README.md) | PyInfra entry points, mutation boundary, and local validation |

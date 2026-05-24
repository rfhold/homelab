from deploys.operations.kernel_args import kernel_args


NVME_PCIE_POWER_CONTROL_KERNEL_ARGS = {
    "nvme_core.default_ps_max_latency_us": "0",
    "pcie_aspm": "off",
}


kernel_args(
    name="Disable NVMe PCIe power control kernel arguments",
    _sudo=True,
    arguments=NVME_PCIE_POWER_CONTROL_KERNEL_ARGS,
)

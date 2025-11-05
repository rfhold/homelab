from pyinfra.operations import files, server
from pyinfra.context import host
from pyinfra.facts.files import FindInFile

GRUB_CONFIG_PATH = "/etc/default/grub"


def add_kernel_parameter(param_name: str, param_value: str):
    param_string = f"{param_name}={param_value}" if param_value else param_name

    param_exists = host.get_fact(
        FindInFile,
        path=GRUB_CONFIG_PATH,
        pattern=param_name,
    )

    if not param_exists:
        server.shell(
            name=f"Backup {GRUB_CONFIG_PATH}",
            _sudo=True,
            commands=[f"cp {GRUB_CONFIG_PATH} {GRUB_CONFIG_PATH}.bak"],
        )

        server.shell(
            name=f"Add {param_name} kernel parameter to GRUB config",
            _sudo=True,
            commands=[
                f'sed -i \'s/GRUB_CMDLINE_LINUX_DEFAULT="\\(.*\\)"/GRUB_CMDLINE_LINUX_DEFAULT="\\1 {
                    param_string}"/\' {GRUB_CONFIG_PATH}',
                f'sed -i \'s/" /"/\' {GRUB_CONFIG_PATH}',
            ],
        )
        return True
    return False


grub_modified = False

grub_modified |= add_kernel_parameter(
    "nvme_core.default_ps_max_latency_us", "0")
grub_modified |= add_kernel_parameter("pcie_aspm", "off")

if grub_modified:
    server.shell(
        name="Regenerate GRUB configuration files",
        _sudo=True,
        commands=["update-grub"],
    )

    server.shell(
        name="Display current GRUB kernel parameters",
        _sudo=True,
        commands=["grep GRUB_CMDLINE_LINUX_DEFAULT /etc/default/grub"],
    )

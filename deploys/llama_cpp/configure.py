from pyinfra.context import host
from pyinfra.facts.server import LinuxName
from pyinfra.operations import apt, files, pacman, systemd
from pyinfra.operations.util import any_changed

from deploys.gpu_selection import GPU_HELPER
from deploys.llama_cpp.render import configurations, render_context


def configure() -> None:
    linux_name = host.get_fact(LinuxName)
    services = configurations(host.data)

    if linux_name in ("Debian", "Ubuntu"):
        apt.packages(
            name="Install Docker for llama.cpp",
            _sudo=True,
            packages=["docker.io"],
            update=True,
            cache_time=3600,
        )
    elif linux_name in ("Arch Linux", "CachyOS Linux"):
        pacman.packages(
            name="Install Docker for llama.cpp",
            _sudo=True,
            packages=["docker"],
            update=True,
        )
    else:
        raise ValueError(
            "The llama.cpp deploy supports Debian/Ubuntu and Arch/CachyOS hosts only"
        )

    helper = files.put(
        name="Install GPU identity selector for llama.cpp",
        _sudo=True,
        src="deploys/gpu_selection.py",
        dest=GPU_HELPER,
        mode="0644",
        user="root",
        group="root",
        create_remote_dir=True,
    )

    for configuration in services:
        configure_service(configuration, helper)

    files.directory(
        name="Remove retired llama.cpp service catalog directory",
        _sudo=True,
        path="/etc/llama-cpp/services.d",
        present=False,
    )


def configure_service(llama_cpp_config: dict, helper: object) -> None:
    context = render_context(llama_cpp_config)
    files.directory(
        name="Create llama.cpp model cache directory",
        _sudo=True,
        path=llama_cpp_config["model_cache_dir"],
        mode="0755",
        user="root",
        group="root",
        present=True,
        recursive=True,
    )

    service_file = files.template(
        name="Create llama.cpp systemd service",
        _sudo=True,
        src="deploys/llama_cpp/templates/llama-cpp.service.j2",
        dest=f"/etc/systemd/system/{llama_cpp_config['unit']}",
        user="root",
        group="root",
        mode="0644",
        backup=True,
        **context,
    )

    systemd.daemon_reload(
        name="Reload systemd daemon if llama.cpp service changed",
        _sudo=True,
        _if=service_file.did_change,
    )

    systemd.service(
        name="Enable and start llama.cpp service",
        _sudo=True,
        service=llama_cpp_config["unit"],
        running=True,
        enabled=True,
        _if=lambda: not any_changed(service_file, helper)(),
    )

    systemd.service(
        name="Restart llama.cpp service if unit changed",
        _sudo=True,
        service=llama_cpp_config["unit"],
        running=True,
        enabled=True,
        restarted=True,
        _if=any_changed(service_file, helper),
    )

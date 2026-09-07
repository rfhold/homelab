from pyinfra.context import host
from pyinfra.facts.server import LinuxName
from pyinfra.operations import apt, files, pacman, server


def configure() -> None:
    linux_name = host.get_fact(LinuxName)
    cosmosctl_config = host.data.get("cosmosctl")

    if linux_name in ("Debian", "Ubuntu"):
        packages = apt.packages(
            name="Install cosmosctl build dependencies",
            _sudo=True,
            packages=["git", "cargo", "rustc"],
            update=True,
            cache_time=3600,
        )
    elif linux_name in ("Arch Linux", "CachyOS Linux"):
        packages = pacman.packages(
            name="Install cosmosctl build dependencies",
            _sudo=True,
            packages=["git", "cargo", "rust"],
            update=True,
        )
    else:
        raise ValueError(
            "The cosmosctl deploy supports Debian/Ubuntu and Arch/CachyOS hosts only"
        )

    cargo_install = server.shell(
        name="Install cosmosctl from the configured branch",
        commands=[
            "/usr/bin/cargo install --git \"$COSMOSCTL_REPOSITORY\" "
            "--branch \"$COSMOSCTL_BRANCH\" --locked --force"
        ],
        _sudo=True,
        _sudo_user=cosmosctl_config["user"],
        _env={
            "COSMOSCTL_BRANCH": cosmosctl_config["branch"],
            "COSMOSCTL_REPOSITORY": cosmosctl_config["repository"],
            "HOME": cosmosctl_config["home"],
        },
        _if=packages.did_succeed,
    )

    user_unit_directory = files.directory(
        name="Create cosmosctl user systemd directory",
        _sudo=True,
        path=f"{cosmosctl_config['home']}/.config/systemd/user",
        user=cosmosctl_config["user"],
        group=cosmosctl_config["user"],
        mode="0755",
        present=True,
        recursive=True,
        _if=cargo_install.did_succeed,
    )

    files.directory(
        name="Create cosmosctl graphical session target directory",
        _sudo=True,
        path=(
            f"{cosmosctl_config['home']}/.config/systemd/user/"
            "graphical-session.target.wants"
        ),
        user=cosmosctl_config["user"],
        group=cosmosctl_config["user"],
        mode="0755",
        present=True,
        recursive=True,
        _if=user_unit_directory.did_succeed,
    )

    service_file = files.template(
        name="Create cosmosctl user systemd service",
        _sudo=True,
        src="deploys/cosmosctl/templates/cosmosctl.service.j2",
        dest=f"{cosmosctl_config['home']}/.config/systemd/user/{cosmosctl_config['unit']}",
        user=cosmosctl_config["user"],
        group=cosmosctl_config["user"],
        mode="0644",
        backup=True,
        _if=user_unit_directory.did_succeed,
        home=cosmosctl_config["home"],
    )

    files.link(
        name="Enable cosmosctl for the graphical user session",
        _sudo=True,
        path=(
            f"{cosmosctl_config['home']}/.config/systemd/user/"
            "graphical-session.target.wants/"
            f"{cosmosctl_config['unit']}"
        ),
        target=f"../{cosmosctl_config['unit']}",
        user=cosmosctl_config["user"],
        group=cosmosctl_config["user"],
        _if=service_file.did_succeed,
    )

    server.shell(
        name="Reload cosmosctl user systemd daemon if the unit changed",
        commands=[
            "runtime_dir=/run/user/$(id -u); "
            "if [ ! -S \"$runtime_dir/bus\" ]; then exit 0; fi; "
            "XDG_RUNTIME_DIR=\"$runtime_dir\" "
            "DBUS_SESSION_BUS_ADDRESS=\"unix:path=$runtime_dir/bus\" "
            "/usr/bin/systemctl --user daemon-reload || true"
        ],
        _sudo=True,
        _sudo_user=cosmosctl_config["user"],
        _if=service_file.did_change,
    )

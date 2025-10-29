from pyinfra.operations import apt, files


def install() -> None:
    files.directory(
        name="Create APT keyrings directory",
        _sudo=True,
        path="/etc/apt/keyrings/",
        mode="0755",
        user="root",
        group="root",
        present=True,
    )

    apt.key(
        name="Add Grafana GPG key",
        _sudo=True,
        src="https://apt.grafana.com/gpg.key",
    )

    apt.repo(
        name="Add Grafana APT repository",
        _sudo=True,
        src="deb https://apt.grafana.com stable main",
        filename="grafana",
    )

    apt.packages(
        name="Install Alloy",
        packages=["alloy"],
        update=True,
        _sudo=True,
    )

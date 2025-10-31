from pyinfra import host
from pyinfra.facts.files import File
from pyinfra.operations import apt, files, server


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

    gpg_key_path = "/etc/apt/keyrings/grafana.gpg"
    existing_key = host.get_fact(File, gpg_key_path)

    if existing_key is None:
        server.shell(
            name="Download and install Grafana GPG key",
            _sudo=True,
            commands=[
                "wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor > /etc/apt/keyrings/grafana.gpg"
            ],
        )

    apt.repo(
        name="Add Grafana APT repository",
        _sudo=True,
        src="deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main",
        filename="grafana",
    )

    apt.packages(
        name="Install Alloy",
        packages=["alloy"],
        update=True,
        _sudo=True,
    )

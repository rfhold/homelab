from pyinfra.context import host
from pyinfra.operations import apt, server, python, systemd
from pyinfra.facts.systemd import SystemdStatus

def configure():
    apt.packages(
        name="Add packages for Storage",
        _sudo=True,
        packages=[
            "nfs-common",
            "open-iscsi",
            "cryptsetup",
            "dmsetup",
        ],
    )

    server.modprobe(
        name="Load iscsi_tcp module",
        _sudo=True,
        module="iscsi_tcp",
    )

    server.modprobe(
        name="Load dm_crypt module",
        _sudo=True,
        module="dm_crypt",
    )

    multipath_services = [
        "multipathd.socket",
        "multipathd",
    ]

    for service in multipath_services:
        systemd.service(
            name="Disable {}".format(service),
            _sudo=True,
            service=service,
            enabled=False,
            running=False,
        )

    sysctl_options = {
        "fs.inotify.max_user_instances": 1024,
        "fs.inotify.max_user_watches": 32768,
        "fs.inotify.max_queued_events": 32768,
        "net.ipv4.ip_forward": 1,
        "net.ipv6.conf.all.forwarding": 1,
        "fs.file-max": 65536,
    }

    for key, value in sysctl_options.items():
        server.sysctl(
            name="Set sysctl option {}".format(key),
            _sudo=True,
            key=key,
            value=value,
            persist=True,
        )

    status = host.get_fact(SystemdStatus)

    if status.get("ufw.service") is not None:
        def disable_ufw():
            ufw_status = server.shell(
                name="Check UFW status",
                commands=["ufw status"],
                _sudo=True,
            )

            if "Status: inactive" not in ufw_status.stdout:
                server.shell(
                    name="Disable UFW",
                    commands=["ufw disable"],
                    _sudo=True,
                )

        python.call(
            name="Disable UFW if active",
            function=disable_ufw,
        )

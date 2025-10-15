import io

from pyinfra.context import host
from pyinfra.operations import server, files, python, systemd
from pyinfra.facts.server import Which, Home
from pyinfra.facts.systemd import SystemdEnabled, SystemdStatus
from pyinfra.facts.files import File
from deploys.util.secret import get_secret


def download(version: str) -> None:
    files.download(
        name="Download k3s install script",
        _sudo=True,
        src="https://get.k3s.io",
        dest="/usr/local/bin/k3s-install.sh",
        user="root",
        group="root",
        mode="0755",
    )

    server.shell(
        name="Download k3s binary version {}".format(version),
        _sudo=True,
        commands=[
            "/usr/local/bin/k3s-install.sh",
        ],
        _env={
            "INSTALL_K3S_SKIP_START": "true",
            "INSTALL_K3S_VERSION": version,
        },
    )


def download_if_outdated(version: str) -> None:
    current_version = server.shell(
        name="Get current k3s version",
        _sudo=True,
        commands=["k3s --version"],
        _ignore_errors=True,
    )

    if version not in current_version.stdout:
        python.call(
            name="Download k3s",
            function=download,
            version=version,
        )


def install(version: str = "v1.32.3+k3s1") -> None:
    if not host.get_fact(Which, "k3s"):
        python.call(
            name="Download k3s",
            function=download,
            version=version,
        )
    else:
        python.call(
            name="Download k3s if outdated",
            function=download_if_outdated,
            version=version,
        )

    k3s_config = host.data.get("k3s_cluster", None)

    if k3s_config is None:
        raise ValueError("k3s_cluster configuration is required")

    k3s_args = [
        {"key": "--data-dir", "value": "/var/lib/rancher/k3s"},
    ]

    node_role = k3s_config.get("node_role", "server")
    is_cluster_init = node_role == "cluster-init"
    is_agent = node_role == "agent"

    if node_role == "server" or is_agent:
        k3s_args.append({"key": "--server", "value": "https://{}:{}".format(
            k3s_config.get("api_host"), k3s_config.get("api_port"))})

    if is_cluster_init:
        node_role = "server"
        k3s_args.append({"key": "--cluster-init"})
        k3s_args.append(
            {"key": "--tls-san", "value": k3s_config.get("api_host")})

    if node_role == "server" and not is_agent:
        k3s_args.append(
            {"key": "--disable", "value": "servicelb,traefik,local-storage"})
        k3s_args.append({"key": "--secrets-encryption", "value": "true"})
        k3s_args.append({"key": "--embedded-registry"})
        k3s_args.append(
            {"key": "--kubelet-arg", "value": "config=/etc/rancher/k3s/kubelet-server.config"})

        etcd_s3_config = k3s_config.get("etcd_s3_snapshots")
        if etcd_s3_config and etcd_s3_config.get("enabled"):
            k3s_args.append({"key": "--etcd-s3"})
            secret_name = etcd_s3_config.get("secret_name")
            if secret_name:
                k3s_args.append(
                    {"key": "--etcd-s3-config-secret", "value": secret_name})

        etcd_snapshots = k3s_config.get("etcd_snapshots")
        if etcd_snapshots:
            if "schedule_cron" in etcd_snapshots:
                k3s_args.append({"key": "--etcd-snapshot-schedule-cron",
                                "value": f"\"{etcd_snapshots["schedule_cron"]}\""})
            if "retention" in etcd_snapshots:
                k3s_args.append({"key": "--etcd-snapshot-retention",
                                "value": str(etcd_snapshots["retention"])})
            if "s3_retention" in etcd_snapshots:
                k3s_args.append({"key": "--etcd-s3-retention",
                                "value": str(etcd_snapshots["s3_retention"])})
            if etcd_snapshots.get("compress"):
                k3s_args.append({"key": "--etcd-snapshot-compress"})

    if is_agent:
        k3s_args.append(
            {"key": "--kubelet-arg", "value": "config=/etc/rancher/k3s/kubelet-agent.config"})

    # Add node labels from configuration
    labels = k3s_config.get("labels", {})
    for label_key, label_value in labels.items():
        k3s_args.append(
            {"key": "--node-label", "value": "{}={}".format(label_key, label_value)})

    taints = k3s_config.get("taints", [])
    for taint in taints:
        taint_str = "{}={}:{}".format(
            taint["key"], taint["value"], taint["effect"])
        k3s_args.append({"key": "--node-taint", "value": taint_str})

    service_template = "deploys/k3s/templates/k3s-agent.service.j2" if is_agent else "deploys/k3s/templates/k3s.service.j2"
    service_name = "k3s-agent.service" if is_agent else "k3s.service"
    service_file = files.template(
        name="Create k3s service file",
        _sudo=True,
        src=service_template,
        dest=f"/etc/systemd/system/{service_name}",
        mode="755",
        user="root",
        group="root",

        node_role=node_role,
        args=k3s_args,
    )

    files.directory(
        name="Create kubelet config directory",
        _sudo=True,
        path="/etc/rancher/k3s",
        mode="0755",
        user="root",
        group="root",
        present=True,
    )

    registries_config = """mirrors:
  docker.io:
  ghcr.io:
"""

    files.put(
        name="Create registries config file",
        _sudo=True,
        src=io.StringIO(registries_config),
        dest="/etc/rancher/k3s/registries.yaml",
        mode="0644",
        user="root",
        group="root",
    )

    kubelet_config_file = "/etc/rancher/k3s/kubelet-agent.config" if is_agent else "/etc/rancher/k3s/kubelet-server.config"
    files.put(
        name="Copy kubelet config file",
        _sudo=True,
        src=io.StringIO("""apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
maxPods: 250
shutdownGracePeriod: 45s
shutdownGracePeriodCriticalPods: 30s"""),
        dest=kubelet_config_file,
        mode="0644",
        user="root",
        group="root",
    )

    if not is_agent:
        files.put(
            name="Copy server config file",
            _sudo=True,
            src=io.StringIO("""write-kubeconfig-mode: "0644\""""),
            dest="/etc/rancher/k3s/config-server.yaml",
            mode="0644",
            user="root",
            group="root",
        )

    token = k3s_config.get("token")
    token_env_name = "K3S_TOKEN" if (
        node_role == "server" and not is_agent) else "K3S_TOKEN"

    env_file = None
    if token is not None:
        env = {
            token_env_name: get_secret(token),
            "K3S_VERSION": version,
        }

        if is_agent:
            env["K3S_URL"] = "https://{}:{}".format(
                k3s_config.get("api_host"), k3s_config.get("api_port"))

        template = io.StringIO(
            """{% for key, value in env.items() %}{{ key }}={{ value }}\n{% endfor %}""")

        env_file = files.template(
            name="Create k3s environment file",
            _sudo=True,
            src=template,
            dest="/etc/systemd/system/k3s.service.env",
            user="root",
            group="root",
            mode="0644",
            env=env,
        )

    enabled = host.get_fact(SystemdEnabled)
    status = host.get_fact(SystemdStatus)

    needs_restart = service_file.changed or (env_file and env_file.changed)

    if status.get(service_name) and needs_restart:
        stop(service_name)

    needs_start = needs_restart or not enabled.get(
        service_name) or not status.get(service_name)

    if needs_start:
        if is_cluster_init:
            start(service_name, _run_once=True)
        else:
            start(service_name)

    if not is_agent:
        python.call(
            name="Create kubectl config file",
            function=create_kubecfg,
            address="https://{}:{}".format(k3s_config.get("api_host"),
                                           k3s_config.get("api_port")),
        )

        cluster_name = k3s_config.get("name")

        if is_cluster_init:
            home = host.get_fact(Home)

            files.get(
                name="Download kubeconfig file",
                src="{}/.kube/config".format(home),
                dest="./kubeconfig-{}.yaml".format(cluster_name),
            )


def stop(service_name: str = "k3s.service") -> None:
    server.shell(
        name="K3s killall",
        _sudo=True,
        commands=["/usr/local/bin/k3s-killall.sh"],
    )


def start(service_name: str = "k3s.service", _run_once: bool = False) -> None:
    systemd.service(
        name=f"Start {service_name}",
        _sudo=True,
        service=service_name,
        running=True,
        enabled=True,
        daemon_reload=True,
        _run_once=_run_once,
        _serial=True,
    )


def modify_k3s_kubecfg(address: str) -> None:
    home = host.get_fact(Home)

    files.replace(
        name="Replace server address in k3s config",
        _sudo=True,
        path="{}/.kube/config".format(home),
        text="https://.*",
        replace=address,
    )


def create_kubecfg(address) -> None:
    home = host.get_fact(Home)

    k3s_file = host.get_fact(File, "{}/k3s.yaml".format(home))

    if k3s_file is None:
        server.shell(
            name="Copy k3s config file",
            _sudo=True,
            commands=[
                "cp /etc/rancher/k3s/k3s.yaml {}/k3s.yaml".format(home),
                "mkdir -p {}/.kube".format(home),
                "cp {}/k3s.yaml {}/.kube/config".format(home, home),
                "chmod 644 {}/.kube/config".format(home),
            ],
        )

    modify_k3s_kubecfg(address)

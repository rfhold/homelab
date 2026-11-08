from pyinfra.context import host
from pyinfra.operations import files, systemd
from pyinfra.operations.util import any_changed

from deploys.gpu_selection import GPU_HELPER
from deploys.vllm.render import render_context


def configure() -> None:
    configuration = host.data.get("vllm")
    context = render_context(configuration)

    helper = files.put(
        name="Install GPU identity selector for vLLM",
        _sudo=True,
        src="deploys/gpu_selection.py",
        dest=GPU_HELPER,
        mode="0644",
        user="root",
        group="root",
        create_remote_dir=True,
    )

    files.directory(
        name="Create vLLM model cache directory",
        _sudo=True,
        path=configuration["model_cache_dir"],
        mode="0755",
        user="root",
        group="root",
        present=True,
    )

    service_file = files.template(
        name="Create vLLM systemd service",
        _sudo=True,
        src="deploys/vllm/templates/vllm.service.j2",
        dest=f"/etc/systemd/system/{configuration['unit']}",
        user="root",
        group="root",
        mode="0644",
        backup=True,
        **context,
    )

    systemd.daemon_reload(
        name="Reload systemd daemon if vLLM service changed",
        _sudo=True,
        _if=service_file.did_change,
    )

    systemd.service(
        name="Enable and start vLLM service",
        _sudo=True,
        service=configuration["unit"],
        running=True,
        enabled=True,
        _if=lambda: not any_changed(service_file, helper)(),
    )

    systemd.service(
        name="Restart vLLM service if unit changed",
        _sudo=True,
        service=configuration["unit"],
        running=True,
        enabled=True,
        restarted=True,
        _if=any_changed(service_file, helper),
    )

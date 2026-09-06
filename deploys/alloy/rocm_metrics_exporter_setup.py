from pyinfra.operations import files, systemd


def _validate_image(image: str) -> None:
    image_name = image.rsplit("/", 1)[-1]
    image_has_digest = "@" in image
    image_tag = image_name.partition(":")[2]
    if not image_has_digest and (not image_tag or image_tag == "latest"):
        raise ValueError(
            "ROCm Metrics Exporter image must include a non-latest tag or digest"
        )


def configure_service(rocm_metrics_exporter_config: dict) -> None:
    image = rocm_metrics_exporter_config["image"]
    _validate_image(image)

    service_file = files.template(
        name="Create ROCm Metrics Exporter systemd service",
        _sudo=True,
        src="deploys/alloy/templates/rocm-metrics-exporter.service.j2",
        dest="/etc/systemd/system/rocm-metrics-exporter.service",
        user="root",
        group="root",
        mode="0644",
        backup=True,
        container_name="rocm-metrics-exporter",
        **rocm_metrics_exporter_config,
    )

    systemd.daemon_reload(
        name="Reload systemd daemon if ROCm Metrics Exporter service changed",
        _sudo=True,
        _if=service_file.did_change,
    )

    systemd.service(
        name="Enable and start ROCm Metrics Exporter service",
        _sudo=True,
        service="rocm-metrics-exporter.service",
        running=True,
        enabled=True,
    )

    systemd.service(
        name="Restart ROCm Metrics Exporter service if unit changed",
        _sudo=True,
        service="rocm-metrics-exporter.service",
        restarted=True,
        _if=service_file.did_change,
    )

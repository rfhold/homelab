import pathlib
import tempfile
import textwrap
import unittest
import subprocess
import os


ROOT = pathlib.Path(__file__).resolve().parents[1]


class WorkloadLabelPassthroughTests(unittest.TestCase):
    def test_with_workload_labels_merges_metadata_and_controller_templates(self) -> None:
        source = (ROOT / "src" / "types.ts").read_text()

        self.assertIn("export interface WorkloadLabelArgs", source)
        self.assertIn("export function withWorkloadLabels", source)
        self.assertIn("metadata: withMetadataLabels(args.props.metadata, workloadLabels)", source)
        self.assertIn("props: withControllerTemplateLabels(args.type, propsWithLabels, workloadLabels)", source)

        for controller in ["CronJob", "Deployment", "StatefulSet", "DaemonSet", "ReplicaSet", "Job"]:
            self.assertIn(controller, source)

    def test_stack_configs_declare_layer_labels(self) -> None:
        yaml_files = list((ROOT / "programs").glob("*/Pulumi.*.yaml"))
        configs_with_workload_labels = [path for path in yaml_files if "workloadLabels" in path.read_text()]

        self.assertGreater(len(configs_with_workload_labels), 0)
        self.assertTrue(
            any("rholden.dev/workload-layer: storage" in path.read_text() for path in configs_with_workload_labels)
        )
        self.assertTrue(
            any("rholden.dev/workload-layer: application" in path.read_text() for path in configs_with_workload_labels)
        )
        self.assertTrue(
            any("rholden.dev/workload-layer: observability" in path.read_text() for path in configs_with_workload_labels)
        )
        self.assertTrue(
            any("rholden.dev/workload-layer: ingress" in path.read_text() for path in configs_with_workload_labels)
        )
        self.assertTrue(
            any("app.kubernetes.io/name:" in path.read_text() for path in configs_with_workload_labels)
        )

    def test_programs_read_and_pass_workload_labels(self) -> None:
        program_sources = list((ROOT / "programs").glob("*/index.ts"))
        sources_with_config = [path for path in program_sources if "workloadLabels" in path.read_text()]

        self.assertGreater(len(sources_with_config), 0)
        for path in sources_with_config:
            source = path.read_text()
            self.assertIn("config.getObject<Record<string, Record<string, string>>>(\"workloadLabels\")", source)
            self.assertIn("workloadLabels:", source)


class PlannedNodeRebootTests(unittest.TestCase):
    def run_helper(self, kubectl_script: str, *args: str) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = pathlib.Path(temp_dir)
            kubectl = temp_path / "kubectl"
            kubectl.write_text(kubectl_script)
            kubectl.chmod(0o755)

            ssh = temp_path / "ssh"
            ssh.write_text("#!/bin/bash\nprintf 'ssh %s\\n' \"$*\"\n")
            ssh.chmod(0o755)

            env = os.environ.copy()
            env["PATH"] = f"{temp_dir}:{env['PATH']}"

            return subprocess.run(
                ["bash", str(ROOT / "scripts" / "planned-node-reboot.sh"), *args],
                cwd=ROOT,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )

    def test_default_drain_uses_label_selector_and_skips_storage(self) -> None:
        kubectl_script = textwrap.dedent(
            """\
            #!/bin/bash
            printf 'kubectl %s\n' "$*"
            if [[ "$*" == *"rholden.dev/workload-layer=storage"* ]]; then
              exit 0
            fi
            """
        )

        result = self.run_helper(kubectl_script, "--node", "artemis", "--context", "pantheon", "--dry-run")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("kubectl cordon --context pantheon artemis", result.stdout)
        self.assertIn("--pod-selector rholden.dev/workload-layer\\,rholden.dev/workload-layer\\!=storage", result.stdout)
        self.assertIn("Storage handling skipped", result.stdout)
        self.assertNotIn("rholden.dev/workload-layer=storage --ignore-daemonsets", result.stdout)

    def test_default_reboot_refuses_storage_pods(self) -> None:
        kubectl_script = textwrap.dedent(
            """\
            #!/bin/bash
            if [[ "$*" == *"rholden.dev/workload-layer=storage"* ]]; then
              printf 'pod/storage-osd\n'
            fi
            """
        )

        result = self.run_helper(kubectl_script, "--node", "mars", "--reboot")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("pass --storage-mode ceph before rebooting", result.stderr)

    def test_ceph_mode_checks_health_and_ok_to_stop_before_reboot(self) -> None:
        kubectl_script = textwrap.dedent(
            """\
            #!/bin/bash
            printf 'kubectl %s\n' "$*" >&2
            if [[ "$*" == *"app=rook-ceph-tools"* ]]; then
              printf 'rook-ceph-tools-abc'
            elif [[ "$*" == *"ceph health"* ]]; then
              printf 'HEALTH_OK\n'
            elif [[ "$*" == *"app=rook-ceph-osd"* ]]; then
              printf '2\n'
            elif [[ "$*" == *"ceph osd ok-to-stop"* ]]; then
              exit 0
            fi
            """
        )

        result = self.run_helper(
            kubectl_script,
            "--node",
            "mars",
            "--storage-mode",
            "ceph",
            "--reboot",
            "--dry-run",
            "--ssh-target",
            "mars.holdenitdown.net",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Explicit Ceph storage handling requested", result.stdout)
        self.assertIn("Checking Ceph ok-to-stop for OSDs on 'mars': 2", result.stdout)
        self.assertIn("DRY RUN: ssh mars.holdenitdown.net sudo systemctl reboot", result.stdout)


if __name__ == "__main__":
    unittest.main()

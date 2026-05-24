import ast
import unittest

import inventory


class PantheonServerNodeInventoryTest(unittest.TestCase):
    def pantheon_host(self, name: str) -> dict:
        for host_name, data in inventory.pantheon:
            if host_name == name:
                return data
        self.fail(f"{name} not found in pantheon inventory")

    def k3s_setup_module(self) -> ast.Module:
        with open("deploys/k3s/setup.py") as deploy_file:
            return ast.parse(deploy_file.read())

    def test_athena_is_cuda_pantheon_server(self) -> None:
        host = self.pantheon_host("athena.holdenitdown.net")
        cluster = host["k3s_cluster"]

        self.assertEqual(cluster["name"], "pantheon")
        self.assertEqual(cluster["node_role"], "server")
        self.assertEqual(cluster["api_host"], "pantheon.holdenitdown.net")
        self.assertEqual(cluster["api_port"], 6443)
        self.assertEqual(
            cluster["labels"],
            {
                "rholden.dev/vlan-access": "3",
                "rholden.dev/gpu": "cuda",
            },
        )
        self.assertNotIn("taints", cluster)
        self.assertNotIn("kvm", host)

    def test_artemis_is_plain_pantheon_server(self) -> None:
        host = self.pantheon_host("artemis.holdenitdown.net")
        cluster = host["k3s_cluster"]

        self.assertEqual(cluster["name"], "pantheon")
        self.assertEqual(cluster["node_role"], "server")
        self.assertEqual(cluster["api_host"], "pantheon.holdenitdown.net")
        self.assertEqual(cluster["api_port"], 6443)
        self.assertEqual(cluster["labels"], {"rholden.dev/vlan-access": "3"})
        self.assertEqual(
            cluster["shutdown_timing"],
            {
                "shutdownGracePeriod": "5m",
                "shutdownGracePeriodCriticalPods": "1m",
                "timeoutStopSec": "6min",
            },
        )
        self.assertNotIn("taints", cluster)
        self.assertNotIn("kvm", host)

    def test_k3s_setup_does_not_reboot_hosts(self) -> None:
        calls = [
            node for node in ast.walk(self.k3s_setup_module()) if isinstance(node, ast.Call)
        ]

        self.assertFalse(
            any(
                isinstance(call.func, ast.Attribute) and call.func.attr == "reboot"
                for call in calls
            )
        )

    def test_new_servers_have_baseline_alloy_smartctl_config(self) -> None:
        for name in ["athena.holdenitdown.net", "artemis.holdenitdown.net"]:
            with self.subTest(name=name):
                alloy = self.pantheon_host(name)["alloy"]

                self.assertEqual(alloy["telemetry_host"], "telemetry.holdenitdown.net")
                self.assertFalse(alloy["unix_exporter_enabled"])
                self.assertFalse(alloy["log_collection_enabled"])
                self.assertTrue(alloy["smartctl_exporter_enabled"])
                self.assertEqual(
                    alloy["smartctl"],
                    {
                        "interval": "60s",
                        "rescan_interval": "10m",
                        "device_exclude": "^(loop|ram|sr)",
                    },
                )


class NvidiaContainerHostTest(unittest.TestCase):
    def module_assignments(self) -> dict[str, object]:
        with open("deploys/nvidia-container-host.py") as deploy_file:
            module = ast.parse(deploy_file.read())
        assignments = {}
        for statement in module.body:
            if isinstance(statement, ast.Assign):
                for target in statement.targets:
                    if isinstance(target, ast.Name) and target.id.isupper():
                        assignments[target.id] = self.evaluate_node(statement.value, assignments)
        return assignments

    def evaluate_node(self, node: ast.AST, assignments: dict[str, object]) -> object:
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Name):
            return assignments[node.id]
        if isinstance(node, ast.List):
            return [self.evaluate_node(item, assignments) for item in node.elts]
        if isinstance(node, ast.JoinedStr):
            parts = []
            for value in node.values:
                if isinstance(value, ast.Constant):
                    parts.append(str(value.value))
                elif isinstance(value, ast.FormattedValue):
                    parts.append(str(self.evaluate_node(value.value, assignments)))
            return "".join(parts)
        return ast.literal_eval(node)

    def literal_list(self, name: str) -> list[str]:
        assignments = self.module_assignments()
        self.assertIn(name, assignments)
        value = assignments[name]
        self.assertIsInstance(value, list)
        return value

    def test_nvidia_deploy_uses_x86_server_driver_packages(self) -> None:
        packages = self.literal_list("NVIDIA_DRIVER_PACKAGES")

        self.assertIn("linux-headers-generic", packages)
        self.assertIn("nvidia-driver-580-server", packages)
        self.assertIn("nvidia-dkms-580-server", packages)
        self.assertIn("nvidia-utils-580-server", packages)
        self.assertNotIn("linux-modules-nvidia-580-server-generic", packages)

    def test_nvidia_deploy_installs_container_toolkit_packages(self) -> None:
        packages = self.literal_list("NVIDIA_TOOLKIT_PACKAGES")

        self.assertEqual(
            packages,
            ["nvidia-container-runtime", "nvidia-container-toolkit"],
        )


if __name__ == "__main__":
    unittest.main()

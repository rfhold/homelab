import ast
import unittest

from pyinfra.facts.server import Which

from deploys.facts.kernel_args import KernelArgs
from deploys.operations import kernel_args


class KernelArgsFactTest(unittest.TestCase):
    def test_parse_grub_kernel_arguments(self) -> None:
        fact = KernelArgs()

        result = fact.process([
            "__PYINFRA_KERNEL_ARGS_GRUB__",
            '"quiet splash nvme_core.default_ps_max_latency_us=0 pcie_aspm=off"',
        ])

        self.assertTrue(result["available"])
        self.assertTrue(result["configured"])
        self.assertEqual(
            result["arguments"],
            ["quiet", "splash", "nvme_core.default_ps_max_latency_us=0", "pcie_aspm=off"],
        )

    def test_unsupported_grub_config_is_explicit(self) -> None:
        fact = KernelArgs()

        result = fact.process(["__PYINFRA_KERNEL_ARGS_UNAVAILABLE__"])

        self.assertFalse(result["available"])
        self.assertEqual(result["backend"], "grub")
        self.assertEqual(result["arguments"], [])


class FakeHost:
    def __init__(self, fact: dict[str, object], update_grub: str | None = "/usr/sbin/update-grub") -> None:
        self.fact = fact
        self.update_grub = update_grub
        self.noops = []

    def get_fact(self, fact_type: type, *args: object, **kwargs: object) -> object:
        if fact_type is KernelArgs:
            return self.fact
        if fact_type is Which:
            return self.update_grub
        raise AssertionError(f"unexpected fact {fact_type}")

    def noop(self, message: str) -> None:
        self.noops.append(message)


class KernelArgsOperationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.original_host = kernel_args.host

    def tearDown(self) -> None:
        kernel_args.host = self.original_host

    def run_operation(self, fact: dict[str, object], arguments: dict[str, str | None]) -> list[str]:
        kernel_args.host = FakeHost(fact)
        return list(kernel_args.kernel_args._inner(arguments))

    def test_missing_kernel_arguments_are_added_and_unmanaged_are_preserved(self) -> None:
        commands = self.run_operation(
            {
                "available": True,
                "backend": "grub",
                "configured": True,
                "arguments": ["quiet", "splash"],
            },
            {"nvme_core.default_ps_max_latency_us": "0", "pcie_aspm": "off"},
        )

        self.assertEqual(
            commands,
            [
                "sed -i.bak 's|^GRUB_CMDLINE_LINUX_DEFAULT=.*|GRUB_CMDLINE_LINUX_DEFAULT=\"quiet splash nvme_core.default_ps_max_latency_us=0 pcie_aspm=off\"|' /etc/default/grub",
                "update-grub",
            ],
        )

    def test_existing_kernel_argument_values_are_replaced_once(self) -> None:
        commands = self.run_operation(
            {
                "available": True,
                "backend": "grub",
                "configured": True,
                "arguments": [
                    "quiet",
                    "pcie_aspm=default",
                    "pcie_aspm=off",
                    "nvme_core.default_ps_max_latency_us=5500",
                ],
            },
            {"pcie_aspm": "off", "nvme_core.default_ps_max_latency_us": "0"},
        )

        self.assertEqual(
            commands[0],
            "sed -i.bak 's|^GRUB_CMDLINE_LINUX_DEFAULT=.*|GRUB_CMDLINE_LINUX_DEFAULT=\"quiet pcie_aspm=off nvme_core.default_ps_max_latency_us=0\"|' /etc/default/grub",
        )
        self.assertEqual(commands[1], "update-grub")

    def test_operation_adds_missing_grub_cmdline_when_configured_line_absent(self) -> None:
        commands = self.run_operation(
            {
                "available": True,
                "backend": "grub",
                "configured": False,
                "arguments": [],
            },
            {"pcie_aspm": "off"},
        )

        self.assertEqual(
            commands,
            [
                "printf '%s\\n' 'GRUB_CMDLINE_LINUX_DEFAULT=\"pcie_aspm=off\"' >> /etc/default/grub",
                "update-grub",
            ],
        )

    def test_operation_noops_when_kernel_arguments_match(self) -> None:
        fake_host = FakeHost(
            {
                "available": True,
                "backend": "grub",
                "configured": True,
                "arguments": ["quiet", "pcie_aspm=off"],
            }
        )
        kernel_args.host = fake_host

        commands = list(kernel_args.kernel_args._inner({"pcie_aspm": "off"}))

        self.assertEqual(commands, [])
        self.assertEqual(fake_host.noops, ["kernel arguments already match desired state"])

    def test_operation_rejects_unsupported_grub_config(self) -> None:
        kernel_args.host = FakeHost(
            {
                "available": False,
                "backend": "grub",
                "configured": False,
                "arguments": [],
            }
        )

        with self.assertRaisesRegex(ValueError, "supported GRUB config /etc/default/grub not found"):
            list(kernel_args.kernel_args._inner({"pcie_aspm": "off"}))

    def test_operation_rejects_missing_update_grub(self) -> None:
        kernel_args.host = FakeHost(
            {
                "available": True,
                "backend": "grub",
                "configured": True,
                "arguments": [],
            },
            update_grub=None,
        )

        with self.assertRaisesRegex(ValueError, "update-grub command not found"):
            list(kernel_args.kernel_args._inner({"pcie_aspm": "off"}))


class NvmePciePowerControlDeployTest(unittest.TestCase):
    def deploy_module(self) -> ast.Module:
        with open("deploys/disable-nvme-pcie-power-control.py") as deploy_file:
            return ast.parse(deploy_file.read())

    def assignments(self) -> dict[str, object]:
        values: dict[str, object] = {}
        for statement in self.deploy_module().body:
            if isinstance(statement, ast.Assign):
                for target in statement.targets:
                    if isinstance(target, ast.Name):
                        values[target.id] = ast.literal_eval(statement.value)
        return values

    def kernel_args_call(self) -> ast.Call:
        for statement in self.deploy_module().body:
            if not isinstance(statement, ast.Expr) or not isinstance(statement.value, ast.Call):
                continue
            call = statement.value
            if isinstance(call.func, ast.Name) and call.func.id == "kernel_args":
                return call
        self.fail("kernel_args operation call not found")

    def test_deploy_uses_kernel_args_operation(self) -> None:
        module = self.deploy_module()
        imports = [statement for statement in module.body if isinstance(statement, ast.ImportFrom)]

        self.assertTrue(
            any(
                statement.module == "deploys.operations.kernel_args"
                and any(alias.name == "kernel_args" for alias in statement.names)
                for statement in imports
            )
        )
        self.assertFalse(
            any(statement.module == "pyinfra.operations" for statement in imports)
        )

    def test_deploy_manages_approved_kernel_arguments(self) -> None:
        assignments = self.assignments()
        call = self.kernel_args_call()
        keyword_arguments = {keyword.arg: keyword.value for keyword in call.keywords}

        self.assertEqual(
            assignments["NVME_PCIE_POWER_CONTROL_KERNEL_ARGS"],
            {
                "nvme_core.default_ps_max_latency_us": "0",
                "pcie_aspm": "off",
            },
        )
        self.assertIn("arguments", keyword_arguments)
        self.assertIsInstance(keyword_arguments["arguments"], ast.Name)
        self.assertEqual(keyword_arguments["arguments"].id, "NVME_PCIE_POWER_CONTROL_KERNEL_ARGS")
        self.assertIn("_sudo", keyword_arguments)
        self.assertIsInstance(keyword_arguments["_sudo"], ast.Constant)
        self.assertIs(keyword_arguments["_sudo"].value, True)
        self.assertNotIn("path", keyword_arguments)
        self.assertNotIn("update_command", keyword_arguments)

    def test_deploy_does_not_reboot_hosts(self) -> None:
        calls = [node for node in ast.walk(self.deploy_module()) if isinstance(node, ast.Call)]

        self.assertFalse(
            any(isinstance(call.func, ast.Attribute) and call.func.attr == "reboot" for call in calls)
        )


if __name__ == "__main__":
    unittest.main()

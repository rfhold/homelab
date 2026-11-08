import shlex
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from deploys.gpu_selection import SelectionError, main, select_render_node, systemd_quote


class GpuSelectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.sysfs = Path(self.temporary.name)

    def gpu(self, name: str, device: str, vendor: str = "1002") -> None:
        directory = self.sysfs / name / "device"
        directory.mkdir(parents=True)
        (directory / "vendor").write_text(f"0x{vendor}\n")
        (directory / "device").write_text(f"0x{device}\n")

    def test_integrated_only_and_optional_absent(self) -> None:
        self.gpu("renderD129", "1586")
        self.assertEqual(select_render_node("1002", "1586", self.sysfs), "/dev/dri/renderD129")
        self.assertIsNone(select_render_node("1002", "744c", self.sysfs))

    def test_both_and_reversed_enumeration(self) -> None:
        for integrated, discrete in [("renderD128", "renderD129"), ("renderD137", "renderD128")]:
            with self.subTest(integrated=integrated):
                directory = self.sysfs / integrated
                directory.mkdir()
                previous = self.sysfs
                self.sysfs = directory
                self.gpu(integrated, "1586")
                self.gpu(discrete, "744c")
                self.gpu("renderD140", "744c", vendor="1234")
                self.assertEqual(select_render_node("1002", "1586", self.sysfs), f"/dev/dri/{integrated}")
                self.assertEqual(select_render_node("1002", "744c", self.sysfs), f"/dev/dri/{discrete}")
                self.sysfs = previous

    def test_ambiguous_and_unreadable_fail_closed(self) -> None:
        self.gpu("renderD128", "744c")
        self.gpu("renderD129", "744c")
        with self.assertRaises(SelectionError):
            select_render_node("1002", "744c", self.sysfs)
        (self.sysfs / "renderD129/device/vendor").unlink()
        with self.assertRaises(SelectionError):
            select_render_node("1002", "744c", self.sysfs)

    def test_condition_exit_semantics(self) -> None:
        with patch("deploys.gpu_selection.select_render_node", return_value=None):
            self.assertEqual(main(["check", "1002", "744c", "optional"]), 1)
            self.assertEqual(main(["check", "1002", "1586", "required"]), 255)
            self.assertEqual(main(["run", "1002", "744c", "optional", "--", "/usr/bin/docker", "@GPU_RENDER@"]), 255)
        with patch("deploys.gpu_selection.select_render_node", side_effect=SelectionError("ambiguous")):
            self.assertEqual(main(["check", "1002", "744c", "optional"]), 255)

    def test_exec_is_not_shell_and_only_replaces_exact_token(self) -> None:
        literal = 'space "quote" $HOME 100% ; touch /bad'
        with patch("deploys.gpu_selection.select_render_node", return_value="/dev/dri/renderD145"), patch.object(Path, "is_char_device", return_value=True), patch("os.execv") as execute:
            self.assertEqual(main(["run", "1002", "744c", "optional", "--", "/usr/bin/docker", "--device", "@GPU_RENDER@", literal]), 0)
            execute.assert_called_once_with("/usr/bin/docker", ["/usr/bin/docker", "--device", "/dev/dri/renderD145", literal])
        encoded = shlex.split(systemd_quote(literal))[0]
        self.assertEqual(encoded.replace("%%", "%").replace("$$", "$"), literal)
        for character in ("\n", "\x00", "\r"):
            with self.assertRaises(ValueError):
                systemd_quote(character)


if __name__ == "__main__":
    unittest.main()

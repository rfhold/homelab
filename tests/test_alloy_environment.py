import unittest


class AlloyEnvironmentTemplateTest(unittest.TestCase):
    def test_environment_sets_config_file_for_packaged_service(self) -> None:
        with open("deploys/alloy/templates/environment.j2") as template_file:
            template = template_file.read()

        self.assertIn("CONFIG_FILE=/etc/alloy/config.alloy", template.splitlines())


if __name__ == "__main__":
    unittest.main()

"""Exercise the integration generator against a clean local checkout of its pin."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(os.environ.get("BHARATCODE_DESKTOP_SOURCE", ROOT / ".local/desktop"))


@unittest.skipUnless(SOURCE.is_dir(), "Set BHARATCODE_DESKTOP_SOURCE to a local Desktop clone")
class DesktopIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.target = Path(cls.temp.name) / "desktop"
        subprocess.run(["git", "clone", "--quiet", "--shared", str(SOURCE), str(cls.target)],
                       check=True, capture_output=True, text=True)
        for _ in range(2):
            subprocess.run([sys.executable, str(ROOT / "desktop-integration/apply.py"), str(cls.target)],
                           check=True, capture_output=True, text=True)

    def test_active_v2_settings_exposes_mobile_navigation_and_panel(self):
        source = (self.target / "packages/app/src/components/settings-v2/dialog-settings-v2.tsx").read_text()
        self.assertIn('import { SettingsMobile } from "../settings-mobile"', source)
        self.assertEqual(source.count('<TabsV2.Trigger value="mobile">'), 1)
        self.assertEqual(source.count('<TabsV2.Content value="mobile"'), 1)
        self.assertIn('<SettingsMobile />', source)
        self.assertIn('when={platform.mobileAccess}', source)

    def test_embedded_desktop_uses_bharatcode_catalog_in_dev_channel(self):
        source = (self.target / "packages/desktop/src/main/sidecar.ts").read_text()
        prepare = source.split('function prepareSidecarEnv(', 1)[1].split('\n}', 1)[0]
        self.assertIn('BHARATCODE_PRODUCT_POLICY: "shipped"', prepare)
        self.assertLess(source.index('prepareSidecarEnv(command.password'),
                        source.index('await import("virtual:opencode-server")'))


if __name__ == "__main__":
    unittest.main()

import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

HELPER = Path(__file__).with_name("with-host-environment")
KEYS = ("XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME")
PROBE = "import os,json,sys; print(json.dumps({'env': dict(os.environ), 'args': sys.argv[1:]}))"


class HostEnvironmentTest(unittest.TestCase):
    def run_handoff(self, env):
        url = "https://example.com/?state=synthetic&literal=$(false)"
        result = subprocess.run(
            ["sh", str(HELPER), sys.executable, "-c", PROBE, url],
            env=env, check=True, capture_output=True, text=True,
        )
        captured = json.loads(result.stdout)
        self.assertEqual(captured["args"], [url])
        self.assertEqual(captured["env"]["DISPLAY"], ":synthetic-display")
        return captured["env"]

    def isolated_env(self):
        env = {"PATH": os.environ["PATH"], "DISPLAY": ":synthetic-display",
               "BHARATCODE_HOST_BROWSER_ENV": "1"}
        for key in KEYS:
            env[key] = "/private-bc/" + key
        return env

    def test_handoff_restores_custom_host_roots_without_mutating_app_environment(self):
        env = self.isolated_env()
        for key in KEYS:
            env["BHARATCODE_HOST_" + key] = "/host-desktop/" + key
        captured = self.run_handoff(env)
        for key in KEYS:
            self.assertEqual(captured[key], "/host-desktop/" + key)
            self.assertEqual(env[key], "/private-bc/" + key)
            self.assertNotIn("BHARATCODE_HOST_" + key, captured)
        self.assertNotIn("BHARATCODE_HOST_BROWSER_ENV", captured)

    def test_handoff_unsets_roots_that_were_unset_in_host_session(self):
        env = self.isolated_env()
        for key in KEYS:
            env["BHARATCODE_HOST_" + key] = ""
        captured = self.run_handoff(env)
        for key in KEYS:
            self.assertNotIn(key, captured)

    def test_normal_install_environment_is_preserved(self):
        env = self.isolated_env()
        del env["BHARATCODE_HOST_BROWSER_ENV"]
        captured = self.run_handoff(env)
        for key in KEYS:
            self.assertEqual(captured[key], env[key])


if __name__ == "__main__":
    unittest.main()

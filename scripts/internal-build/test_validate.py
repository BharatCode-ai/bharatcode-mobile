import copy
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location("validate", Path(__file__).with_name("validate.py"))
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


class BuildGuards(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"BC_INTERNAL_BUILD_NUMBER": "1", "EXPO_PUBLIC_BC_PREVIEW": "0"}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def config(self):
        return {"version": v.VERSION, "android": {"package": v.ANDROID_ID, "versionCode": 1},
                "ios": {"bundleIdentifier": v.IOS_ID, "buildNumber": "1"}}

    def bundle(self, signed=False, js=True):
        path = self.root / "app.aab"
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("BundleConfig.pb", b"fixture")
            z.writestr("base/manifest/AndroidManifest.xml", b"fixture")
            z.writestr("base/assets/index.android.bundle", b"fixture" if js else b"")
            z.writestr("base/lib/arm64-v8a/libapp.so", b"fixture")
            if signed:
                z.writestr("META-INF/ANDROID.RSA", b"fixture")
        return path

    def ios_app(self):
        app = self.root / "BharatCode.app"
        app.mkdir()
        info = {"CFBundleIdentifier": v.IOS_ID, "CFBundleShortVersionString": v.VERSION,
                "CFBundleVersion": "1", "CFBundleSupportedPlatforms": ["iPhoneOS"],
                "CFBundleExecutable": "BharatCode"}
        (app / "Info.plist").write_bytes(plistlib.dumps(info))
        (app / "BharatCode").write_bytes(b"fixture")
        (app / "main.jsbundle").write_bytes(b"fixture")
        return app

    def test_build_number_bounds(self):
        for value in ("1", "9999"):
            with patch.dict(os.environ, BC_INTERNAL_BUILD_NUMBER=value):
                self.assertEqual(v.build_number(), value)
        for value in ("", "0", "01", "10000", "-1", "1.2", "1\n", "${{ secrets.TOKEN }}"):
            with self.subTest(value=value), patch.dict(os.environ, BC_INTERNAL_BUILD_NUMBER=value):
                with self.assertRaises(ValueError):
                    v.build_number()

    def test_config_identity_and_build_numbers(self):
        v.validate_config(self.config())
        for platform, key, value in (("android", "package", "wrong"), ("ios", "bundleIdentifier", "wrong"),
                                      ("android", "versionCode", 2), ("ios", "buildNumber", "2")):
            config = copy.deepcopy(self.config())
            config[platform][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                v.validate_config(config)

    def test_sample_mode_rejected(self):
        with patch.dict(os.environ, EXPO_PUBLIC_BC_PREVIEW="1"), self.assertRaises(ValueError):
            v.validate_config(self.config())

    def test_gradle_unsigned_removes_fallback(self):
        template = f'applicationId "{v.ANDROID_ID}"\nsigningConfig signingConfigs.debug\n'
        result = v.release_gradle(template, "unsigned")
        self.assertIn("signingConfig null", result)
        self.assertIn("config != null", result)
        self.assertIn("debuggable false", result)
        self.assertIn("verifyInternalRelease", result)
        with self.assertRaises(ValueError):
            v.release_gradle(result, "unsigned")

    def test_gradle_signed_requires_internal_upload(self):
        template = f'applicationId "{v.ANDROID_ID}"\nsigningConfig signingConfigs.debug\n'
        result = v.release_gradle(template, "upload-key")
        self.assertIn("signingConfig signingConfigs.internalUpload", result)
        self.assertIn('config.name != "internalUpload"', result)
        self.assertNotIn("SIGNING_CONFIG", result)
        self.assertNotIn("INVALID_SIGNING", result)

    def test_changed_native_template_fails_closed(self):
        with self.assertRaises(ValueError):
            v.release_gradle("unrecognized template", "unsigned")

    def test_no_missing_credentials_fallback(self):
        with self.assertRaisesRegex(ValueError, "Missing signing secrets"):
            v.signing_prerequisites()
        with patch.dict(os.environ, BC_ANDROID_SIGNING="debug"), self.assertRaises(ValueError):
            v.signing_mode()

    def test_debug_alias_rejected(self):
        env = {name: "fixture" for name in v.SIGNING_SECRETS}
        env["ANDROID_KEY_ALIAS"] = "androiddebugkey"
        with patch.dict(os.environ, env), self.assertRaisesRegex(ValueError, "Debug key alias"):
            v.signing_prerequisites()

    def test_fingerprint_normalization_and_required(self):
        with self.assertRaises(ValueError):
            v.expected_fingerprint()
        with patch.dict(os.environ, ANDROID_UPLOAD_CERT_SHA256=":".join(["AB"] * 32)):
            self.assertEqual(v.expected_fingerprint(), "ab" * 32)

    def test_android_manifest_rejects_debug_or_wrong_identity(self):
        manifest = f'<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="{v.ANDROID_ID}" android:versionName="{v.VERSION}" android:versionCode="1"><application android:debuggable="false" /></manifest>'
        v.validate_android_manifest(manifest)
        for invalid in (manifest.replace('debuggable="false"', 'debuggable="true"'),
                        manifest.replace(v.ANDROID_ID, "other.app"),
                        manifest.replace('versionCode="1"', 'versionCode="2"')):
            with self.assertRaises(ValueError):
                v.validate_android_manifest(invalid)

    def test_unsigned_aab_requires_no_signature_and_embedded_bundle(self):
        v.validate_aab(self.bundle())
        with self.assertRaises(ValueError):
            v.validate_aab(self.bundle(signed=True))
        with self.assertRaises(ValueError):
            v.validate_aab(self.bundle(js=False))

    def test_signed_mode_rejects_unsigned_aab(self):
        with self.assertRaisesRegex(ValueError, "upload-key signature"):
            v.validate_aab(self.bundle(), "upload-key")

    def test_ios_archive_requires_device_bundle_and_no_signing(self):
        app = self.ios_app()
        v.validate_ios_app(app)
        (app / "embedded.mobileprovision").write_bytes(b"fixture")
        with self.assertRaises(ValueError):
            v.validate_ios_app(app)

    def test_ios_simulator_rejected(self):
        app = self.ios_app()
        info = plistlib.loads((app / "Info.plist").read_bytes())
        info["CFBundleSupportedPlatforms"] = ["iPhoneSimulator"]
        (app / "Info.plist").write_bytes(plistlib.dumps(info))
        with self.assertRaises(ValueError):
            v.validate_ios_app(app)

    def test_metadata_never_claims_upload_or_acceptance(self):
        artifact = self.bundle()
        with patch.dict(os.environ, GITHUB_SHA="a" * 40, GITHUB_RUN_ID="123", GITHUB_RUN_ATTEMPT="1"):
            v.record("android", artifact)
        info = json.loads((self.root / "build-metadata.json").read_text())
        self.assertFalse(info["storeUploadable"])
        self.assertFalse(info["storeUploadPerformed"])
        self.assertFalse(info["nativeAcceptanceTested"])
        self.assertEqual(info["applicationId"], v.ANDROID_ID)
        self.assertEqual(len(info["sha256"]), 64)


if __name__ == "__main__":
    unittest.main()

"""Synthetic fixtures only; no keys, Apple access, or native tool invocation."""

import copy
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ios_signing", Path(__file__).with_name("ios_signing.py"))
ios = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ios)


class IOSSigningGuards(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 18, tzinfo=timezone.utc)
        self.cert = b"SYNTHETIC CERTIFICATE FIXTURE, NOT SIGNING MATERIAL"
        self.env = {name: "fixture-not-a-secret" for name in ios.SECRETS}
        self.env.update({
            "IOS_TEAM_ID": "TEAMTEST01", "IOS_APP_ID_PREFIX": "PREFIX0001",
            "IOS_PROVISION_PROFILE_UUID": "abcdef01-2345-6789-abcd-0123456789ab",
            "IOS_DISTRIBUTION_CERT_SHA256": hashlib.sha256(self.cert).hexdigest(),
            "BC_INTERNAL_BUILD_NUMBER": "1",
        })
        self.app_id = self.env["IOS_APP_ID_PREFIX"] + "." + ios.IOS_ID
        self.profile = {
            "UUID": self.env["IOS_PROVISION_PROFILE_UUID"],
            "TeamIdentifier": [self.env["IOS_TEAM_ID"]],
            "ApplicationIdentifierPrefix": [self.env["IOS_APP_ID_PREFIX"]],
            "Platform": ["iOS"],
            "CreationDate": self.now - timedelta(days=1),
            "ExpirationDate": self.now + timedelta(days=30),
            "DeveloperCertificates": [self.cert],
            "Entitlements": {
                "application-identifier": self.app_id,
                "com.apple.developer.team-identifier": self.env["IOS_TEAM_ID"],
                "get-task-allow": False, "beta-reports-active": True,
                "keychain-access-groups": [self.env["IOS_APP_ID_PREFIX"] + ".*"],
            },
        }

    def valid(self, profile=None, env=None):
        return ios.validate_profile(profile or self.profile, env or self.env, self.now)

    def test_valid_profile_and_distinct_legacy_prefix(self):
        self.assertEqual(self.valid(), self.cert)
        ios.prerequisites(self.env)

    def test_profile_uuid_spelling_is_preserved_for_xcode_and_installation(self):
        uuid = self.profile["UUID"]
        self.assertEqual(ios.identifiers(self.env)["IOS_PROVISION_PROFILE_UUID"], uuid)
        with patch.dict(os.environ, self.env, clear=True), patch.object(Path, "home", return_value=Path("/fixture")):
            self.assertEqual(ios.profile_path(), Path("/fixture/Library/Developer/Xcode/UserData/Provisioning Profiles")
                             / (uuid + ".mobileprovision"))
        # Reject an inconsistent pin before Xcode, rather than silently rewriting
        # the profile selector. Existing export/project/settings tests also use
        # this lowercase alphabetic UUID, so they cover the original regression.
        with self.assertRaisesRegex(ValueError, "profile UUID"):
            self.valid(env={**self.env, "IOS_PROVISION_PROFILE_UUID": uuid.upper()})

    def test_each_required_input_is_mandatory(self):
        for name in self.env:
            env = dict(self.env)
            del env[name]
            with self.subTest(name=name), self.assertRaises(ValueError):
                ios.prerequisites(env)

    def test_invalid_public_identifiers_rejected(self):
        for key, value in (("IOS_TEAM_ID", "invalid"), ("IOS_APP_ID_PREFIX", "*"),
                           ("IOS_PROVISION_PROFILE_UUID", "../profile"),
                           ("IOS_DISTRIBUTION_CERT_SHA256", "not-hex"),
                           ("BC_INTERNAL_BUILD_NUMBER", "01")):
            with self.subTest(key=key), self.assertRaises(ValueError):
                ios.prerequisites({**self.env, key: value})

    def test_profile_identity_must_match_exactly(self):
        for key, value in (("UUID", "00000000-0000-0000-0000-000000000000"),
                           ("TeamIdentifier", ["OTHER00001"]),
                           ("ApplicationIdentifierPrefix", ["OTHER00001"]),
                           ("Platform", ["OSX"])):
            profile = copy.deepcopy(self.profile)
            profile[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.valid(profile)

    def test_wildcard_or_different_bundle_id_rejected(self):
        for value in (self.env["IOS_APP_ID_PREFIX"] + ".*", "TEAMTEST01." + ios.IOS_ID,
                      self.app_id + ".beta", "PREFIX0001.ai.bharatcode.mobile"):
            profile = copy.deepcopy(self.profile)
            profile["Entitlements"]["application-identifier"] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.valid(profile)

    def test_debug_adhoc_enterprise_and_non_testflight_rejected(self):
        for key, value in (("ProvisionedDevices", []), ("ProvisionsAllDevices", True),
                           ("ProvisionsAllDevices", False)):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                self.valid({**self.profile, key: value})
        for key, values in (("get-task-allow", [True, "false", 0, None]),
                            ("beta-reports-active", [False, "true", 1, None])):
            for value in values:
                profile = copy.deepcopy(self.profile)
                profile["Entitlements"][key] = value
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    self.valid(profile)

    def test_dates_fail_closed(self):
        for key, value in (("CreationDate", self.now + timedelta(seconds=1)),
                           ("ExpirationDate", self.now), ("ExpirationDate", None)):
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.valid({**self.profile, key: value})
        profile = copy.deepcopy(self.profile)
        for key in ("CreationDate", "ExpirationDate"):
            profile[key] = profile[key].replace(tzinfo=None)
        self.valid(profile)

    def test_missing_extra_or_wrong_certificate_rejected(self):
        for certs in ([], [b"wrong"], [self.cert, self.cert], ["not bytes"]):
            with self.subTest(certs=certs), self.assertRaises(ValueError):
                self.valid({**self.profile, "DeveloperCertificates": certs})

    def test_fingerprint_colons_normalized(self):
        value = self.env["IOS_DISTRIBUTION_CERT_SHA256"]
        env = {**self.env, "IOS_DISTRIBUTION_CERT_SHA256": ":".join(value[i:i+2] for i in range(0, 64, 2)).upper()}
        self.valid(env=env)

    def entitlements(self):
        ent = copy.deepcopy(self.profile["Entitlements"])
        ent["keychain-access-groups"] = [self.app_id]
        return ent

    def test_signed_entitlements_match_approved_profile(self):
        ios.validate_entitlements(self.entitlements(), self.profile, self.env, self.now)
        for key, value in (("get-task-allow", True), ("get-task-allow", 0),
                           ("aps-environment", "production"),
                           ("keychain-access-groups", ["PREFIX0001.other-app"])):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                ios.validate_entitlements({**self.entitlements(), key: value}, self.profile, self.env, self.now)

    def test_profile_must_allow_signed_keychain_group(self):
        profile = copy.deepcopy(self.profile)
        del profile["Entitlements"]["keychain-access-groups"]
        with self.assertRaises(ValueError):
            ios.validate_entitlements(self.entitlements(), profile, self.env, self.now)

    def test_packaged_info_checks_platform_identity_and_versions(self):
        info = {"CFBundleIdentifier": ios.IOS_ID, "CFBundleShortVersionString": ios.VERSION,
                "CFBundleVersion": "1", "CFBundleSupportedPlatforms": ["iPhoneOS"]}
        ios.validate_app_info(info, "1")
        for key, value in (("CFBundleIdentifier", ios.IOS_ID + ".beta"),
                           ("CFBundleShortVersionString", "1.0.0"), ("CFBundleVersion", "2"),
                           ("CFBundleSupportedPlatforms", ["iPhoneSimulator"])):
            with self.subTest(key=key), self.assertRaises(ValueError):
                ios.validate_app_info({**info, key: value}, "1")

    def test_export_is_manual_internal_only_no_upload_no_auto_increment(self):
        options = ios.export_options(self.profile, self.env, self.now)
        self.assertEqual(options["method"], "app-store-connect")
        self.assertEqual(options["destination"], "export")
        self.assertEqual(options["signingStyle"], "manual")
        self.assertIs(options["testFlightInternalTestingOnly"], True)
        self.assertIs(options["manageAppVersionAndBuildNumber"], False)
        self.assertIs(options["uploadSymbols"], False)
        self.assertEqual(options["signingCertificate"], hashlib.sha1(self.cert).hexdigest().upper())
        self.assertEqual(options["provisioningProfiles"], {ios.IOS_ID: self.env["IOS_PROVISION_PROFILE_UUID"]})

    def test_export_rejects_profile_mismatch_before_producing_options(self):
        with self.assertRaises(ValueError):
            ios.export_options(self.profile, {**self.env, "IOS_TEAM_ID": "OTHER00001"}, self.now)

    def test_workflow_scopes_explicit_signing_and_preserves_unsigned_default(self):
        workflow = (Path(__file__).resolve().parents[2] / ".github/workflows/internal-build.yml").read_text()
        self.assertIn("inputs.platform == 'android' && inputs.android_signing == 'upload-key'", workflow)
        self.assertIn("CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO", workflow)
        self.assertIn("options: [unsigned, testflight]\n        default: unsigned", workflow)
        signed = workflow.split("\n  ios-signed:\n", 1)[1]
        self.assertIn("inputs.platform == 'ios' && inputs.ios_signing == 'testflight'", signed)
        for gate in ("source", "security", "compatibility"):
            self.assertIn(f"needs.{gate}.result == 'success'", signed)
        self.assertIn("environment: mobile-internal-ios", signed)
        self.assertNotIn("ANDROID_", signed)
        self.assertIn('SOURCEMAP_FILE="$PWD/build/ios/main.jsbundle.map"', signed)
        self.assertIn("security_gate.py runtime-ios build/ios/main.jsbundle.map", signed)
        self.assertLess(signed.index("runtime-ios"), signed.index("-exportArchive"))
        self.assertLess(signed.index("verify-export"), signed.index("ios_signing.py cleanup"))
        self.assertLess(signed.index("ios_signing.py cleanup"), signed.index("actions/upload-artifact"))
        self.assertNotIn("-allowProvisioningUpdates", signed)

    def test_cli_redacts_invalid_input(self):
        env = {**self.env, "IOS_TEAM_ID": "SENSITIVE-FIXTURE-MUST-NOT-PRINT",
               "PYTHONDONTWRITEBYTECODE": "1"}
        result = subprocess.run([sys.executable, str(Path(ios.__file__)), "prerequisites"],
                                env=env, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(env["IOS_TEAM_ID"], result.stdout + result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        self.assertIn("[prerequisites]: Missing/invalid IOS_TEAM_ID", result.stderr)

    def test_cli_suppresses_untrusted_exception_text_but_reports_fixed_stage(self):
        for error in (ValueError("SENSITIVE-PARSER-DATA"), KeyError("SENSITIVE-KEY"),
                      TypeError("SENSITIVE-VALUE"), OSError("SENSITIVE-PATH"),
                      plistlib.InvalidFileException("SENSITIVE-PLIST")):
            with self.subTest(error=type(error).__name__):
                output, errors = io.StringIO(), io.StringIO()
                def fail():
                    ios.stage("install/profile-cms-decode")
                    raise error
                with patch.object(ios, "main", side_effect=fail), redirect_stdout(output), redirect_stderr(errors):
                    self.assertEqual(ios.cli(), 1)
                self.assertIn("[install/profile-cms-decode]", errors.getvalue())
                self.assertNotIn("SENSITIVE", output.getvalue() + errors.getvalue())
                self.assertNotIn("Traceback", errors.getvalue())

    def test_install_diagnostics_distinguish_early_failures_without_exposing_inputs(self):
        cases = (
            ("help-exit", "xcode-help", "Native tool failed (exit 64;"),
            ("help-options", "xcode-export-options", "Selected Xcode lacks required internal-only export options"),
            ("version", "xcode-version", "Unexpected Xcode version"),
            ("profile-decode", "profile-cms-decode", "details suppressed"),
            ("profile-policy", "profile-policy", "Profile team mismatch"),
            ("trust-exit", "certificate-trust", "Native tool failed (exit 1;"),
            ("import-exit", "p12-import", "Native tool failed (exit 1;"),
        )
        for case, label, message in cases:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as folder:
                profile = copy.deepcopy(self.profile)
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                profile.update(CreationDate=now - timedelta(days=1), ExpirationDate=now + timedelta(days=1))
                if case == "profile-policy": profile["TeamIdentifier"] = ["SENSITIVE-WRONG-TEAM"]
                calls = []
                def fake(args, **kwargs):
                    calls.append(args)
                    code, output = 0, b""
                    if args[:2] == ["xcodebuild", "-help"]:
                        output = b"testFlightInternalTestingOnly app-store-connect manageAppVersionAndBuildNumber"
                        if case == "help-exit": code = 64
                        if case == "help-options": output = b"SENSITIVE-HELP"
                    elif args[:2] == ["xcodebuild", "-version"]:
                        output = b"SENSITIVE-VERSION" if case == "version" else b"Xcode 26.6\nBuild version fixture"
                    elif args[:2] == ["security", "cms"]:
                        output = b"SENSITIVE-INVALID-PLIST" if case == "profile-decode" else plistlib.dumps(profile)
                    elif args[:2] == ["security", "verify-cert"] and case == "trust-exit": code = 1
                    elif args[:2] == ["security", "import"] and case == "import-exit": code = 1
                    return subprocess.CompletedProcess(args, code, output, b"SENSITIVE-NATIVE-ERROR")
                env = {**self.env, "RUNNER_TEMP": folder,
                       ios.SECRETS[0]: "Zml4dHVyZQ==", ios.SECRETS[2]: "Zml4dHVyZQ=="}
                output, errors = io.StringIO(), io.StringIO()
                with patch.dict(os.environ, env, clear=True), patch.object(ios.subprocess, "run", side_effect=fake), \
                     patch.object(ios, "main", side_effect=ios.install), redirect_stdout(output), redirect_stderr(errors):
                    self.assertEqual(ios.cli(), 1)
                self.assertEqual(output.getvalue().splitlines()[-1], "iOS stage: install/" + label)
                self.assertIn("[install/" + label + "]", errors.getvalue())
                self.assertIn(message, errors.getvalue())
                self.assertNotIn("SENSITIVE", output.getvalue() + errors.getvalue())
                self.assertNotIn("Traceback", errors.getvalue())
                if case != "import-exit":
                    self.assertFalse(any(args[:2] == ["security", "import"] for args in calls))

    def test_cli_writes_private_export_policy_without_overwriting(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            profile = copy.deepcopy(self.profile)
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            profile["CreationDate"] = now - timedelta(days=1)
            profile["ExpirationDate"] = now + timedelta(days=1)
            source, output = root / "profile.plist", root / "ExportOptions.plist"
            source.write_bytes(plistlib.dumps(profile))
            command = [sys.executable, str(Path(ios.__file__)), "export-options", str(source), str(output)]
            env = {**self.env, "PYTHONDONTWRITEBYTECODE": "1"}
            result = subprocess.run(command, env=env, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            before = output.read_bytes()
            self.assertTrue(plistlib.loads(before)["testFlightInternalTestingOnly"])
            if sys.platform != "win32":
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            result = subprocess.run(command, env=env, capture_output=True, check=False)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(output.read_bytes(), before)

    def project(self):
        return {"PBXNativeTarget": {"APP": {"name": "BharatCode", "productType": '"com.apple.product-type.application"',
                                          "buildConfigurationList": "LIST"}, "APP_comment": "BharatCode"},
                "XCConfigurationList": {"LIST": {"buildConfigurations": [{"value": "DEBUG"}, {"value": "RELEASE"}]}},
                "XCBuildConfiguration": {
                    "DEBUG": {"name": "Debug", "buildSettings": {"PRODUCT_BUNDLE_IDENTIFIER": ios.IOS_ID}},
                    "RELEASE": {"name": "Release", "buildSettings": {"PRODUCT_BUNDLE_IDENTIFIER": ios.IOS_ID,
                        '"CODE_SIGN_IDENTITY[sdk=iphoneos*]"': '"iPhone Developer"', "PROVISIONING_PROFILE": "old"}},
                    "POD": {"name": "Release", "buildSettings": {"CODE_SIGNING_ALLOWED": "NO"}}}}

    def test_project_changes_only_app_release_not_debug_or_pods(self):
        project = self.project()
        original = copy.deepcopy(project)
        changes = ios.project_settings(project, self.env, "A" * 40)
        self.assertEqual(project, original)
        self.assertEqual(list(changes), ["RELEASE"])
        self.assertEqual(changes["RELEASE"]["CODE_SIGN_IDENTITY"], "A" * 40)
        self.assertEqual(changes["RELEASE"]['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'], "A" * 40)
        self.assertNotIn("PROVISIONING_PROFILE", changes["RELEASE"])
        self.assertEqual(changes["RELEASE"]["PROVISIONING_PROFILE_SPECIFIER"], self.env["IOS_PROVISION_PROFILE_UUID"])

    def test_project_rejects_changed_identity_or_extra_target(self):
        project = self.project()
        project["XCBuildConfiguration"]["RELEASE"]["buildSettings"]["PRODUCT_BUNDLE_IDENTIFIER"] += ".other"
        with self.assertRaises(ValueError): ios.project_settings(project, self.env, "A" * 40)
        project = self.project()
        project["PBXNativeTarget"]["EXTENSION"] = {"productType": "com.apple.product-type.app-extension"}
        with self.assertRaises(ValueError): ios.project_settings(project, self.env, "A" * 40)

    def test_effective_build_settings_must_match(self):
        settings = {"PRODUCT_BUNDLE_IDENTIFIER": ios.IOS_ID, "CONFIGURATION": "Release", "PLATFORM_NAME": "iphoneos",
                    "CODE_SIGN_STYLE": "Manual", "DEVELOPMENT_TEAM": self.env["IOS_TEAM_ID"],
                    "CODE_SIGN_IDENTITY": "A" * 40, "CODE_SIGNING_ALLOWED": "YES",
                    "PROVISIONING_PROFILE_SPECIFIER": self.env["IOS_PROVISION_PROFILE_UUID"]}
        ios.validate_build_settings([{"target": "BharatCode", "buildSettings": settings}], self.env, "A" * 40)
        for key in settings:
            with self.subTest(key=key), self.assertRaises(ValueError):
                ios.validate_build_settings([{"target": "BharatCode", "buildSettings": {**settings, key: "wrong"}}], self.env, "A" * 40)

    def test_native_tool_failure_does_not_expose_captured_secret_or_command_arguments(self):
        failure = subprocess.CompletedProcess([], 1, b"SENSITIVE-OUTPUT", b"SENSITIVE-ERROR")
        with patch.object(ios.subprocess, "run", return_value=failure), self.assertRaises(ValueError) as error:
            ios.run(["security", "import", "-P", "SENSITIVE-PASSWORD"])
        self.assertNotIn("SENSITIVE", str(error.exception))

    def test_install_and_cleanup_use_owned_temporary_material_only(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {**self.env, "RUNNER_TEMP": folder}, clear=True):
            profile = copy.deepcopy(self.profile)
            profile["ExpirationDate"] = datetime.now(timezone.utc) + timedelta(days=1)
            profile["CreationDate"] = datetime.now(timezone.utc) - timedelta(days=1)
            target = Path(folder) / "profiles" / "fixture.mobileprovision"
            env = {ios.SECRETS[0]: "Zml4dHVyZQ==", ios.SECRETS[2]: "Zml4dHVyZQ=="}
            calls = []
            def fake(args, data=None):
                calls.append([str(a) for a in args])
                output = b""
                if args[:2] == ["xcodebuild", "-help"]:
                    output = b"testFlightInternalTestingOnly app-store-connect manageAppVersionAndBuildNumber"
                elif args[:2] == ["xcodebuild", "-version"]: output = b"Xcode 26.6\nBuild version fixture"
                elif args[:2] == ["security", "find-identity"]:
                    output = (hashlib.sha1(self.cert).hexdigest().upper() + ' "Apple Distribution: Fixture"').encode()
                elif args == ["security", "list-keychains", "-d", "user"]: output = b'"/fixture/login.keychain-db"'
                elif args[:2] == ["security", "create-keychain"]: Path(args[-1]).write_bytes(b"fixture keychain")
                return subprocess.CompletedProcess(args, 0, output, b"")
            with patch.dict(os.environ, env), patch.object(ios, "run", side_effect=fake), \
                 patch.object(ios, "decode_profile", return_value=profile), patch.object(ios, "profile_path", return_value=target), \
                 patch.object(ios.secrets, "token_urlsafe", return_value="ephemeral-fixture"):
                ios.install()
                self.assertTrue(target.exists())
                self.assertFalse((ios.signing_dir() / "approved.p12").exists())
                self.assertTrue(plistlib.loads((ios.signing_dir() / "ExportOptions.plist").read_bytes())["testFlightInternalTestingOnly"])
                ios.cleanup()
            self.assertFalse(target.exists())
            self.assertFalse(ios.signing_dir().exists())
            self.assertIn(["security", "list-keychains", "-d", "user", "-s", "/fixture/login.keychain-db"], calls)
            self.assertTrue(any(c[:2] == ["security", "delete-keychain"] for c in calls))

    def test_cleanup_without_install_does_not_run_native_tools(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, RUNNER_TEMP=folder), patch.object(ios, "run") as run:
            ios.cleanup()
        run.assert_not_called()

    def test_export_artifact_requires_readiness_gates(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(ios, "verify_archive") as verify:
            with self.assertRaises(ValueError): ios.verify_export()
        verify.assert_not_called()

    def test_verify_app_extracts_pinned_certificate_with_optional_argument_syntax(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {**self.env, "RUNNER_TEMP": folder}, clear=True):
            ios.signing_dir().mkdir()
            app = Path(folder) / "BharatCode.app"
            app.mkdir()
            (app / "Info.plist").write_bytes(plistlib.dumps({
                "CFBundleIdentifier": ios.IOS_ID, "CFBundleShortVersionString": ios.VERSION,
                "CFBundleVersion": "1", "CFBundleSupportedPlatforms": ["iPhoneOS"],
                "CFBundleExecutable": "BharatCode"}))
            (app / "main.jsbundle").write_bytes(b"fixture JS")
            profile = copy.deepcopy(self.profile)
            profile["CreationDate"] = datetime.now(timezone.utc) - timedelta(days=1)
            profile["ExpirationDate"] = datetime.now(timezone.utc) + timedelta(days=1)
            calls = []
            def fake(args, data=None):
                calls.append(args)
                output = b""
                if args[:2] == ["lipo", "-archs"]: output = b"arm64\n"
                elif args[:3] == ["codesign", "-d", "--entitlements"]:
                    output = plistlib.dumps(self.entitlements())
                elif args[:2] == ["codesign", "-d"]:
                    self.assertEqual(len(args), 4)
                    self.assertTrue(args[2].startswith("--extract-certificates="))
                    Path(args[2].split("=", 1)[1] + "0").write_bytes(self.cert)
                return subprocess.CompletedProcess(args, 0, output, b"")
            with patch.object(ios, "run", side_effect=fake), patch.object(ios, "decode_profile", return_value=profile):
                self.assertEqual(ios.verify_app(app, "fixture"), hashlib.sha256(b"fixture JS").hexdigest())
            self.assertIn(["codesign", "--verify", "--deep", "--strict", app], calls)

    def test_export_requires_native_map_and_same_js_before_artifact(self):
        for case in ("different-js", "missing-map", "blocked-package", "valid"):
            with self.subTest(case=case), tempfile.TemporaryDirectory() as folder:
                original = Path.cwd()
                try:
                    os.chdir(folder)
                    env = {**self.env, "RUNNER_TEMP": folder, "BC_SECURITY_AUDIT": "success",
                           "BC_EXPO_COMPATIBILITY": "success", "GITHUB_SHA": "a" * 40,
                           "GITHUB_RUN_ID": "fixture", "GITHUB_RUN_ATTEMPT": "1"}
                    with patch.dict(os.environ, env, clear=True):
                        ios.signing_dir().mkdir()
                        profile = copy.deepcopy(self.profile)
                        profile["CreationDate"] = datetime.now(timezone.utc) - timedelta(days=1)
                        profile["ExpirationDate"] = datetime.now(timezone.utc) + timedelta(days=1)
                        # plistlib writes UTC-naive dates on supported Python versions.
                        for key in ("CreationDate", "ExpirationDate"):
                            profile[key] = profile[key].replace(tzinfo=None)
                        (ios.signing_dir() / "profile.plist").write_bytes(plistlib.dumps(profile))
                        (ios.signing_dir() / "ExportOptions.plist").write_bytes(plistlib.dumps(ios.export_options(profile, env)))
                        Path("build/ios-export").mkdir(parents=True)
                        Path("build/ios-export/fixture.ipa").write_bytes(b"NOT A REAL IPA; fixture only")
                        if case != "missing-map":
                            Path("build/ios").mkdir()
                            paths = ["/src/app.ts", "/node_modules/react-native/index.js"] + [f"/safe/file{i}.js" for i in range(100)]
                            if case == "blocked-package": paths.append("/node_modules/picomatch/index.js")
                            Path("build/ios/main.jsbundle.map").write_text(json.dumps({"version": 3, "sources": paths}))
                        with patch.object(ios, "verify_archive", return_value="same-js"), \
                             patch.object(ios, "verify_app", return_value="different" if case == "different-js" else "same-js"), \
                             patch.object(ios, "one_app", return_value=Path("fixture.app")), patch.object(ios, "run"):
                            if case == "valid":
                                ios.verify_export()
                                report = json.loads(Path("build/internal-artifacts/ios/runtime-exclusion.json").read_text())
                                self.assertEqual(report["nativeBundleSha256"], "same-js")
                                self.assertEqual(report["matches"], [])
                                metadata = json.loads(Path("build/internal-artifacts/ios/build-metadata.json").read_text())
                                self.assertFalse(metadata["storeUploadPerformed"])
                                self.assertFalse(metadata["publicReleaseApproved"])
                            else:
                                with self.assertRaises((ValueError, FileNotFoundError)): ios.verify_export()
                                self.assertFalse(Path("build/internal-artifacts/ios/BharatCode-TESTFLIGHT-INTERNAL-CANDIDATE.ipa").exists())
                finally:
                    os.chdir(original)


if __name__ == "__main__":
    unittest.main()

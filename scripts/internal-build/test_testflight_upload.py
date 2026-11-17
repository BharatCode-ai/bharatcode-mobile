"""Upload-only fixtures: synthetic bundles, mocked Apple/GitHub calls; no credentials/network."""

import base64
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit
import zipfile

import testflight_upload as upload


class TestFlightUpload(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.folder = Path(temp.name)
        self.cert = b"SYNTHETIC PUBLIC CERTIFICATE"
        self.env = {"RUNNER_TEMP": str(self.folder), "GITHUB_REPOSITORY": upload.REPO,
                    "GITHUB_REF": "refs/heads/" + upload.BRANCH, "GITHUB_RUN_ATTEMPT": "1",
                    "BC_CONFIRM_INTERNAL_ONLY": "true", "BC_SOURCE_RUN_ID": "123", "BC_ARTIFACT_ID": "456",
                    "BC_SOURCE_SHA": "a" * 40, "IOS_DISTRIBUTION_CERT_SHA256": hashlib.sha256(self.cert).hexdigest(),
                    "ASC_APP_ID": upload.APP_ID, "ASC_KEY_ID": "TESTKEY001",
                    "ASC_ISSUER_ID": "00000000-1111-2222-3333-444444444444",
                    "ASC_API_KEY_P8_BASE64": base64.b64encode(
                        b"-----BEGIN PRIVATE KEY-----\nSENSITIVE-FIXTURE\n-----END PRIVATE KEY-----\n").decode()}
        clock = patch.object(upload, "datetime")
        clock.start().now.return_value = datetime(2026, 11, 18, tzinfo=timezone.utc)
        self.addCleanup(clock.stop)
        self.fixture = self.builder_fixture()
        self.env["BC_IPA_SHA256"] = upload.ios.sha256(self.fixture / upload.IPA)
        self.expected = upload.inputs(self.env)
        self.run = {"id": 123, "head_sha": "a" * 40, "status": "completed", "conclusion": "success",
                    "event": "workflow_dispatch", "head_branch": upload.BRANCH, "run_attempt": 2,
                    "path": ".github/workflows/internal-build.yml", "repository": {"full_name": upload.REPO},
                    "head_repository": {"full_name": upload.REPO}}
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as output:
            for name in upload.FILES: output.write(self.fixture / name, name)
        self.archive = archive.getvalue()
        self.artifact = {"id": 456, "name": "ios-TESTFLIGHT-INTERNAL-CANDIDATE-" + "a" * 40 + "-2",
                         "expired": False, "workflow_run": {"id": 123, "head_sha": "a" * 40},
                         "digest": "sha256:" + hashlib.sha256(self.archive).hexdigest()}

    def builder_fixture(self):
        """Use the real builder's verify-export writer, mocking ONLY native signatures/tools."""
        workspace = self.folder / "builder"
        workspace.mkdir()
        before = Path.cwd()
        os.chdir(workspace)
        try:
            env = {**self.env, "IOS_TEAM_ID": "TEAMTEST01", "IOS_APP_ID_PREFIX": "PREFIX0001",
                   "IOS_PROVISION_PROFILE_UUID": "00000000-1111-2222-3333-444444444444",
                   "BC_INTERNAL_BUILD_NUMBER": "1", "GITHUB_SHA": "a" * 40,
                   "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "2",
                   "BC_SECURITY_AUDIT": "success", "BC_EXPO_COMPATIBILITY": "success"}
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            profile = {"UUID": env["IOS_PROVISION_PROFILE_UUID"], "TeamIdentifier": [env["IOS_TEAM_ID"]],
                       "ApplicationIdentifierPrefix": [env["IOS_APP_ID_PREFIX"]], "Platform": ["iOS"],
                       "CreationDate": now - timedelta(days=1), "ExpirationDate": now + timedelta(days=1),
                       "DeveloperCertificates": [self.cert], "Entitlements": {
                           "application-identifier": env["IOS_APP_ID_PREFIX"] + "." + upload.ios.IOS_ID,
                           "com.apple.developer.team-identifier": env["IOS_TEAM_ID"],
                           "get-task-allow": False, "beta-reports-active": True}}
            info = {"CFBundleIdentifier": upload.ios.IOS_ID, "CFBundleShortVersionString": upload.ios.VERSION,
                    "CFBundleVersion": "1", "CFBundleSupportedPlatforms": ["iPhoneOS"]}
            bundle = b"SYNTHETIC NATIVE JS, NOT AN INSTALLABLE APP"
            Path("build/ios-export").mkdir(parents=True)
            with zipfile.ZipFile("build/ios-export/fixture.ipa", "w") as ipa:
                ipa.writestr("Payload/BharatCode.app/Info.plist", plistlib.dumps(info))
                ipa.writestr("Payload/BharatCode.app/main.jsbundle", bundle)
            Path("build/ios").mkdir()
            Path("build/ios/main.jsbundle.map").write_text(json.dumps({"version": 3, "sources":
                ["/src/app.ts", "/node_modules/react-native/index.js"] + [f"/safe/{i}.js" for i in range(100)]}))
            with patch.dict(os.environ, env, clear=True):
                signing = upload.ios.signing_dir()
                signing.mkdir()
                (signing / "profile.plist").write_bytes(plistlib.dumps(profile))
                (signing / "ExportOptions.plist").write_bytes(plistlib.dumps(upload.ios.export_options(profile, env)))
                digest = hashlib.sha256(bundle).hexdigest()
                with patch.object(upload.ios, "verify_archive", return_value=digest), \
                     patch.object(upload.ios, "verify_app", return_value=digest), patch.object(upload.ios, "run"), \
                     patch.object(upload.ios, "one_app", return_value=Path("fixture.app")):
                    upload.ios.verify_export()
            return workspace / "build/internal-artifacts/ios"
        finally:
            os.chdir(before)

    def test_inputs_and_source_provenance_fail_closed(self):
        upload.provenance(self.run, self.artifact, self.expected)
        for name, value in (("GITHUB_RUN_ATTEMPT", "2"), ("BC_CONFIRM_INTERNAL_ONLY", "false"),
                            ("BC_ARTIFACT_ID", "../456"), ("BC_SOURCE_SHA", "main"), ("GITHUB_REF", "refs/heads/main")):
            with self.subTest(name=name), self.assertRaises(ValueError): upload.inputs({**self.env, name: value})
        for field, value in (("head_sha", "b" * 40), ("conclusion", "failure"), ("path", ".github/workflows/other.yml"),
                             ("run_attempt", 1), ("head_repository", {"full_name": "other/repo"})):
            with self.subTest(field=field), self.assertRaises(ValueError):
                upload.provenance({**self.run, field: value}, self.artifact, self.expected)
        for field, value in (("id", 789), ("expired", True), ("digest", ""), ("workflow_run", {"id": 999})):
            with self.subTest(field=field), self.assertRaises(ValueError):
                upload.provenance(self.run, {**self.artifact, field: value}, self.expected)

    def test_exact_download_accepts_actual_builder_receipt_and_rejects_archive_tampering(self):
        for valid in (True, False):
            with self.subTest(valid=valid), patch.dict(os.environ, self.env, clear=True), redirect_stdout(io.StringIO()):
                folder = upload.root()
                if folder.exists(): shutil.rmtree(folder)
                responses = [subprocess.CompletedProcess([], 0, json.dumps(data).encode(), b"")
                             for data in (self.run, self.artifact)]
                def download(args, **kwargs):
                    self.assertEqual(args[-1], f"repos/{upload.REPO}/actions/artifacts/456/zip")
                    kwargs["stdout"].write(self.archive if valid else b"TAMPERED")
                    return subprocess.CompletedProcess(args, 0, None, b"")
                with patch.object(upload.ios, "run", side_effect=responses), \
                     patch.object(upload.subprocess, "run", side_effect=download):
                    if valid:
                        upload.verify()
                        receipt = json.loads((folder / "upload-receipt.json").read_text())
                        self.assertEqual(receipt["sourceRunAttempt"], 2)
                        self.assertEqual(receipt["buildNumber"], "1")
                        self.assertFalse(receipt["uploadAttempted"])
                    else:
                        with self.assertRaisesRegex(ValueError, "archive SHA-256"): upload.verify()
                        self.assertFalse((folder / "upload-receipt.json").exists())

    def test_candidate_rejects_wrong_hash_public_scope_and_native_receipt(self):
        metadata = upload.candidate(self.fixture, self.expected, 2, self.env)
        self.assertIs(metadata["storeUploadable"], False)  # Builder truth: Apple acceptance still unverified.
        with self.assertRaisesRegex(ValueError, "metadata"):
            upload.candidate(self.fixture, {**self.expected, "sha256": "b" * 64}, 2, self.env)
        for filename, field, value in (("build-metadata.json", "publicReleaseApproved", True),
                                       ("runtime-exclusion.json", "matches", ["/node_modules/picomatch/index.js"]),
                                       ("runtime-exclusion.json", "nativeBundleSha256", "b" * 64)):
            path = self.fixture / filename
            before = path.read_bytes()
            data = json.loads(before)
            data[field] = value
            try:
                path.write_text(json.dumps(data))
                with self.subTest(field=field), self.assertRaises(ValueError):
                    upload.candidate(self.fixture, self.expected, 2, self.env)
            finally:
                path.write_bytes(before)
        with (self.fixture / upload.IPA).open("ab") as output: output.write(b"TAMPERED")
        with self.assertRaisesRegex(ValueError, "IPA SHA-256"):
            upload.candidate(self.fixture, self.expected, 2, self.env)

    def test_jwt_uses_es256_raw_signature_and_short_lifetime(self):
        r, s = b"\x00\x80" + b"\x01" * 31, b"\x01" * 32
        body = b"\x02" + bytes([len(r)]) + r + b"\x02" + bytes([len(s)]) + s
        der = b"\x30" + bytes([len(body)]) + body
        result = subprocess.CompletedProcess([], 0, der, b"")
        with patch.object(upload.ios, "run", return_value=result) as run, patch.object(upload.time, "time", return_value=123456):
            token = upload.jwt_token(Path("fixture.p8"), "TESTKEY001", self.env["ASC_ISSUER_ID"])
        decode = lambda value: base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        header, payload, signature = map(decode, token.split("."))
        self.assertEqual(json.loads(header)["alg"], "ES256")
        self.assertEqual(json.loads(payload)["exp"] - json.loads(payload)["iat"], 120)
        self.assertEqual(signature, r[-32:] + s)
        self.assertEqual(run.call_args.args[0], ["openssl", "dgst", "-sha256", "-sign", Path("fixture.p8")])
        for bad in (b"", b"\x30\x06\x02\x01\x00\x02\x01\x01", der + b"extra"):
            with patch.object(upload.ios, "run", return_value=subprocess.CompletedProcess([], 0, bad, b"")), \
                 self.assertRaises(ValueError): upload.jwt_token(Path("fixture.p8"), "TESTKEY001", "issuer")

    def test_asc_reads_exact_app_and_build_number_and_never_follows_redirects(self):
        app = {"data": {"id": upload.APP_ID, "attributes": {"bundleId": upload.ios.IOS_ID}}}
        with patch.object(upload, "asc_get", side_effect=[app, {"data": []}]) as get:
            upload.asc_preflight("SENSITIVE-TOKEN", "1")
        query = parse_qs(urlsplit(get.call_args_list[1].args[0]).query)
        self.assertEqual(query, {"filter[app]": [upload.APP_ID], "filter[version]": ["1"], "limit": ["1"]})
        for response in ({"data": [{"id": "existing"}]}, {}, {"data": [], "links": {"next": "unexpected"}}):
            with patch.object(upload, "asc_get", side_effect=[app, response]), self.assertRaises(ValueError):
                upload.asc_preflight("SENSITIVE-TOKEN", "1")
        with patch.object(upload, "asc_get", return_value={"data": {"id": "wrong"}}), self.assertRaises(ValueError):
            upload.asc_preflight("SENSITIVE-TOKEN", "1")
        with patch.object(upload, "HTTPSConnection") as connection:
            connection.return_value.getresponse.return_value.status = 302
            with self.assertRaisesRegex(ValueError, "HTTP 302"):
                upload.asc_get("/v1/apps/" + upload.APP_ID, "SENSITIVE-TOKEN")
            connection.assert_called_once_with("api.appstoreconnect.apple.com", timeout=60)
            self.assertEqual(connection.return_value.request.call_args.args[0], "GET")
            connection.return_value.close.assert_called_once()

    def test_upload_once_or_not_at_all_and_cleanup_on_every_outcome(self):
        for outcome in ("success", "validation-failure", "duplicate", "upload-failure", "timeout"):
            with self.subTest(outcome=outcome), patch.dict(os.environ, self.env, clear=True):
                folder = upload.root()
                if folder.exists(): shutil.rmtree(folder)
                shutil.copytree(self.fixture, folder)
                receipt = {**self.expected, "sourceRunAttempt": 2, "buildNumber": "1", "results": [],
                           "uploadAttempted": False, "publicSubmissionPerformed": False}
                upload.receipt_write(receipt)
                commands = []
                def native(args, **kwargs):
                    commands.append(args)
                    key = folder / "private_keys/AuthKey_TESTKEY001.p8"
                    self.assertTrue(key.exists())
                    self.assertEqual(key.stat().st_mode & 0o777, 0o600)
                    self.assertNotIn("ASC_API_KEY_P8_BASE64", kwargs["env"])
                    if args[2] == "--upload-package" and outcome == "timeout":
                        raise subprocess.TimeoutExpired(args, 600, output=b"SENSITIVE-TOKEN")
                    failed = (args[2] == "--validate-app" and outcome == "validation-failure") or outcome == "upload-failure" and args[2] == "--upload-package"
                    response = {"delivery-uuid": self.env["ASC_ISSUER_ID"], "message": "SENSITIVE-RAW-OUTPUT",
                                "product-errors": [{"code": -12345, "message": "SENSITIVE-TOKEN"}] if failed else []}
                    return subprocess.CompletedProcess(args, int(failed), json.dumps(response).encode(), b"SENSITIVE-ERROR")
                api = Mock(side_effect=ValueError("duplicate fixture") if outcome == "duplicate" else None)
                output = io.StringIO()
                with patch.object(upload.sys, "platform", "darwin"), patch.object(upload, "jwt_token", return_value="SENSITIVE-TOKEN"), \
                     patch.object(upload, "asc_preflight", api), patch.object(upload.subprocess, "run", side_effect=native), \
                     redirect_stdout(output), redirect_stderr(output):
                    if outcome == "success": upload.upload()
                    else:
                        with self.assertRaises(ValueError): upload.upload()
                uploads = [args for args in commands if args[2] == "--upload-package"]
                self.assertEqual(len(uploads), 0 if outcome in ("validation-failure", "duplicate") else 1)
                if uploads:
                    self.assertNotIn("-f", uploads[0])
                    self.assertEqual(uploads[0][uploads[0].index("--apple-id") + 1], upload.APP_ID)
                self.assertFalse((folder / "private_keys").exists())
                saved = (folder / "upload-receipt.json").read_text()
                self.assertNotIn("SENSITIVE", saved + output.getvalue())
                self.assertEqual(json.loads(saved)["uploadAttempted"], bool(uploads))
                if outcome == "success": self.assertEqual(json.loads(saved)["status"], "uploaded-processing-unverified")
                if outcome == "timeout": self.assertIn("timed-out", json.loads(saved)["status"])

    def test_workflow_is_manual_upload_only_and_receipt_is_the_only_published_file(self):
        workflow = (Path(__file__).resolve().parents[2] / ".github/workflows/testflight-upload.yml").read_text()
        for required in ("workflow_dispatch:", "default: false", "cancel-in-progress: false", "environment: mobile-internal-ios",
                         "ASC_API_KEY_P8_BASE64", "ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_APP_ID", "actions: read", "if: always()"):
            self.assertIn(required, workflow)
        for forbidden in ("workflow_run:", "npm", "pod install", "-exportArchive", "-allowProvisioningUpdates", "IOS_DISTRIBUTION_P12", "APPLE_API_KEY"):
            self.assertNotIn(forbidden, workflow)
        self.assertEqual(workflow.count("ASC_API_KEY_P8_BASE64: ${{ secrets."), 1)
        self.assertIn("path: ${{ runner.temp }}/bharatcode-testflight-upload/upload-receipt.json", workflow)

    def test_registered_workflow_routes_upload_only_without_any_build_jobs(self):
        workflow = (Path(__file__).resolve().parents[2] / ".github/workflows/internal-build.yml").read_text()
        self.assertIn("options: [both, android, ios, testflight-upload]\n        default: both", workflow)
        self.assertIn("type: boolean\n        default: false", workflow)
        blocks = re.split(r"(?m)^  (?=[a-z][a-z-]*:\n)", workflow.split("\njobs:\n", 1)[1])[1:]
        jobs = {block.split(":", 1)[0]: block for block in blocks}
        self.assertEqual(set(jobs), {"source", "security", "compatibility", "android", "ios", "ios-signed", "testflight-upload"})
        needs = SimpleNamespace(**{name: SimpleNamespace(result="success") for name in ("source", "security", "compatibility")})
        # Evaluate the actual checked-in job conditions in the most permissive
        # dependency state (all gates successful, not cancelled), not a separate
        # routing implementation. Only the existing expression subset is used.
        for platform, signing, expected in (
            ("testflight-upload", "unsigned", {"testflight-upload"}),
            ("testflight-upload", "testflight", {"testflight-upload"}),
            ("both", "unsigned", {"source", "security", "compatibility", "android", "ios"}),
            ("android", "unsigned", {"source", "security", "compatibility", "android"}),
            ("ios", "unsigned", {"source", "security", "compatibility", "ios"}),
            ("ios", "testflight", {"source", "security", "compatibility", "ios-signed"}),
        ):
            inputs = SimpleNamespace(platform=platform, ios_signing=signing, android_signing="upload-key")
            enabled = set()
            for name, block in jobs.items():
                condition = re.search(r"(?m)^    if: (.+)$", block).group(1)
                if condition == ">-":
                    condition = re.search(r"(?m)^    if: >-\n((?:      .*\n)+)", block).group(1)
                condition = " ".join(condition.split()).replace("!cancelled()", "True").replace("always()", "True")
                condition = condition.replace("&&", " and ").replace("||", " or ")
                if eval(condition, {"__builtins__": {}}, {"inputs": inputs, "needs": needs}): enabled.add(name)
            with self.subTest(platform=platform, signing=signing): self.assertEqual(enabled, expected)
        call = jobs["testflight-upload"]
        self.assertIn("uses: ./.github/workflows/testflight-upload.yml", call)
        self.assertNotIn("needs:", call)
        self.assertEqual(call.split("    secrets:\n", 1)[1].split("    with:\n", 1)[0],
                         "      ASC_API_KEY_P8_BASE64: ${{ secrets.ASC_API_KEY_P8_BASE64 }}\n")
        self.assertIn("actions: read", call)
        called = (Path(__file__).resolve().parents[2] / ".github/workflows/testflight-upload.yml").read_text()
        declaration = called.split("  workflow_call:\n", 1)[1].split("    inputs:\n", 1)[0]
        self.assertEqual(declaration, "    secrets:\n      ASC_API_KEY_P8_BASE64:\n        required: true\n")
        self.assertNotIn("secrets: inherit", call + called)
        upload_job = called.split("\n  upload:\n", 1)[1]
        self.assertIn("environment: mobile-internal-ios", upload_job)
        self.assertEqual(upload_job.count("ASC_API_KEY_P8_BASE64: ${{ secrets.ASC_API_KEY_P8_BASE64 }}"), 1)
        for name in ("source_run_id", "source_sha", "artifact_id", "ipa_sha256", "confirm_internal_only"):
            self.assertIn(name + ": ${{ inputs." + name + " }}", call)


if __name__ == "__main__":
    unittest.main()

"""Upload one already-reviewed IPA. No builds, signing, retries or public submission."""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
from http.client import HTTPException, HTTPSConnection
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import sys
import time
from urllib.parse import urlencode
import zipfile

import ios_signing as ios
import security_gate

REPO = "BharatCode-ai/bharatcode-mobile"
BRANCH = "prep/internal-test-builds-20261118"
APP_ID = "6836039139"
IPA = "BharatCode-TESTFLIGHT-INTERNAL-CANDIDATE.ipa"
FILES = {IPA, "build-metadata.json", "runtime-exclusion.json", "SHA256SUMS", "READ-ME-FIRST.txt"}
require = ios.require


def root():
    parent = Path(os.environ["RUNNER_TEMP"])
    require(parent.is_absolute() and parent.is_dir(), "Missing runner temporary directory")
    return parent.resolve() / "bharatcode-testflight-upload"


def inputs(env):
    require(env.get("GITHUB_REPOSITORY") == REPO and env.get("GITHUB_REF") == "refs/heads/" + BRANCH,
            "Upload requires the reviewed repository/preparation branch")
    require(env.get("GITHUB_RUN_ATTEMPT") == "1", "Do not rerun an upload; check ASC before a new approved dispatch")
    require(env.get("BC_CONFIRM_INTERNAL_ONLY") == "true", "Explicit TestFlight-internal-only confirmation required")
    for name, pattern in (("BC_SOURCE_RUN_ID", r"[1-9][0-9]*"), ("BC_ARTIFACT_ID", r"[1-9][0-9]*"),
                          ("BC_SOURCE_SHA", r"[0-9a-f]{40}"), ("BC_IPA_SHA256", r"[0-9a-f]{64}")):
        require(re.fullmatch(pattern, env.get(name, "")), "Invalid upload input: " + name)
    return {"sourceRunId": env["BC_SOURCE_RUN_ID"], "sourceCommit": env["BC_SOURCE_SHA"],
            "artifactId": env["BC_ARTIFACT_ID"], "sha256": env["BC_IPA_SHA256"]}


def provenance(run, artifact, expected):
    require(str(run.get("id")) == expected["sourceRunId"] and run.get("head_sha") == expected["sourceCommit"]
            and run.get("status") == "completed" and run.get("conclusion") == "success"
            and run.get("event") == "workflow_dispatch" and run.get("head_branch") == BRANCH
            and run.get("path") == ".github/workflows/internal-build.yml"
            and run.get("repository", {}).get("full_name") == REPO
            and run.get("head_repository", {}).get("full_name") == REPO,
            "Source run is not the approved successful internal build")
    expected_name = f"ios-TESTFLIGHT-INTERNAL-CANDIDATE-{expected['sourceCommit']}-{run['run_attempt']}"
    require(str(artifact.get("id")) == expected["artifactId"] and artifact.get("name") == expected_name
            and artifact.get("expired") is False
            and str(artifact.get("workflow_run", {}).get("id")) == expected["sourceRunId"]
            and artifact.get("workflow_run", {}).get("head_sha") == expected["sourceCommit"]
            and re.fullmatch(r"sha256:[0-9a-f]{64}", artifact.get("digest", "")),
            "Artifact does not match the approved run/source or lacks an archive digest")


def candidate(folder, expected, attempt, env):
    metadata = json.loads((folder / "build-metadata.json").read_text())
    proof = json.loads((folder / "runtime-exclusion.json").read_text())
    fixed = {"sourceCommit": expected["sourceCommit"], "runId": expected["sourceRunId"],
             "runAttempt": str(attempt), "sha256": expected["sha256"], "platform": "ios",
             "configuration": "Release", "applicationId": ios.IOS_ID, "version": ios.VERSION,
             "artifact": IPA, "signing": "apple-distribution", "expoCompatibility": "success",
             "internalSecurityPolicy": security_gate.EXCEPTION, "exceptionExpires": security_gate.EXPIRES.isoformat(),
             "futureAllowedDestination": "TestFlight INTERNAL only",
             "certificateSha256": env["IOS_DISTRIBUTION_CERT_SHA256"].replace(":", "").lower()}
    require(all(metadata.get(k) == v for k, v in fixed.items())
            and metadata.get("publicReleaseApproved") is False and metadata.get("storeUploadPerformed") is False,
            "Candidate metadata does not match the reviewed internal-only build")
    require(datetime.now(timezone.utc).date() <= security_gate.EXPIRES, "Internal-test exception expired")
    require(proof.get("matches") == [] and proof.get("excludedPackages") == sorted(security_gate.BLOCKED)
            and proof.get("exceptionPolicy") == security_gate.EXCEPTION and proof.get("publicReleaseApproved") is False
            and proof.get("sourceCount", 0) >= 100
            and re.fullmatch(r"[0-9a-f]{64}", proof.get("sourceMapSha256", "")),
            "Missing actual-native runtime-exclusion receipt")
    require(ios.sha256(folder / IPA) == expected["sha256"]
            and (folder / "SHA256SUMS").read_text() == f"{expected['sha256']}  {IPA}\n",
            "Exact IPA SHA-256 mismatch")
    with zipfile.ZipFile(folder / IPA) as archive:
        info_paths = [n for n in archive.namelist() if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", n)]
        require(len(info_paths) == 1, "Expected one packaged app Info.plist")
        ios.validate_app_info(plistlib.loads(archive.read(info_paths[0])), metadata["buildNumber"])
        bundle = archive.read(info_paths[0].rsplit("/", 1)[0] + "/main.jsbundle")
        require(hashlib.sha256(bundle).hexdigest() == proof.get("nativeBundleSha256"),
                "IPA JS does not match the actual-native verification receipt")
    return metadata


def receipt_write(receipt):
    (root() / "upload-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")


def verify():
    ios.stage("upload/artifact-verification")
    expected = inputs(os.environ)
    folder = root()
    folder.mkdir(mode=0o700)
    endpoint = f"repos/{REPO}/actions/"
    run = json.loads(ios.run(["gh", "api", endpoint + "runs/" + expected["sourceRunId"]]).stdout)
    artifact = json.loads(ios.run(["gh", "api", endpoint + "artifacts/" + expected["artifactId"]]).stdout)
    provenance(run, artifact, expected)
    archive = folder / "artifact.zip"
    with archive.open("xb") as output:
        result = subprocess.run(["gh", "api", endpoint + "artifacts/" + expected["artifactId"] + "/zip"],
                                stdout=output, stderr=subprocess.PIPE, check=False)
    require(result.returncode == 0, "Artifact download failed; response suppressed")
    require("sha256:" + ios.sha256(archive) == artifact["digest"], "GitHub artifact archive SHA-256 mismatch")
    with zipfile.ZipFile(archive) as source:
        require(len(source.namelist()) == len(FILES) and set(source.namelist()) == FILES,
                "Unexpected artifact contents")
        for name in FILES:  # Fixed basenames; never extract arbitrary archive paths or links.
            with source.open(name) as src, (folder / name).open("xb") as dst:
                shutil.copyfileobj(src, dst)
    metadata = candidate(folder, expected, run["run_attempt"], os.environ)
    receipt_write({**expected, "sourceRunAttempt": run["run_attempt"], "artifactDigest": artifact["digest"],
                   "appId": APP_ID, "bundleId": ios.IOS_ID, "version": ios.VERSION,
                   "buildNumber": metadata["buildNumber"], "status": "verified-not-uploaded",
                   "uploadAttempted": False, "publicSubmissionPerformed": False, "results": []})
    print("Exact signed IPA and native-runtime receipt verified; no upload yet.")


def jwt_token(key_path, key_id, issuer):
    encode = lambda value: base64.urlsafe_b64encode(value).rstrip(b"=")
    now = int(time.time())
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    payload = {"iss": issuer, "iat": now, "exp": now + 120, "aud": "appstoreconnect-v1"}
    signing = b".".join(encode(json.dumps(v, separators=(",", ":")).encode()) for v in (header, payload))
    der = ios.run(["openssl", "dgst", "-sha256", "-sign", key_path], signing).stdout
    # OpenSSL emits a short DER sequence of two P-256 integers; JOSE needs R || S.
    require(8 <= len(der) <= 72 and der[:1] == b"\x30" and der[1] == len(der) - 2,
            "Unexpected ES256 signature encoding")
    raw, offset = b"", 2
    for _ in range(2):
        require(offset + 2 <= len(der) and der[offset] == 2, "Invalid ES256 signature integer")
        size = der[offset + 1]
        value = der[offset + 2:offset + 2 + size]
        require(1 <= size <= 33 and len(value) == size and value[0] < 128
                and 0 < int.from_bytes(value, "big") < 2 ** 256, "Invalid ES256 signature size")
        raw += int.from_bytes(value, "big").to_bytes(32, "big")
        offset += 2 + size
    require(offset == len(der), "Unexpected trailing ES256 signature data")
    return (signing + b"." + encode(raw)).decode()


def asc_get(path, token):
    # Fixed HTTPS host, GET only, no redirects/retries or credentials in argv/logs.
    connection = HTTPSConnection("api.appstoreconnect.apple.com", timeout=60)
    try:
        connection.request("GET", path, headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
        response = connection.getresponse()
        require(response.status == 200, f"ASC read-only preflight failed (HTTP {response.status}); response suppressed")
        return json.loads(response.read())
    finally:
        connection.close()


def asc_preflight(token, build_number):
    app = asc_get("/v1/apps/" + APP_ID, token).get("data", {})
    require(app.get("id") == APP_ID and app.get("attributes", {}).get("bundleId") == ios.IOS_ID,
            "ASC app identity mismatch")
    query = urlencode({"filter[app]": APP_ID, "filter[version]": build_number, "limit": "1"})
    builds = asc_get("/v1/builds?" + query, token)
    require(builds.get("data") == [] and not builds.get("links", {}).get("next"),
            "Build number already exists or absence is unconfirmed; do not upload again")


def altool(arguments, auth, env, receipt, phase):
    ios.stage("upload/" + phase)
    receipt["status"] = phase + "-started"
    if phase == "upload": receipt["uploadAttempted"] = True
    receipt_write(receipt)  # An interrupted upload must never look safe to retry.
    try:
        result = subprocess.run(["xcrun", "altool", *arguments, *auth, "--output-format", "json"],
                                env=env, cwd=root(), capture_output=True,
                                timeout=300 if phase == "validate" else 600, check=False)
    except subprocess.TimeoutExpired:
        receipt["status"] = phase + "-timed-out-check-ASC-before-any-retry"
        receipt_write(receipt)
        raise ios.PolicyError("Apple tool timed out; no retry. Check ASC before another approved dispatch") from None
    safe = {"phase": phase, "exitCode": result.returncode}
    try:
        data = json.loads(result.stdout)
        for field in ("delivery-uuid", "request-uuid"):
            if re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", str(data.get(field, ""))):
                safe[field] = data[field]
        safe["appleErrorCodes"] = [str(e["code"]) for e in data.get("product-errors", [])
                                  if isinstance(e, dict) and re.fullmatch(r"-?[0-9]+", str(e.get("code", "")))]
    except (ValueError, TypeError, AttributeError):
        pass  # Never print arbitrary Apple output, JWTs or credential data.
    receipt["results"].append(safe)
    receipt["status"] = ("uploaded-processing-unverified" if phase == "upload" else "validated-not-uploaded") \
        if result.returncode == 0 else phase + "-failed-check-ASC-before-any-retry"
    receipt_write(receipt)
    print(json.dumps(safe))
    require(result.returncode == 0, "Apple tool failed; see sanitized receipt. No automatic retry")


def cleanup():
    key_dir = root() / "private_keys"
    if key_dir.exists():
        require(not key_dir.is_symlink(), "Unexpected temporary key directory link")
        shutil.rmtree(key_dir)


def upload():
    ios.stage("upload/credentials")
    expected = inputs(os.environ)
    require(sys.platform == "darwin", "Upload requires hosted macOS")
    require(os.environ.get("ASC_APP_ID") == APP_ID, "Unexpected ASC_APP_ID")
    key_id, issuer = os.environ.get("ASC_KEY_ID", ""), os.environ.get("ASC_ISSUER_ID", "")
    require(re.fullmatch(r"[A-Z0-9]{10}", key_id) and
            re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", issuer), "Invalid ASC key identifiers")
    receipt = json.loads((root() / "upload-receipt.json").read_text())
    require(all(receipt.get(k) == v for k, v in expected.items()) and receipt.get("uploadAttempted") is False,
            "Missing verified receipt or upload already attempted")
    candidate(root(), expected, receipt["sourceRunAttempt"], os.environ)
    key = base64.b64decode(os.environ.pop("ASC_API_KEY_P8_BASE64"), validate=True)
    require(key.startswith(b"-----BEGIN PRIVATE KEY-----") and key.rstrip().endswith(b"-----END PRIVATE KEY-----"),
            "Invalid ASC private-key format")
    key_dir = root() / "private_keys"
    key_dir.mkdir(mode=0o700)
    try:
        key_path = key_dir / ("AuthKey_" + key_id + ".p8")
        ios.private_file(key_path, key)
        child_env = {**os.environ, "API_PRIVATE_KEYS_DIR": str(key_dir)}
        auth = ["--apiKey", key_id, "--apiIssuer", issuer]
        ipa = str(root() / IPA)
        altool(["--validate-app", "-f", ipa, "-t", "ios"], auth, child_env, receipt, "validate")
        ios.stage("upload/ASC-app-and-unused-build")
        asc_preflight(jwt_token(key_path, key_id, issuer), receipt["buildNumber"])
        receipt["ascPreflight"] = "exact-app-and-build-number-absent"
        require(ios.sha256(root() / IPA) == expected["sha256"], "IPA changed before upload")
        # One invocation only. No build, re-export, resigning, review submission or retry.
        altool(["--upload-package", ipa, "-t", "ios", "--apple-id", APP_ID, "--bundle-id", ios.IOS_ID,
                "--bundle-short-version-string", ios.VERSION, "--bundle-version", receipt["buildNumber"]],
               auth, child_env, receipt, "upload")
    except Exception:
        receipt["failedStage"] = ios.CURRENT_STAGE
        receipt_write(receipt)
        raise
    finally:
        cleanup()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("verify", "upload", "cleanup"))
    command = parser.parse_args().command
    try:
        {"verify": verify, "upload": upload, "cleanup": cleanup}[command]()
    except ios.PolicyError as error:
        print(f"TestFlight step failed [{ios.CURRENT_STAGE}]: {error}", file=sys.stderr)
        return 1
    except (ValueError, KeyError, TypeError, AttributeError, OSError, HTTPException, zipfile.BadZipFile):
        print(f"TestFlight input/tool failure [{ios.CURRENT_STAGE}]; private details suppressed; no retry.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Dependency-free build guards; no signing, key creation, or store access."""

import base64
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import sys
import tarfile
import xml.etree.ElementTree as ET
import zipfile

ANDROID_ID = "ai.bharatcode.bharatcode_mobile"
IOS_ID = "ai.bharatcode.bharatcodeMobile"
VERSION = "0.2.0"
ANDROID_NS = "{http://schemas.android.com/apk/res/android}"
SIGNING_SECRETS = (
    "ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD",
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def build_number():
    value = os.environ.get("BC_INTERNAL_BUILD_NUMBER", "")
    require(re.fullmatch(r"[1-9][0-9]{0,3}", value), "Build number must be 1-9999")
    return value


def validate_config(config):
    require(config["android"]["package"] == ANDROID_ID, "Android package changed")
    require(config["ios"]["bundleIdentifier"] == IOS_ID, "iOS bundle ID changed")
    require(config["version"] == VERSION, "App version changed; review required")
    require(str(config["android"]["versionCode"]) == build_number(), "Wrong versionCode")
    require(config["ios"]["buildNumber"] == build_number(), "Wrong iOS buildNumber")
    require(os.environ.get("EXPO_PUBLIC_BC_PREVIEW") != "1", "Preview mode forbidden")


def signing_mode():
    mode = os.environ.get("BC_ANDROID_SIGNING", "unsigned")
    require(mode in ("unsigned", "upload-key"), "Unknown Android signing mode")
    return mode


def expected_fingerprint():
    value = os.environ.get("ANDROID_UPLOAD_CERT_SHA256", "").replace(":", "").lower()
    require(re.fullmatch(r"[0-9a-f]{64}", value), "Set ANDROID_UPLOAD_CERT_SHA256 to the approved certificate fingerprint")
    return value


def signing_prerequisites():
    missing = [name for name in SIGNING_SECRETS if not os.environ.get(name)]
    require(not missing, "Missing signing secrets: " + ", ".join(missing))
    require(os.environ["ANDROID_KEY_ALIAS"].lower() != "androiddebugkey", "Debug key alias forbidden")
    expected_fingerprint()


def key_path():
    return Path(os.environ["RUNNER_TEMP"]) / "bharatcode-upload.keystore"


def install_key():
    if signing_mode() == "unsigned":
        return
    signing_prerequisites()
    path = key_path()
    with path.open("xb") as file:
        os.chmod(path, 0o600)
        file.write(base64.b64decode(os.environ["ANDROID_KEYSTORE_BASE64"], validate=True))
    result = subprocess.run([
        "keytool", "-exportcert", "-keystore", str(path),
        "-storepass:env", "ANDROID_KEYSTORE_PASSWORD",
        "-alias", os.environ["ANDROID_KEY_ALIAS"],
    ], capture_output=True, check=False)
    require(result.returncode == 0, "Cannot read supplied upload certificate (details suppressed)")
    require(hashlib.sha256(result.stdout).hexdigest() == expected_fingerprint(), "Upload certificate fingerprint mismatch")
    description = subprocess.run(["keytool", "-printcert"], input=result.stdout, capture_output=True, check=False)
    require(description.returncode == 0, "Cannot inspect upload certificate")
    require(b"CN=Android Debug" not in description.stdout, "Android debug certificate forbidden")


def release_gradle(source, mode):
    require(f'applicationId "{ANDROID_ID}"' in source, "Unexpected Android applicationId")
    require(mode in ("unsigned", "upload-key"), "Unknown Android signing mode")
    require("BC_INTERNAL_BUILD" not in source, "Signing guard already installed")
    require("signingConfig signingConfigs.debug" in source, "Review changed Expo signing template")
    # Override *after* Expo's entire generated android block. Never inherit its
    # debug keystore for Release. A separate Gradle task verifies effective DSL.
    policy = """
// BC_INTERNAL_BUILD: explicit signing only; this workflow never uploads.
android {
    signingConfigs {
        internalUpload {
            storeFile file(System.getenv("RUNNER_TEMP") + "/bharatcode-upload.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig SIGNING_CONFIG
            debuggable false
        }
    }
}
tasks.register("verifyInternalRelease") {
    doLast {
        def config = android.buildTypes.release.signingConfig
        if (INVALID_SIGNING || android.buildTypes.release.debuggable) {
            throw new GradleException("Unexpected Release signing or debug mode")
        }
    }
}
"""
    if mode == "unsigned":
        policy = policy.replace("SIGNING_CONFIG", "null").replace("INVALID_SIGNING", "config != null")
    else:
        policy = policy.replace("SIGNING_CONFIG", "signingConfigs.internalUpload").replace(
            "INVALID_SIGNING", 'config == null || config.name != "internalUpload" || config.keyAlias == "androiddebugkey"')
    return source + policy


def validate_android_manifest(manifest):
    root = ET.fromstring(manifest)
    require(root.attrib.get("package") == ANDROID_ID, "Packaged Android ID changed")
    require(root.attrib.get(ANDROID_NS + "versionName") == VERSION, "Wrong Android version")
    require(root.attrib.get(ANDROID_NS + "versionCode") == build_number(), "Wrong Android build number")
    app = root.find("application")
    require(app is not None, "Missing Android application")
    require(app.attrib.get(ANDROID_NS + "debuggable", "false") == "false", "Debuggable Android build")
    require(app.attrib.get(ANDROID_NS + "testOnly", "false") == "false", "Test-only Android build")


def validate_aab(path, mode="unsigned"):
    require(mode in ("unsigned", "upload-key"), "Unknown Android signing mode")
    with zipfile.ZipFile(path) as bundle:
        entries = bundle.namelist()
        require("BundleConfig.pb" in entries, "Not an Android App Bundle")
        require("base/manifest/AndroidManifest.xml" in entries, "Missing AAB manifest")
        require(bundle.getinfo("base/assets/index.android.bundle").file_size > 0, "Missing embedded JS")
        require(any(p.startswith("base/lib/arm64-v8a/") for p in entries), "Missing arm64 native libraries")
        signatures = [p for p in entries if re.match(r"META-INF/[^/]+\.(RSA|DSA|EC)$", p, re.I)]
        if mode == "unsigned":
            require(not signatures, "Unexpected signed AAB: do not publish a debug-signed artifact")
        else:
            require(len(signatures) == 1, "Expected exactly one upload-key signature")
    if mode == "upload-key":
        result = subprocess.run(["jarsigner", "-verify", str(path)], capture_output=True, check=False)
        require(result.returncode == 0 and b"jar verified." in result.stdout, "AAB signature verification failed")
        certificate = subprocess.run(["keytool", "-printcert", "-jarfile", str(path), "-rfc"], capture_output=True, check=False)
        require(certificate.returncode == 0, "Cannot read AAB signing certificate")
        pem = re.search(rb"-----BEGIN CERTIFICATE-----\s*([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----", certificate.stdout)
        require(pem is not None, "Missing AAB signing certificate")
        require(hashlib.sha256(base64.b64decode(pem[1])).hexdigest() == expected_fingerprint(), "AAB signed with wrong certificate")


def validate_ios_app(app):
    with (app / "Info.plist").open("rb") as file:
        info = plistlib.load(file)
    require(info["CFBundleIdentifier"] == IOS_ID, "Archived iOS bundle ID changed")
    require(info["CFBundleShortVersionString"] == VERSION, "Wrong iOS version")
    require(info["CFBundleVersion"] == build_number(), "Wrong archived iOS build number")
    require(info["CFBundleSupportedPlatforms"] == ["iPhoneOS"], "Not an iPhoneOS archive")
    require((app / info["CFBundleExecutable"]).is_file(), "Missing iOS executable")
    require((app / "main.jsbundle").stat().st_size > 0, "Missing embedded iOS JS")
    require(not (app / "embedded.mobileprovision").exists(), "Unexpected provisioning profile")
    require(not (app / "_CodeSignature").exists(), "Unexpected signed iOS app")


def record(platform, artifact):
    hasher = hashlib.sha256()
    with artifact.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    signed = platform == "android" and signing_mode() == "upload-key"
    metadata = {
        "sourceCommit": os.environ["GITHUB_SHA"],
        "runId": os.environ["GITHUB_RUN_ID"],
        "runAttempt": os.environ["GITHUB_RUN_ATTEMPT"],
        "platform": platform,
        "configuration": "Release",
        "applicationId": ANDROID_ID if platform == "android" else IOS_ID,
        "version": VERSION,
        "buildNumber": build_number(),
        "artifact": artifact.name,
        "sha256": digest,
        "signing": "upload-key" if signed else "UNSIGNED",
        "certificateSha256": expected_fingerprint() if signed else None,
        "storeUploadable": False,
        "storeUploadableReason": "Store account/listing/key registration and final acceptance not verified" if signed else "Unsigned artifact",
        "nativeAcceptanceTested": False,
        "storeUploadPerformed": False,
        "futureAllowedDestination": "Play INTERNAL only" if platform == "android" else "TestFlight only",
    }
    (artifact.parent / "build-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (artifact.parent / "SHA256SUMS").write_text(f"{digest}  {artifact.name}\n")
    note = ("UPLOAD-KEY SIGNED — PLAY INTERNAL CANDIDATE ONLY\n" if signed else
            "UNSIGNED — NOT UPLOADABLE — NOT INSTALLABLE AS A STORE BUILD\n")
    note += (
        "Native Release build. No debug signing fallback; no keys created.\n"
        "No store upload occurred. Store account/listing/key registration, build\n"
        "number, and exact final artifact acceptance need separate verification.\n"
        "Never public release. iOS is TestFlight only; Android is Play INTERNAL only.\n"
    )
    (artifact.parent / "READ-ME-FIRST.txt").write_text(note)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as summary:
            summary.write(f"### {platform}: {metadata['signing']} Release; NO UPLOAD\n\n{note}\n\n")
            summary.write(f"Source: `{metadata['sourceCommit']}`\n\nSHA-256: `{digest}`\n")


def main():
    command = sys.argv[1]
    build_number()
    if command == "signing-prerequisites":
        signing_prerequisites()
    elif command == "install-key":
        install_key()
    elif command == "remove-key":
        key_path().unlink(missing_ok=True)
    elif command == "config":
        validate_config(json.loads(Path(sys.argv[2]).read_text()))
    elif command == "prepare-android":
        path = Path("android/app/build.gradle")
        path.write_text(release_gradle(path.read_text(), signing_mode()))
    elif command == "android":
        manifests = list(Path("android/app/build/intermediates/merged_manifests/release").glob("*/AndroidManifest.xml"))
        require(len(manifests) == 1, "Expected exactly one merged Release manifest")
        validate_android_manifest(manifests[0].read_text())
        source = Path("android/app/build/outputs/bundle/release/app-release.aab")
        validate_aab(source, signing_mode())
        label = "UPLOAD-KEY-PLAY-INTERNAL-CANDIDATE" if signing_mode() == "upload-key" else "UNSIGNED-NOT-UPLOADABLE"
        output = Path(f"build/internal-artifacts/android/BharatCode-{label}.aab")
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, output)
        record(command, output)
    elif command == "ios":
        archive = Path("build/BharatCode-UNSIGNED.xcarchive")
        apps = list((archive / "Products/Applications").glob("*.app"))
        require(len(apps) == 1, "Expected exactly one archived app")
        validate_ios_app(apps[0])
        output = Path("build/internal-artifacts/ios/BharatCode-UNSIGNED-NOT-UPLOADABLE.xcarchive.tar.gz")
        output.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(output, "w:gz") as tar:
            tar.add(archive, arcname=archive.name)
        record(command, output)
    else:
        raise ValueError("Unknown validation command")


if __name__ == "__main__":
    main()

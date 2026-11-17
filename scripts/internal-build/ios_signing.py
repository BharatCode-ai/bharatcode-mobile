"""TestFlight-internal build helpers. Import approved assets; never create or upload them."""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile

import security_gate

IOS_ID = "ai.bharatcode.bharatcodeMobile"
VERSION = "0.2.0"
SECRETS = (
    "IOS_DISTRIBUTION_P12_BASE64",
    "IOS_DISTRIBUTION_P12_PASSWORD",
    "IOS_PROVISION_PROFILE_BASE64",
)
ENTITLEMENTS = {
    "application-identifier", "com.apple.developer.team-identifier",
    "get-task-allow", "beta-reports-active", "keychain-access-groups",
}
CURRENT_STAGE = "startup"


class PolicyError(ValueError):
    """Only audited policy messages, never input values or native tool output."""


def stage(label):
    # Callers supply fixed labels (or argparse's fixed command choices), not inputs.
    global CURRENT_STAGE
    CURRENT_STAGE = label
    print("iOS stage: " + label, flush=True)


def require(condition, message):
    if not condition:
        raise PolicyError(message)


def identifiers(env):
    result = {}
    for name in ("IOS_TEAM_ID", "IOS_APP_ID_PREFIX"):
        value = env.get(name, "")
        require(re.fullmatch(r"[A-Z0-9]{10}", value), "Missing/invalid " + name)
        result[name] = value
    value = env.get("IOS_PROVISION_PROFILE_UUID", "")
    require(re.fullmatch(r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}", value),
            "Missing/invalid IOS_PROVISION_PROFILE_UUID")
    result["IOS_PROVISION_PROFILE_UUID"] = value.upper()
    value = env.get("IOS_DISTRIBUTION_CERT_SHA256", "").replace(":", "").lower()
    require(re.fullmatch(r"[0-9a-f]{64}", value), "Missing/invalid IOS_DISTRIBUTION_CERT_SHA256")
    result["IOS_DISTRIBUTION_CERT_SHA256"] = value
    return result


def prerequisites(env):
    missing = [name for name in SECRETS if not env.get(name)]
    require(not missing, "Missing iOS secrets: " + ", ".join(missing))
    identifiers(env)
    require(re.fullmatch(r"[1-9][0-9]{0,3}", env.get("BC_INTERNAL_BUILD_NUMBER", "")),
            "Build number must be an explicitly confirmed unused value, 1-9999")


def utc(value):
    require(isinstance(value, datetime), "Missing/invalid profile date")
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def validate_profile(profile, env, now=None):
    ids = identifiers(env)
    require(isinstance(profile, dict), "Invalid provisioning profile")
    require(str(profile.get("UUID", "")).upper() == ids["IOS_PROVISION_PROFILE_UUID"],
            "Unexpected provisioning profile UUID")
    require(profile.get("TeamIdentifier") == [ids["IOS_TEAM_ID"]], "Profile team mismatch")
    # A legacy App ID prefix can differ from the team. Never derive one from the other.
    require(profile.get("ApplicationIdentifierPrefix") == [ids["IOS_APP_ID_PREFIX"]],
            "Profile App ID prefix mismatch")
    require(isinstance(profile.get("Platform"), list) and "iOS" in profile["Platform"],
            "Not an iOS provisioning profile")
    require("ProvisionedDevices" not in profile and "ProvisionsAllDevices" not in profile,
            "Development/ad-hoc/enterprise profile is not permitted")
    instant = utc(now or datetime.now(timezone.utc))
    require(utc(profile.get("CreationDate")) <= instant < utc(profile.get("ExpirationDate")),
            "Profile is expired or not yet valid")
    ent = profile.get("Entitlements")
    require(isinstance(ent, dict), "Missing profile entitlements")
    app_id = ids["IOS_APP_ID_PREFIX"] + "." + IOS_ID
    require(ent.get("application-identifier") == app_id, "Profile requires the exact explicit App ID")
    require(ent.get("com.apple.developer.team-identifier") == ids["IOS_TEAM_ID"],
            "Profile entitlement team mismatch")
    require(ent.get("get-task-allow") is False, "Debug signing is forbidden")
    require(ent.get("beta-reports-active") is True, "Profile is not enabled for TestFlight")
    certs = profile.get("DeveloperCertificates")
    require(isinstance(certs, list) and len(certs) == 1 and isinstance(certs[0], bytes) and certs[0],
            "Expected one distribution certificate in the profile")
    require(hashlib.sha256(certs[0]).hexdigest() == ids["IOS_DISTRIBUTION_CERT_SHA256"],
            "Profile certificate fingerprint mismatch")
    return certs[0]


def validate_entitlements(ent, profile, env, now=None):
    validate_profile(profile, env, now)
    require(isinstance(ent, dict) and not (set(ent) - ENTITLEMENTS),
            "Unexpected signed capability; review required")
    for name in ENTITLEMENTS - {"keychain-access-groups"}:
        require(name in ent and type(ent[name]) is type(profile["Entitlements"][name])
                and ent[name] == profile["Entitlements"][name], "Signed entitlement mismatch: " + name)
    if "keychain-access-groups" in ent:
        app_id = profile["Entitlements"]["application-identifier"]
        require(ent["keychain-access-groups"] == [app_id], "Unreviewed shared keychain group")
        permitted = profile["Entitlements"].get("keychain-access-groups", [])
        require(isinstance(permitted, list) and
                (app_id in permitted or env["IOS_APP_ID_PREFIX"] + ".*" in permitted),
                "Keychain group not allowed by the approved profile")


def validate_app_info(info, build_number):
    require(isinstance(build_number, str) and re.fullmatch(r"[1-9][0-9]{0,3}", build_number),
            "Invalid iOS build number")
    require(isinstance(info, dict), "Invalid app Info.plist")
    require(info.get("CFBundleIdentifier") == IOS_ID, "Packaged iOS bundle ID changed")
    require(info.get("CFBundleShortVersionString") == VERSION, "Packaged iOS version changed")
    require(info.get("CFBundleVersion") == build_number, "Packaged iOS build number changed")
    require(info.get("CFBundleSupportedPlatforms") == ["iPhoneOS"], "Not an iPhoneOS app")


def export_options(profile, env, now=None):
    certificate = validate_profile(profile, env, now)
    ids = identifiers(env)
    return {
        "method": "app-store-connect",
        "destination": "export",
        "signingStyle": "manual",
        "teamID": ids["IOS_TEAM_ID"],
        # Xcode uses SHA-1 to select an identity; SHA-256 above authenticates our pin.
        "signingCertificate": hashlib.sha1(certificate).hexdigest().upper(),
        "provisioningProfiles": {IOS_ID: ids["IOS_PROVISION_PROFILE_UUID"]},
        "manageAppVersionAndBuildNumber": False,
        "testFlightInternalTestingOnly": True,
        "uploadSymbols": False,
    }


def run(args, data=None):
    result = subprocess.run([str(arg) for arg in args], input=data, capture_output=True, check=False)
    require(result.returncode == 0,
            f"Native tool failed (exit {result.returncode}; output and arguments suppressed)")
    return result


def private_file(path, data):
    with path.open("xb") as output:
        os.chmod(path, 0o600)
        output.write(data)


def signing_dir():
    root = Path(os.environ["RUNNER_TEMP"])
    require(root.is_absolute() and root.is_dir(), "Missing runner temporary directory")
    return root.resolve() / "bharatcode-ios-signing"


def profile_path():
    uuid = identifiers(os.environ)["IOS_PROVISION_PROFILE_UUID"]
    return Path.home() / "Library/Developer/Xcode/UserData/Provisioning Profiles" / (uuid + ".mobileprovision")


def decode_profile(path):
    return plistlib.loads(run(["security", "cms", "-D", "-i", path]).stdout)


def install():
    stage("install/prerequisites")
    prerequisites(os.environ)
    stage("install/xcode-help")
    help_result = run(["xcodebuild", "-help"])
    help_text = (help_result.stdout + help_result.stderr).decode(errors="replace")
    stage("install/xcode-export-options")
    require(all(key in help_text for key in ("testFlightInternalTestingOnly", "app-store-connect",
                                             "manageAppVersionAndBuildNumber")),
            "Selected Xcode lacks required internal-only export options")
    stage("install/xcode-version")
    require(run(["xcodebuild", "-version"]).stdout.startswith(b"Xcode 26.6\n"), "Unexpected Xcode version")
    stage("install/temporary-directory")
    root = signing_dir()
    root.mkdir(mode=0o700)  # Never reuse another run's keys or state.
    profile_file = root / "approved.mobileprovision"
    p12 = root / "approved.p12"
    stage("install/profile-base64")
    private_file(profile_file, base64.b64decode(os.environ[SECRETS[2]], validate=True))
    stage("install/p12-base64")
    private_file(p12, base64.b64decode(os.environ[SECRETS[0]], validate=True))
    stage("install/profile-cms-decode")
    profile = decode_profile(profile_file)
    stage("install/profile-policy")
    certificate = validate_profile(profile, os.environ)
    stage("install/profile-certificate-files")
    private_file(root / "profile.plist", plistlib.dumps(profile))
    private_file(root / "certificate.der", certificate)
    stage("install/certificate-trust")
    run(["security", "verify-cert", "-c", root / "certificate.der", "-p", "codeSign"])
    stage("install/export-policy")
    options = export_options(profile, os.environ)
    private_file(root / "ExportOptions.plist", plistlib.dumps(options))
    keychain = root / "signing.keychain-db"
    stage("install/keychain-search-backup")
    old_search = shlex.split(run(["security", "list-keychains", "-d", "user"]).stdout.decode())
    private_file(root / "keychain-search.json", json.dumps(old_search).encode())
    password = secrets.token_urlsafe(32)  # Ephemeral keychain password, not a signing key.
    stage("install/keychain-create")
    run(["security", "create-keychain", "-p", password, keychain])
    stage("install/keychain-settings")
    run(["security", "set-keychain-settings", "-lut", "7200", keychain])
    stage("install/keychain-unlock")
    run(["security", "unlock-keychain", "-p", password, keychain])
    stage("install/p12-import")
    run(["security", "import", p12, "-k", keychain, "-P", os.environ[SECRETS[1]],
         "-T", "/usr/bin/codesign", "-T", "/usr/bin/security"])
    stage("install/key-partition-list")
    run(["security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", password, keychain])
    stage("install/distribution-identity")
    identities = run(["security", "find-identity", "-v", "-p", "codesigning", keychain]).stdout.decode()
    expected = options["signingCertificate"]
    require(re.search(r'\b' + expected + r'\s+"(?:Apple Distribution|iPhone Distribution):', identities),
            "Approved valid distribution identity/private key missing")
    stage("install/keychain-search-update")
    run(["security", "list-keychains", "-d", "user", "-s", keychain, *old_search])
    stage("install/profile-install")
    target = profile_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    private_file(target, profile_file.read_bytes())  # Refuse to overwrite any existing profile.
    private_file(root / "profile-installed", b"yes")
    stage("install/p12-remove")
    p12.unlink()  # Private key now exists only inside the temporary keychain.


def cleanup():
    root = signing_dir()
    if not root.exists():
        return
    require(not root.is_symlink(), "Unexpected signing directory link")
    errors = []
    search = root / "keychain-search.json"
    if search.exists():
        try:
            old = json.loads(search.read_text())
            require(isinstance(old, list) and all(isinstance(p, str) and Path(p).is_absolute() for p in old),
                    "Invalid saved keychain search list")
            run(["security", "list-keychains", "-d", "user", "-s", *old])
        except (ValueError, OSError):
            errors.append("restore keychain search list")
    keychain = root / "signing.keychain-db"
    if keychain.exists():
        try:
            run(["security", "delete-keychain", keychain])
        except ValueError:
            errors.append("delete temporary keychain")
    if (root / "profile-installed").exists():
        try:
            target = profile_path()
            require(target.read_bytes() == (root / "approved.mobileprovision").read_bytes(),
                    "Installed profile changed; refusing to delete it")
            target.unlink()
        except (ValueError, OSError):
            errors.append("remove installed profile (unexpected contents preserved)")
    shutil.rmtree(root)  # Only the dedicated child of validated RUNNER_TEMP.
    require(not errors, "Signing cleanup failed: " + ", ".join(errors))


def project_settings(objects, env, certificate_sha1):
    unquote = lambda value: str(value).strip('"')
    targets = [v for v in objects.get("PBXNativeTarget", {}).values() if isinstance(v, dict)]
    require(len(targets) == 1 and unquote(targets[0].get("productType")) == "com.apple.product-type.application"
            and unquote(targets[0].get("name")) == "BharatCode", "Unexpected native targets; review required")
    refs = objects["XCConfigurationList"][targets[0]["buildConfigurationList"]]["buildConfigurations"]
    configs = objects["XCBuildConfiguration"]
    release = [ref["value"] for ref in refs if unquote(configs[ref["value"]]["name"]) == "Release"]
    require(len(release) == 1, "Expected exactly one app Release configuration")
    key = release[0]
    settings = dict(configs[key]["buildSettings"])
    require(unquote(settings.get("PRODUCT_BUNDLE_IDENTIFIER")) == IOS_ID, "Generated iOS bundle ID changed")
    ids = identifiers(env)
    signing = {"CODE_SIGN_STYLE": "Manual", "DEVELOPMENT_TEAM": ids["IOS_TEAM_ID"],
               "CODE_SIGN_IDENTITY": certificate_sha1, "PROVISIONING_PROFILE_SPECIFIER": ids["IOS_PROVISION_PROFILE_UUID"],
               "CODE_SIGNING_ALLOWED": "YES", "CODE_SIGNING_REQUIRED": "YES"}
    # Override conditional variants too, but only within this app target's Release config.
    for name in list(settings):
        base = name.strip('"').split("[", 1)[0]
        if base in signing:
            settings[name] = signing[base]
        elif base == "PROVISIONING_PROFILE":
            del settings[name]
    settings.update(signing)
    return {key: settings}


def prepare_project():
    project = "ios/BharatCode.xcodeproj/project.pbxproj"
    prefix = "const fs=require('fs'), p=require('xcode').project(process.argv[1]); p.parseSync();"
    objects = json.loads(run(["node", "-e", prefix + "process.stdout.write(JSON.stringify(p.hash.project.objects));", project]).stdout)
    options = plistlib.loads((signing_dir() / "ExportOptions.plist").read_bytes())
    changes = project_settings(objects, os.environ, options["signingCertificate"])
    writer = prefix + "const changes=JSON.parse(fs.readFileSync(0,'utf8')); for(const [id,settings] of Object.entries(changes)) p.hash.project.objects.XCBuildConfiguration[id].buildSettings=settings; fs.writeFileSync(process.argv[1],p.writeSync());"
    run(["node", "-e", writer, project], json.dumps(changes).encode())


def validate_build_settings(rows, env, certificate_sha1):
    app = [row["buildSettings"] for row in rows if row.get("target") == "BharatCode"]
    require(len(app) == 1, "Missing/ambiguous resolved app build settings")
    expected = {"PRODUCT_BUNDLE_IDENTIFIER": IOS_ID, "CONFIGURATION": "Release", "PLATFORM_NAME": "iphoneos",
                "CODE_SIGN_STYLE": "Manual", "DEVELOPMENT_TEAM": env["IOS_TEAM_ID"],
                "CODE_SIGN_IDENTITY": certificate_sha1, "CODE_SIGNING_ALLOWED": "YES",
                "PROVISIONING_PROFILE_SPECIFIER": identifiers(env)["IOS_PROVISION_PROFILE_UUID"]}
    require(all(app[0].get(k) == value for k, value in expected.items()), "Effective Release signing settings mismatch")


def build_settings():
    result = run(["xcodebuild", "-workspace", "ios/BharatCode.xcworkspace", "-scheme", "BharatCode",
                  "-configuration", "Release", "-destination", "generic/platform=iOS", "-showBuildSettings", "-json"])
    options = plistlib.loads((signing_dir() / "ExportOptions.plist").read_bytes())
    validate_build_settings(json.loads(result.stdout), os.environ, options["signingCertificate"])


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def one_app(folder):
    apps = list(folder.glob("*.app"))
    require(len(apps) == 1, "Expected exactly one app bundle")
    return apps[0]


def verify_app(app, label):
    info = plistlib.loads((app / "Info.plist").read_bytes())
    validate_app_info(info, os.environ["BC_INTERNAL_BUILD_NUMBER"])
    require(not list(app.rglob("*.appex")) and not list(app.rglob("*.app")), "Unreviewed embedded app/extension")
    executable = info.get("CFBundleExecutable", "")
    require(re.fullmatch(r"[A-Za-z0-9_.-]+", executable), "Invalid app executable")
    architectures = run(["lipo", "-archs", app / executable]).stdout.decode().split()
    require("arm64" in architectures and not {"x86_64", "i386"}.intersection(architectures), "Not an arm64 device executable")
    require((app / "main.jsbundle").stat().st_size > 0, "Missing embedded iOS JS")
    run(["codesign", "--verify", "--deep", "--strict", app])
    profile = decode_profile(app / "embedded.mobileprovision")
    validate_profile(profile, os.environ)
    ent = plistlib.loads(run(["codesign", "-d", "--entitlements", ":-", app]).stdout)
    validate_entitlements(ent, profile, os.environ)
    with tempfile.TemporaryDirectory(prefix=label + "-cert-", dir=signing_dir()) as folder:
        prefix = Path(folder) / "certificate-"
        # Optional long-option arguments must use '='; a separate prefix is
        # otherwise treated as another code object, causing post-build failure.
        run(["codesign", "-d", "--extract-certificates=" + str(prefix), app])
        require(sha256(Path(str(prefix) + "0")) == identifiers(os.environ)["IOS_DISTRIBUTION_CERT_SHA256"],
                "App signed with unexpected certificate")
    return sha256(app / "main.jsbundle")


def verify_archive():
    app = one_app(Path("build/BharatCode-TESTFLIGHT.xcarchive/Products/Applications"))
    return verify_app(app, "archive")


def verify_export():
    require(os.environ.get("BC_SECURITY_AUDIT") == "success" and os.environ.get("BC_EXPO_COMPATIBILITY") == "success",
            "Signed candidate requires successful security and compatibility gates")
    options = plistlib.loads((signing_dir() / "ExportOptions.plist").read_bytes())
    profile = plistlib.loads((signing_dir() / "profile.plist").read_bytes())
    require(options == export_options(profile, os.environ), "Export policy changed")
    archive_hash = verify_archive()
    candidates = list(Path("build/ios-export").glob("*.ipa"))
    require(len(candidates) == 1, "Expected exactly one exported IPA")
    with tempfile.TemporaryDirectory(dir=signing_dir()) as folder:
        run(["ditto", "-x", "-k", candidates[0], folder])
        exported_hash = verify_app(one_app(Path(folder) / "Payload"), "export")
    require(exported_hash == archive_hash, "Exported JS differs from the verified native archive")
    mapping = Path("build/ios/main.jsbundle.map")
    report = security_gate.runtime(json.loads(mapping.read_text()))
    report.update({"sourceMapSha256": sha256(mapping), "nativeBundleSha256": archive_hash,
                   "exceptionPolicy": security_gate.EXCEPTION, "publicReleaseApproved": False,
                   "evidence": "Actual signed iPhoneOS archive map; exported IPA JS hash matches archive"})
    output = Path("build/internal-artifacts/ios")
    output.mkdir(parents=True, exist_ok=True)
    artifact = output / "BharatCode-TESTFLIGHT-INTERNAL-CANDIDATE.ipa"
    shutil.copy2(candidates[0], artifact)
    digest = sha256(artifact)
    metadata = {"sourceCommit": os.environ["GITHUB_SHA"], "runId": os.environ["GITHUB_RUN_ID"],
                "runAttempt": os.environ["GITHUB_RUN_ATTEMPT"], "platform": "ios", "configuration": "Release",
                "applicationId": IOS_ID, "version": VERSION, "buildNumber": os.environ["BC_INTERNAL_BUILD_NUMBER"],
                "artifact": artifact.name, "sha256": digest, "signing": "apple-distribution",
                "certificateSha256": identifiers(os.environ)["IOS_DISTRIBUTION_CERT_SHA256"],
                "dependencyAudit": "success under approved temporary picomatch exception; not a clean audit",
                "internalSecurityPolicy": security_gate.EXCEPTION, "exceptionExpires": security_gate.EXPIRES.isoformat(),
                "expoCompatibility": "success", "nativeAcceptanceTested": False, "storeUploadPerformed": False,
                "storeUploadable": False, "storeUploadableReason": "App Store Connect acceptance and device testing not yet verified",
                "futureAllowedDestination": "TestFlight INTERNAL only", "publicReleaseApproved": False}
    (output / "runtime-exclusion.json").write_text(json.dumps(report, indent=2) + "\n")
    (output / "build-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (output / "SHA256SUMS").write_text(f"{digest}  {artifact.name}\n")
    (output / "READ-ME-FIRST.txt").write_text(
        "APPLE DISTRIBUTION SIGNED — TESTFLIGHT INTERNAL CANDIDATE ONLY\n"
        "No store upload or public release. Export used internal-testing-only restriction.\n"
        "Approved picomatch tooling exception expires 2026-12-02; npm audit is not clean.\n"
        "Actual native source-map exclusion passed; exported JS matches the archive.\n"
        "App Store Connect acceptance and exact-device testing remain unverified.\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("prerequisites")
    for command in ("install", "cleanup", "prepare-project", "build-settings", "verify-archive", "verify-export"):
        sub.add_parser(command)
    options = sub.add_parser("export-options")
    options.add_argument("profile", type=Path, help="CMS-decoded approved profile plist")
    options.add_argument("output", type=Path, help="New ExportOptions.plist under runner temp")
    args = parser.parse_args()
    stage(args.command)
    if args.command in ("prerequisites", "export-options"):
        prerequisites(os.environ)
    if args.command == "export-options":
        data = export_options(plistlib.loads(args.profile.read_bytes()), os.environ)
        # Never overwrite a reviewed export policy or an existing arbitrary file.
        with args.output.open("xb") as output:
            os.chmod(args.output, 0o600)
            plistlib.dump(data, output)
    elif args.command != "prerequisites":
        require(sys.platform == "darwin", "Native signing operations require hosted macOS")
        {"install": install, "cleanup": cleanup, "prepare-project": prepare_project,
         "build-settings": build_settings, "verify-archive": verify_archive, "verify-export": verify_export}[args.command]()
    print("iOS step passed: " + args.command + "; no store upload performed.")


def cli():
    try:
        main()
    except PolicyError as error:
        # require() messages use literals, fixed field names/cleanup labels, or
        # numeric exit codes only. Do NOT print arbitrary ValueError messages:
        # parsers and security_gate may include input data in those exceptions.
        print(f"iOS policy validation failed [{CURRENT_STAGE}]: {error}", file=sys.stderr)
        return 1
    except (ValueError, KeyError, TypeError, OSError, plistlib.InvalidFileException):
        print(f"iOS input/tool failure [{CURRENT_STAGE}]; details suppressed; inspect inputs privately.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(cli())

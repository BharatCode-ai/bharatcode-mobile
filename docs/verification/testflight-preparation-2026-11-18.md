# TestFlight packaging preparation — November 18, 2026

Scope: local preparation only; **no CI dispatch, push, key creation/rotation,
store upload, external TestFlight distribution, or public release**. Android
0.2.0 (1) is already published to the four-person Play INTERNAL test group,
per the parent. This lane does not modify Android or perform VS Code OAuth/Browse
release work; those parallel lanes remain with the parent.

## Inspected baseline and historical artifact

- Checkout: `/home/ubuntu/bc-mobile-release`; branch
  `prep/internal-test-builds-20261118`; inspected HEAD
  `a772bb88d186647d96060d30699eef46508a4eb0`.
- No `AGENTS.md` was present in the checkout or its WSL ancestor directories.
  README and the internal-test operator guide require hosted native packaging,
  unchanged identities, no debug signing fallback, and separate release acceptance.
- Current source: Expo 58.0.26 / React Native 0.88.1; app version `0.2.0`;
  iOS bundle ID **`ai.bharatcode.bharatcodeMobile`** remains unchanged.
- Read-only GitHub metadata confirms
  [run 44159414042](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44159414042),
  attempt 1, source `636e7a353ec2f2866a45970cb136e33250b1110e`: native iOS job
  `134309643170` succeeded (2026-11-17 19:32:20–20:26:21 UTC). Overall workflow
  failed because the old security and compatibility jobs failed.
- [Unsigned artifact 14367521041](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44159414042/artifacts/14367521041):
  `ios-UNSIGNED-NOT-UPLOADABLE-636e7a353ec2f2866a45970cb136e33250b1110e-1`,
  56,513,207 ZIP bytes, expires 2026-11-24 20:25:54 UTC; not expired at inspection.
  The workflow packages `BharatCode-UNSIGNED-NOT-UPLOADABLE.xcarchive.tar.gz`.
  This inspection read metadata, not the archive bytes; no new checksum claimed.
- That archive predates the compatible dependency alignment in `79510e0`.
  Do not re-label/re-sign it as the current-source TestFlight candidate. It proves
  earlier iPhoneOS Release compilation, not signing, current-source acceptance,
  installation, or TestFlight delivery.
- The committed baseline had **only unsigned iOS**. The local consolidated diff
  adds explicit `ios_signing=testflight` for `platform=ios` only, on the same hosted
  runner/Xcode. Default unsigned diagnostics remain unchanged; the separate
  `ios-signed` job requires source, security and compatibility success.

## Exact missing inputs (values must come from the parent)

At initial inspection, no repository secrets or iOS inputs in `mobile-internal`
were found. That environment is the Android signing lane. Parent subsequently
provisioned and verified all three iOS secrets and four public variables in the
separate `mobile-internal-ios` environment, restricted to
`prep/internal-test-builds-20261118`.

Separate protected environment: **`mobile-internal-ios`**, so the iOS job never
receives Android key material. Parent owns provisioning; this lane did not create
the environment or credentials. The user approved dedicated Apple Distribution
certificate/profile creation and encrypted backup by the parent. The existing
Developer ID Application/macOS certificate is not suitable and remains unchanged.
Parent subsequently generated the dedicated Apple Distribution certificate with
portal identifier `WQXYYZMAJ4` and the matching distribution profile. Parent reports
correct keypair, Apple issuer signature verification, P12 roundtrip, successful
profile-helper validation, and verified DPAPI backups for both assets.
That portal identifier is not a certificate fingerprint or private-key alias.

| Environment secret | Required owner-supplied material |
| --- | --- |
| `IOS_DISTRIBUTION_P12_BASE64` | Approved Apple Distribution certificate **and private key**, exported as password-protected P12 |
| `IOS_DISTRIBUTION_P12_PASSWORD` | That P12's password |
| `IOS_PROVISION_PROFILE_BASE64` | Matching, valid App Store Connect distribution profile for the exact iOS App ID |

| Public variable | Non-secret identifier/status |
| --- | --- |
| `IOS_TEAM_ID` | Parent verified `B2T9HN8AD4`; must be configured in the environment |
| `IOS_APP_ID_PREFIX` | Parent verified `B2T9HN8AD4`; separately checked, not inferred from Team ID |
| `IOS_PROVISION_PROFILE_UUID` | `de8f2767-f591-4027-bf4e-bcc934c969cc` |
| `IOS_DISTRIBUTION_CERT_SHA256` | `9cc89dcb999111d2331ce78faae0fcbbbec61b0cc0b598c7cec194b450732927` |

Parent verified App Store Connect sign-in and created the iOS-only app record:
numeric Apple ID **6836039139**, exact bundle `ai.bharatcode.bharatcodeMobile`, no
optional capabilities. No builds exist; **iOS build 1 is unused**. Parent verified
the supplied signing inputs; hosted import/archive/export and final Apple
acceptance are still pending. Profile name and certificate identity/expiry can
be read privately from the supplied assets; no extra secrets are needed for those.

For later delivery, parent must verify the upload/internal-test-management role,
export-compliance answer, and authorized internal tester group. The verified numeric Apple ID and upload credentials
are **not needed for build-only archive/export**. No Apple password, app-specific
password, App Store Connect API key, or EAS token is requested for this lane.
Do not guess export-compliance declarations or change app identity to resolve
an account mismatch.

## Approved TestFlight-only extension of the same narrow exception

The saved local/hosted audits still contain high picomatch
GHSA-fc5q-39xc-vjpf and inherited findings. The approved
`20261118-picomatch-internal` exception was initially Android-only. After review
of the local iOS evidence below, the owner explicitly approved the **same narrow
exception for TestFlight internal testing**, with actual native iOS exclusion
required again. The local workflow enables it only for explicit `platform=ios`
and `ios_signing=testflight`; `platform=both` does not get a waiver.

The exact advisory, picomatch versions 2.3.2/4.0.7, and expiry **December 2, 2026
UTC** are unchanged. Every other high/critical finding, incomplete report,
unreviewed picomatch version and expiry remains blocking. Raw audit/decision
artifacts and the CI warning remain. Ordinary Source checks are unchanged. This
is neither a clean audit nor public-release permission. No new audit or JS export
was run for this workflow implementation.

## Local signed workflow and guard preparation

New `scripts/internal-build/ios_signing.py` and fixture tests provide:

- Required-input checks without credential values in output.
- Exact team, distinct App ID prefix, profile UUID, explicit bundle ID, validity
  dates, TestFlight entitlement, and approved certificate SHA-256 matching.
- Rejection of debug, development/ad-hoc/enterprise and wildcard profiles.
- Signed-entitlement checks for the existing app's narrow capability set and
  app-specific keychain group; new capabilities require review.
- Packaged Info.plist checks for the exact ID/version/build and iPhoneOS target.
- Fixed manual export options: `method=app-store-connect`, `destination=export`,
  `testFlightInternalTestingOnly=true`, automatic build-number changes disabled,
  exact certificate/profile selection, and no symbol upload. Xcode selects the
  pinned certificate by its derived SHA-1 identity after the SHA-256 check.

The helper now imports only approved material into an isolated temporary keychain,
checks the certificate's code-signing trust and pinned valid Distribution identity
with private key, and installs the approved profile without overwriting another
profile. Secrets are scoped to that one step, not npm/build/export. It applies
manual signing only to the app's Release configuration using the already locked
`xcode` parser; no new dependency or signing framework is added. Resolved Xcode
settings are checked before archive.

The actual Xcode archive emits `build/ios/main.jsbundle.map`; the existing excluded-
package check runs on it before export. React Native composes that final map from
the native build's packager/Hermes maps; a separate local export is not substituted.
Archive and IPA verification checks device identity/version, non-debug entitlements,
profile validity, deep/strict code signatures and certificate pin, embedded JS,
arm64 executable, and no unreviewed app extensions. IPA JS must hash-match the
archive. Candidate metadata binds that native JS/map to the source/run/IPA hashes.

Always-run cleanup restores the keychain search list and removes only owned
temporary material before artifact upload. No provisioning-update flag, automatic
signing, credential creation, key rotation, or store-upload command is present.
The CLI suppresses private tool output. Tests use synthetic certificate bytes,
mock native tools and temporary fixture files, not real keys or native builds.

Android's job and validator, dependency lockfile, app config and default unsigned
iOS commands are unchanged. The shared security helper adds only the iOS scope
and output path, retaining the Android default behavior. Source-only validation:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/internal-build -p 'test_*.py'
git diff --check
```

The parent independently reviewed the 67-test version. Final local result after
the command-line correction below: **68 tests passed: 26 iOS, 14 security-policy,
28 existing build guards**. The added regression exercises actual helper argument
construction with mocked native tools. Existing `actionlint` also passes.
No real Apple signing/export has been validated yet.

## Source-derived capability and encryption inventory

This is technical evidence for the parent's declarations, not a legal exemption
determination. No app configuration or declaration was changed in this review.

- `app.config.ts` has the exact bundle ID, custom `bharatcode` URL scheme and iPad
  support. It requests no Push Notifications, Associated Domains, App Groups,
  iCloud, Sign in with Apple or background-mode entitlements. Custom URL schemes
  are not Associated Domains. Current source does not require enabling optional
  portal capabilities for those services.
- QR scanning in `src/features/pairing/PairingScreen.tsx` requests camera access.
  The configured `NSCameraUsageDescription` explains Desktop pairing. This is a
  runtime permission/purpose string, not an additional App ID capability.
- `src/storage/native.ts` uses SecureStore with no `requireAuthentication` or
  shared keychain group. The locked iOS implementation uses Apple `SecItem*`
  Keychain APIs. Ordinary app-private Keychain access uses the signed app's
  default group; no cross-app Keychain Sharing capability is requested.
- The locked Camera plugin also supplies `NSMicrophoneUsageDescription` by
  default: `recordAudioAndroid: false` affects Android only. The SecureStore
  plugin supplies `NSFaceIDUsageDescription` by default. No microphone recording
  or biometric-authentication request exists in the app source. These default
  purpose strings do not establish actual use, collected data, or extra portal
  capabilities; they were not removed as part of this signing-only change.
- Pairing origins are restricted to HTTPS `*.tunnel.bharatcode.ai`. The app uses
  `expo/fetch`; its locked iOS implementation delegates to Apple `URLSession`.
  App authentication uses bearer tokens stored in Keychain, not an app-implemented
  encryption transport. SSE streams travel through the same HTTPS client.
- `expo-crypto` is called for `randomUUID()` in `src/state/react.tsx`. The locked
  native module also exposes hash/random/AES APIs backed by Apple CommonCrypto,
  Security and CryptoKit. Its AES JS adapters occur in the local iOS map even
  though app code calls only UUID generation; do not claim all crypto code was
  tree-shaken away. No proprietary cipher implementation was found in app/src.
- SQLite is configured without `useSQLCipher`, custom crypto flags or an
  encryption-key PRAGMA; the locked Podspec selects ordinary SQLite by default.
  The vendored `node-forge` is a development/security-test dependency; it was not
  present in the saved iOS JS map. That map is not a full native-library inventory.
- Neither `ios.config.usesNonExemptEncryption` nor an explicit
  `ITSAppUsesNonExemptEncryption` value is set. The inspected Expo plugin leaves
  that declaration absent. Apple says an absent key causes an upload-time export
  compliance questionnaire; `NO` means no **non-exempt** encryption, not necessarily
  no encryption. Apple lists OS-only encryption as requiring no App Store Connect
  documentation. The observed paths support reviewing that category, but the
  owner must confirm the complete linked app and applicable answers. No legal
  conclusion, compliance code, or blanket `false` flag was invented.

## Native-parameter review before the first signed run

- Corrected certificate extraction to `codesign -d --extract-certificates=<prefix>`.
  This is an optional long-option argument; the previous separate prefix could
  be interpreted as another code object and fail after an otherwise successful
  archive. A fixture regression now exercises this exact helper path.
- Xcode 26.6 is selected by `DEVELOPER_DIR`, checked before heavy work, and must
  advertise the required internal-only export options. The existing Intel runner
  is the default. Host architecture does not change the generic iPhoneOS device
  destination; no simulator or device UDID is substituted.
- The scheme/workspace match the prior successful unsigned lane. Signing is
  target-scoped to app Release, not globally applied to Pods; resolved bundle ID,
  team, profile, certificate, configuration and `iphoneos` platform must match
  before archive. The App Store distribution profile needs no device list.
- The installed React Native Xcode script reads `SOURCEMAP_FILE` and writes the
  composed native Hermes map there. The workflow passes that build setting on
  the actual archive invocation, checks the map before export, and binds the
  exported IPA's JS to the archive. No second standalone Metro export is used.
- Export is manual `app-store-connect` with `destination=export`, internal-testing
  restriction, fixed build number and no auto-provisioning flag. Deep signature,
  certificate/profile, device architecture and JS checks remain after export.
  Real credentials and hosted macOS execution are still untested; fixture checks
  do not prove Xcode/Apple acceptance.

## Proposed single-build execution, after parent review and blockers clear

1. Consolidate/review one diff with the parent-verified Apple inputs above.
   Do not start a native diagnostic rerun just
   to rediscover these blockers. Parent authorizes any later commit/push/dispatch.
2. The implemented default-unsigned iOS signing choice makes signed iOS depend on
   **source + compatibility + security success**, use the separate protected
   environment, and select `platform=ios` so Android does not rebuild. No auto-run
   trigger, cancellation change, auto-provisioning or store-upload command.
3. Before npm/Pods/archive on the existing hosted Intel runner, verify the selected
   Xcode and its `-help` support the exact internal-only export keys. Validate the
   approved profile and certificate/private-key pair in a temporary keychain,
   certificate trust/expiry and expected fingerprint. Do not print raw profiles,
   keychain contents or secrets. Generate only an ephemeral keychain password,
   never new production signing keys. Always clean keychain, profile and P12.
4. Reuse locked Expo prebuild/Pods on current reviewed source. Apply manual signing
   to the **app target only**, without forcing its profile onto Pod targets. Check
   resolved Release/device build settings, unchanged ID/version/build and actual
   entitlements before archive. Do not use `-allowProvisioningUpdates` or automatic
   certificate/profile repair. Set an explicit iOS Metro source-map output path.
5. Archive once, export once using the guarded internal-only ExportOptions. Check
   the archive and exported IPA: valid signatures including nested code, approved
   certificate/profile/entitlements, Release device identity/build, embedded JS,
   and no unexpected app extensions. Verify the **actual iOS** Metro map with the
   existing exclusion function, keeping any evidence under an iOS-specific path;
   `runtime-ios` writes the separate iOS evidence path; Android's output is unchanged.
6. Upload only allowlisted build evidence/candidate IPA (and approved dSYMs if
   needed) as GitHub artifacts: no loose P12, keychain, profile, raw environment or
   sensitive signing logs. The IPA necessarily embeds its provisioning profile;
   review access/retention accordingly. Record source/run/hash/signing identity
   and no-upload status. Parent independently verifies and performs a separately
   authorized TestFlight-internal delivery and exact-device acceptance.

No native build or real signing/export was attempted by this preparation lane.

## Additional local iOS runtime evidence

The existing Windows preflight dependency tree matched the reviewed `79510e0`
package/lock and runtime source. An offline, iOS-only production Metro/Hermes
export completed without a native build, dependency installation or CI run.
The resulting 1,460-entry Hermes source map passed the unchanged excluded-package
check with zero matches (Metro reported 1,518 modules; these are distinct counts).
This does not replace checking the future native archive's actual bundle/map.

Receipt: `C:/Users/Shrey Gupta/.codex/tmp/bc-mobile-ios-metro-proof-20261118-79510e0/ios-metro-evidence.json`.
That evidence alone did not authorize an iOS exception, signing or upload. The
owner subsequently explicitly approved the narrow TestFlight-only exception
described above, with a fresh native-bundle check required. No new native run,
push, credential creation or store upload was performed by this lane.

## Apple references

- [App Store Connect provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile): explicit App ID and distribution certificate requirements.
- [Xcode distribution options](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases): export versus upload, manual signing, and internal-TestFlight-only restriction.
- [Entitlements troubleshooting](https://developer.apple.com/library/archive/technotes/tn2415/): App ID prefix can differ from Team ID; profile and signed entitlements must match.
- [Apple encryption declaration key](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption) and [encryption documentation categories](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption): owner must determine the applicable declaration, including linked libraries.
- [Expo SDK 58 SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/): iOS Keychain storage and default Face ID purpose string.
- [Apple certificate-extraction example](https://developer.apple.com/fr/documentation/devicemanagement/allowing-and-denying-apps-and-binaries): custom extraction prefix uses the `--extract-certificates=<prefix>` form.

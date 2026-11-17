# Internal build preparation — November 18, 2026

This is a build/evidence record, **not a public-release approval**. No branch was
merged, and no public release was made. The verified Android candidate was later
uploaded manually and published only to Play INTERNAL with explicit approval.
Only TestFlight and Play INTERNAL are permitted destinations. The CI workflows did not
create store records or signing keys; the parent separately handled the original
Play Draft, duplicate-draft deletion, and approved upload-key provisioning.

## Latest parent-reported status

- Consolidated guard/dependency commit:
  [`79510e0012e3505b937f813faa92e3bd39ecc407`](https://github.com/BharatCode-ai/bharatcode-mobile/commit/79510e0012e3505b937f813faa92e3bd39ecc407).
  SDK 58 compatibility drift is corrected: Expo 58.0.26 / React Native 0.88.1
  and the aligned module versions. App version remains 0.2.0.
- The owner explicitly approved a narrow, temporary **Android internal-test-only
  picomatch exception**, enforced by `security_gate.py` in that commit. It expires
  December 2, 2026 (UTC). This is risk acceptance for the named tooling advisory,
  not a vulnerability fix, a clean npm audit, or permission for public release.
- In [signed Android build-only run 44171899132](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44171899132),
  **source, security-policy, compatibility and Android jobs all passed**.
  Native compilation took 17m14s; the Android job took 18m08s. This was the single
  consolidated signed run, attempt 1; no retry was needed.
- Earlier iOS run 44159414042 completed native compilation and unsigned artifact
  creation successfully. Its overall workflow stayed red because its historical
  audit/compatibility jobs failed. It is not a TestFlight-ready signed artifact.
- The original Play Draft for `ai.bharatcode.bharatcode_mobile` is retained; the
  duplicate Draft was deleted by the parent. Neither source identity was changed
  and the duplicate package was never targeted by this workflow.
- The dedicated upload key and all agreed environment secrets/variable are
  provisioned. No further CI, push, signing change, or iOS rebuild is initiated by
  this documentation reconciliation.

## Source and implementation

### Signed Android artifact verified

- Artifact [14368399936](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44171899132/artifacts/14368399936),
  `android-upload-key-INTERNAL-ONLY-79510e0012e3505b937f813faa92e3bd39ecc407-1`.
- Original application ID, version 0.2.0, versionCode 1; Release, upload-key signed.
- AAB SHA-256: `b5c50d91195ed825956a673e804a6534bae036d1080fa40117af58a6220ba273`.
- Upload-certificate SHA-256: `994b08eaa8e7ad900d4ff3fd36bc1d5d3a10ecbe491973b13c51294a29d974ac`.
- CI verified the non-debug manifest, embedded JS and arm64 libraries, signature,
  and certificate. The downloaded AAB independently passed SHA256SUMS, jarsigner
  verification, certificate matching, and structural checks.
- Native Metro runtime proof: 1,520 sources; no picomatch, micromatch, anymatch,
  tinyglobby, glob or minimatch. Map SHA-256:
  `fa3fddab903a4ea3403e8424bbd85a428da1ff650264996995153015f2cf585c`.
- Hosted audit: 72 inherited high, 9 moderate, 0 critical. Compared with the local
  69-high report, three additional inherited rows (`@testing-library/react-native`,
  `@types/jest`, `expo-router`) trace to the same picomatch advisory. The direct
  advisory objects and lockfile hash match; no new high advisory was accepted.
- CI removed the temporary signing key successfully. Artifact retention is seven
  days. This establishes a signed internal candidate, not physical-device or
  store-delivered acceptance; no public distribution is approved.
- Play's original app has a saved, selected four-person dedicated tester list;
  unrelated account-level lists remain unselected. Tester addresses are kept in
  the private operator receipt, not this repository.

### Source baseline

- Repository: `BharatCode-ai/bharatcode-mobile`.
- Baseline main: `fff96eb20923927b9f652a5040b91a35428f114e`.
- Preparation branch: `prep/internal-test-builds-20261118`.
- Checkout: `/home/ubuntu/bc-mobile-release` in WSL Ubuntu-22.04.
- Initial unsigned artifacts: Expo 58.0.21 / React Native 0.88.0, version 0.2.0;
  not Flutter. The current approved build uses the aligned versions listed above.
- Android ID remains `ai.bharatcode.bharatcode_mobile`.
- iOS ID remains `ai.bharatcode.bharatcodeMobile`.
- The initial unsigned build commits made no package/lockfile or app-feature
  changes; app config added an optional CI build number. The later approved
  consolidated commit updates compatible dependencies/lockfile, test configuration,
  and the narrow security guard, without UI changes, major upgrades, or forced fixes.
  The Android builds use build number/versionCode 1.
- This worker performed no local node_modules install or native build in WSL.
  The parent subsequently performed bounded JS-only installation, source checks,
  and Android Metro export on Windows. Native builds remained hosted.

The [workflow](../../.github/workflows/internal-build.yml) is manual-only and has
read-only repository permissions. The temporary branch-only bootstrap trigger at
`35ed0b7311a3365d18c5993b492d59428204ceec` was removed at
`f2671b7d4e327e5ec4e7acb861eab11fa93306b3`; subsequent builds were manually dispatched.
Main was never modified to register the workflow. All referenced actions are pinned
to commit SHAs. See the [operator guide](../internal-test-builds.md) for exact inputs,
the signing contract, and store prerequisites.

## Historical Android evidence: unsigned Release AAB produced

- [Run 44157827174](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44157827174),
  attempt 1, source `1fd886cd99e750a8c337c61db359e1fe5610cb68`.
- Android native job: **success**. The overall run is **failure** because the
  independent security and compatibility readiness gates failed under the old policy.
- [Artifact 14362289455](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44157827174/artifacts/14362289455):
  `android-unsigned-INTERNAL-ONLY-1fd886cd99e750a8c337c61db359e1fe5610cb68-1`.
- Artifact ZIP size: 86,485,979 bytes; seven-day retention.
- Binary inside: `BharatCode-UNSIGNED-NOT-UPLOADABLE.aab`.
- AAB SHA-256: `eebddf94d12497953e3190cf434e49b8d2541c3c717df9017bc8ea7c94633623`.
- App version 0.2.0, versionCode 1, unchanged Android package ID.
- Compiled via Expo prebuild and Gradle `:app:bundleRelease`, not assembleDebug.
- Effective Release signing config was null and debuggable was false. The merged
  manifest matched identity/version, the AAB contained embedded JS and arm64 native
  libraries, and no JAR signing certificate was present.
- Metadata, `SHA256SUMS`, and `READ-ME-FIRST.txt` were inspected from the artifact
  archive without saving the binary to the disk-constrained WSL checkout.

This is **not uploadable**, not an installable signed build, and not native
acceptance evidence. It cannot be substituted for a signed INTERNAL-track AAB.

## Completed iOS evidence: unsigned archive, overall workflow red

Unsigned iPhoneOS Release compilation and artifact creation **succeeded**, as
confirmed by the parent, on the standard Intel macOS 26 runner with Xcode 26.6 in
[run 44159414042](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44159414042),
source `636e7a353ec2f2866a45970cb136e33250b1110e`.
The native job succeeded; the overall workflow remained **failure** because its
old audit and compatibility gates failed. The output is an unsigned
`BharatCode-UNSIGNED-NOT-UPLOADABLE.xcarchive.tar.gz`, not an IPA or TestFlight build.
No artifact ID, checksum, or final billed duration is invented in this record.
The original ARM64 macOS attempt in
[run 44157231353](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44157231353)
remained unassigned when the Intel alternative was started. GitHub subsequently
cancelled that unstarted job after 15 minutes, with the annotation "The job was not
acquired by Runner of type hosted even after multiple attempts" and notices of
macOS ARM64 capacity constraints. This task issued no cancellation request.
Intel is now the default; both runner inputs are mapped to a hosted allowlist.

No iOS certificate/profile was imported, signing is disabled, and no IPA export or
TestFlight upload is configured. No Apple Team ID or numeric App Store ID is guessed.

## Historical tests and readiness failures

The earlier source/native preparation commits established:

- TypeScript and ESLint pass.
- 76 mobile Jest tests across 12 suites pass.
- 15 node-forge certificate/security regressions pass.
- 52 Desktop connector tests and 3 host-browser helper tests pass.
- 25 build-safety tests passed on the unsigned native build commits. Subsequent
  local preparation reached 28 dependency-free tests, including hosted-runner
  allowlisting, manifest/lockfile agreement, and the retained node-forge backport.
  These are historical counts, not a count of the later security-guard suite.
- Workflow lint (`actionlint` 1.7.12) and `git diff --check` pass.

The Desktop integration-generator tests were not rerun: they need a separate
checkout of the documented Desktop source. No physical Android/iOS, simulator,
store-delivered build, or final signed-artifact acceptance was performed here.

**Historical security gate: failed.** The original locked dependency audit reported 78 findings:
67 high, 11 moderate, no critical. The high entries are picomatch and its inherited
dependents, not 67 independent new vulnerabilities. Relevant advisories:

- [picomatch GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf):
  high; affected through 4.0.7; the November 17 advisory lists no patched version.
- [glob GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): moderate.
- [minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): moderate.

The full JSON audit was retained separately. No dependency downgrade, forced audit
fix, broad override, or security exception was applied to those earlier runs.
The later explicit exception is described separately below.

**Historical Expo compatibility gate: failed.** The live check recommended Expo ~58.0.26,
React Native 0.88.1, and aligned patches for 13 other packages. The full report is
retained as `expo-compatibility-*`. Those old unsigned artifacts retain their
recorded source; the later consolidated dependency correction does not alter them.

Those failures remain part of the historical run evidence. They are not the status
of the current approved Android run, whose source/security-policy/compatibility
jobs have passed.

## Current readiness policy and corrected dependency validation

The parent completed Windows JS-only preflight: TypeScript, ESLint, 76 app tests,
15 node-forge regressions, and Expo compatibility passed. The Android production
JS export contained 1,520 sources and none of the flagged matching libraries.
Windows Jest matching was corrected and zero-test success was disabled. This
export supports the tooling-only assessment; it does not replace the current
native build's own Metro source-map check.

The fresh aligned-lock audit still reports **78 findings: 69 high and 9 moderate**.
Direct advisories are picomatch (high), glob and minimatch (moderate). Picomatch
2.3.2/4.0.7 remain unpatched. Dependency compatibility is fixed; this advisory is
**not** represented as fixed or as a clean audit.

The owner-approved policy `20261118-picomatch-internal` permits only the exact
picomatch advisory GHSA-fc5q-39xc-vjpf, those reviewed versions, and their inherited
findings, for Android upload-key internal-test builds before expiry. Other
high/critical findings, incomplete reports, unreviewed versions, and expiry fail
the guard. Raw audit evidence and the exception decision are retained, with a CI
warning. Ordinary Source checks keep their normal audit policy.

Before the signed AAB is uploaded as a GitHub build artifact, the actual native
Metro map must exclude picomatch, micromatch, anymatch, tinyglobby, glob, and
minimatch. The original app identity, non-debuggable Release build, approved signing
certificate, and artifact checks still apply. No Play upload is performed by CI.
See [the approved exception record](android-internal-exception-2026-11-18.md) and
[the run audit](ci-run-audit-2026-11-18.md).

## Remaining access and acceptance

- Android environment: `mobile-internal`; required secrets are
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
  `ANDROID_KEY_PASSWORD`; public certificate variable `ANDROID_UPLOAD_CERT_SHA256`.
  The parent confirmed provisioning of all four secrets and the public variable,
  with a dedicated RSA3072 PKCS12 upload key and a roundtrip-verified Windows
  DPAPI-encrypted backup. The workflow did not create or change the key.
  The exact certificate is checked before and after signing, and
  debug signing never substitutes for missing credentials.
- Play: the parent confirmed the original free Draft in the existing account,
  unchanged package, unused versionCode 1, and verified duplicate-draft deletion.
  The parent owns remaining Play App Signing/upload-certificate registration,
  store declarations and any authorized INTERNAL upload. The dedicated four-person
  tester list is already saved and selected.
  No Play account ID/API upload token is in CI; no upload/publication is reported.
- Apple: verified Developer Program team and App ID, approved Distribution P12 and
  password/private key, matching App Store provisioning profile, real Team ID,
  matching App Store Connect app record/numeric ID, unused build number, and upload/
  internal TestFlight tester permissions. Apple access/signing remains unverified.
- Test the exact signed, store-delivered Android artifact. The build and
  runtime/signature/artifact checks have passed. The October 28 physical Android diagnostic APK does
  not certify these builds, and iOS acceptance is still outstanding.

## Final Android build result

Run **44171899132**, attempt 1, succeeded; exact artifact and independent
verification evidence appear above. Manual Play INTERNAL delivery is separate
from this build result. No public release or physical-device acceptance is claimed.

## Approved manual Play INTERNAL delivery

On November 18 at 02:38 IST, the owner-approved Google-managed app-signing choice,
verified AAB upload, and separately approved internal publication completed for
the original app. Play reports **Active**, release **0.2.0 (1) - internal**, and
**Available to internal testers**. Only the dedicated four-person tester list is
selected; unrelated lists remain unselected. Play accepted versionCode 1, target
SDK 36, minimum API 24, with an estimated 19.8 MB new-install download. Our upload
key is unchanged. Play displays a temporary unreviewed app name for this first
internal release. Physical-device acceptance is the next step, not an implied
result of successful signing or store upload. No public track was enabled.

# Upload an exact IPA to TestFlight internal testing

This is a separate, manual **upload-only** workflow. It does not run npm, Pods,
Xcode archive/export, signing, a new audit, or another Metro export. It uploads
the unchanged IPA from a successful reviewed `internal-build.yml` run. Android
and the build workflow are unchanged. No public submission or external-tester
distribution is implemented.

## Parent review and dispatch inputs

Review `.github/workflows/testflight-upload.yml` and
`scripts/internal-build/testflight_upload.py` before committing/pushing or
dispatching. Local fixtures are not proof of hosted Apple CLI acceptance.
If GitHub requires registration of the new branch-only workflow, coordinate that
separately; do not add an automatic trigger or merge merely to register it.

Supply `source_run_id`, the approved full `source_sha`, exact `artifact_id`, and
an independently reviewed `ipa_sha256`. There is no latest-artifact lookup or
default source run. Explicitly confirm `confirm_internal_only=true`. The source
run must be successful, with the signed-iOS artifact and receipt from its current
attempt. A build rerun's attempt 2 is valid; the upload job itself rejects reruns.

The protected `mobile-internal-ios` environment uses only:

- Secret `ASC_API_KEY_P8_BASE64` (the dedicated ASC P8, not the signing P12).
- Variables `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_APP_ID=6836039139`.
- Existing variable `IOS_DISTRIBUTION_CERT_SHA256` to check the builder's receipt.

The original bundle remains `ai.bharatcode.bharatcodeMobile`, version `0.2.0`.
The build number comes from the hash-verified IPA and matching builder metadata.
The Desktop key and distribution signing assets are never requested by this job.

## Checks and one upload attempt

The helper binds GitHub run/source/attempt to the exact artifact ID, verifies its
archive digest and the separately approved IPA SHA-256, and checks the real
builder's internal-only metadata/native-runtime receipt against the embedded JS.
It consumes that native-map proof; it does not claim to regenerate a source map.
The existing narrow exception and December 2, 2026 expiry remain unchanged.

Apple's documented `altool --validate-app -f ...` validates the IPA. Two read-only
ASC API requests then confirm the exact app ID/bundle and that no build with this
`CFBundleVersion` exists for the app (not the marketing-version record). HTTP
errors, redirects, missing responses and existing builds block upload. This check
is not an atomic reservation and cannot rule out a concurrent/in-flight upload.

One `altool --upload-package ...` invocation uses the fixed app/bundle/version and
verified build number. No `-f` is used for this command, and no deprecated
`--upload-app`, auto-retry loop, fallback uploader, review submission or tester
assignment is present. A multi-provider ambiguity must stop for owner review;
no provider ID is invented. The source export's internal-testing-only restriction
is preserved by uploading byte-identical IPA content.

The key is decoded only in the upload step to a mode-0600 file in a mode-0700
temporary directory, removed in `finally` and an always-run cleanup step. The
base64 secret is not inherited by child tools. JWTs and raw tool/API output are
never logged or uploaded. The sole output artifact is `upload-receipt.json`, with
source/artifact/IPA identifiers, attempt status, exit/error codes and recognized
delivery/request UUIDs. An upload timeout/failure is never retried automatically.
After any uncertain result, the parent must inspect ASC before a new approved
dispatch; API indexing may lag. Exit zero means upload completed, **not** that
processing, export compliance, internal tester availability or device QA passed.

## Local validation and official references

Seven upload-specific fixture tests use the real builder's `verify-export`
receipt writer with mocked native tools and a synthetic IPA. They cover source
attempt 2, hash/receipt tampering, JWT encoding, exact-app/unused-build reads,
redirect rejection, success/failure/timeout single-attempt behavior, private-key
cleanup and workflow scope. No real key, Apple request or native build is used.

Apple's [altool guide](https://help.apple.com/asc/appsaltool/en.lproj/static.html)
documents the command/argument forms, API-key authentication and private-key
directory. Its JSON output mode is used with allowlisted receipt fields only.
The REST preflight follows [List builds](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-builds)
and [JWT authentication](https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests).

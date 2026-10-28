# Pairing fixes verified October 28, 2026

## Changes

- Ignore only synthesized cold-launch root intents (`bharatcode://` and `bharatcode:///`); retain validation of actual pairing intents.
- Update `expo-camera` from 58.0.12 to 58.0.13. In the affected optimized Android build, ML Kit's reflected component registrar constructors were stripped by R8. The preview worked, but the analyzer failed to initialize and no scan callback arrived. The upstream fix preserves the no-argument constructors; release optimization stays enabled. See [Expo PR 52377](https://github.com/expo/expo/pull/52377).
- Keep the mirrored Desktop connector/UI changes in sync: isolate optional mobile storage errors, cancel pending/queued/restoring pairing before reset, retain damaged registry backups only on explicit reset, reject stale UI completions, and give the QR a four-module clear border.

The experimental service-side one-time pairing-code flow was reverted. This submission uses the existing hosted OpenTunnel service and requires no new server deployment.

## Source checks

Fresh checks on October 28 passed: TypeScript, ESLint, 76 Jest tests, 15 certificate/security tests, 52 connector tests, two integration-generator tests and three Linux browser-helper tests. The generator was exercised twice against its documented Desktop pin using `BHARATCODE_DESKTOP_SOURCE` set to a clone containing that pin. This distinguishes the test's clone prerequisite from implementation failures.

The optimized diagnostic APK retained public no-argument constructors for `BarcodeRegistrar`, `VisionCommonRegistrar`, and `CommonComponentRegistrar`. Both the 58.0.13 source module and its packaged prebuilt Android AAR include the constructor keep rule.

## Physical Android result

On October 28, the user scanned the installed Desktop QR with a OnePlus CPH2691 running Android 17. The phone reached matching-code approval, the user approved on Desktop, and real Desktop conversations loaded. This was a physical camera scan and user-operated approval, rather than a pasted link or an automated IPC approval.

The phone ran the separate `BharatCode Camera QA` package, built from Mobile source `0d799e09a9d5a275f4958ba88eb1c8cadadfa6c4` with temporary diagnostic counters and `expo-camera` built from source. R8 remained enabled. Installed APK SHA-256: `8462f4085100d318051b704bd6b345a0b992036244813115ee2fb231469f1653`. The existing installed Desktop and its existing sidecar handled pairing; this is not acceptance of a newly packaged Desktop build.

No camera images, QR contents or credentials were recorded by the counters. No phone permissions were changed by automation, and the existing app data and Desktop profile were preserved. This does not establish iOS, store signing, or all-platform release acceptance.

## Release boundary

The source/test and physical diagnostic-APK results above do not certify an untested replacement artifact. Packaging, installation, public releases and store submission must be reported with their own source, artifact and acceptance evidence. Earlier transport, streaming, network-recovery and revocation results are recorded in [the October 25 report](self-hosted-tunnel-2026-10-25.md).

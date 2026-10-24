# Android release QA — 24 October 2026

This report records local QA of the Expo Android release variant. It describes source and emulator qualification; it is not an APK distribution or store-release announcement. The QA binary, pairing credentials, raw device logs, and screenshots are not published in this repository.

## Build and source gates

The tested release variant uses the isolated application ID ai.bharatcode.bharatcode_mobile.releaseqa, version 0.2.0 (versionCode 1), min SDK 24, target SDK 36, and compile SDK 37. It embeds a Hermes bundle and ran without Metro. The APK SHA-256 is b16fa4987a490606d79fffe047e7c6155be48162199a71bff87b6f2b500b4420. The build used 55 source inputs; the root and managed build-checkout manifests matched with SHA-256 be19503dfd1384dcde915da6dfe7dad19a09cc0aa7d3362311419e81cb5d9b72.

The APK uses a local Android debug certificate for QA, not distribution signing. It is not included in this repository. Installation used the isolated releaseqa package; the existing Flutter and nativeqa applications and their data were preserved.

The original native QA build passed 49 mobile tests across 10 suites, TypeScript, lint, 35 Desktop connector tests, and five helper tests. A subsequent Node-only tooling security backport adds 15 security regressions; current source gates and the GitHub workflow pass those tests and the high-severity npm audit.

The APK described here predates the local `node-forge` backport and retains the artifact hash and source manifest recorded at qualification time. The backport changes Expo's Node-side CLI/code-signing dependency, not mobile app sources; no native rebuild or new APK qualification was performed for it. The QA results below establish the tested mobile runtime behavior, not the vendored tooling implementation. Its scope and verification are recorded in the [Expo mobile verification record](expo-mobile.md).

## Existing Desktop and hosted connection

The app paired with the existing MobileDev Desktop profile and its hosted OpenTunnel path. The existing Desktop sidecar and project data remained authoritative; no second agent or sidecar was started. The matching phone/Desktop confirmation was checked in memory before approval through the existing Desktop IPC.

An uncertain pending message was retried with the same request ID after the connector change. Desktop admitted the stored request once; the isolated fixture retained one user message and one assistant message, without a duplicate or a stale pending restore action.

The final APK displayed incremental text from a real Desktop response. The phone showed answer lines 1–18 at 15:36:38.634Z and lines 45–61 at 15:36:49.516Z, before the Desktop message completed at 15:36:58.076Z. The mobile stream recorded one text-started event, 441 text deltas totaling 3,829 characters, and one text-ended event. Desktop and mobile event streams both returned HTTP 200. This qualifies visible streaming for the tested API 35 emulator and existing Desktop profile.

After testing, the temporary observer pairing was revoked and the final releaseqa pairing was retained with the two pre-existing Desktop devices. The same MobileDev profile was restarted with its normal wrapper and no temporary CDP listener. The release app continued to show the Desktop host online.

## Offline restore and runtime sample

A cold deep link with both emulator network interfaces disabled restored the cached fixture conversation and a saved QA draft in 1.984 seconds. Network connectivity was restored afterward. A later cold launch of the already-paired app reported 204 ms total / 206 ms wait from Android's activity launch measurement; the usable fixture screen was captured 222 ms after launch start. These timings do not include first install, pairing, authentication, or provider response.

A separate background/resume returned the existing Activity in 29 ms without changing the app process or conversation. Force-stop/reopen also returned to the same fixture conversation.

A settled frame sample reset Android gfxinfo, performed eight alternating scroll swipes, and waited 1.5 seconds. It recorded 371 frames, 3 deadline janks (0.81%), and 16 ms at P50/P90/P95/P99. The separate cold-launch sample recorded 30 frames, 8 janky (26.67%), P95 129 ms, and 121,510 KB PSS; it is a different workload from settled scrolling. The settled memory sample measured 135,460 KB PSS, 243,484 KB RSS, and 362 KB swap PSS.

The bounded PID-scoped log scan covered 5,153 lines and found no Java fatal-exception, fatal-signal, ANR, or ReactNativeJS error-severity markers. One ReactNativeJS informational entry was present. Android process-exit records contained no crash or ANR.

## Limits

Testing used an API 35 x86_64 Android Emulator with software rendering. The frame and memory figures are bounded emulator observations, not physical-device smoothness or battery results. Physical Android hardware, iOS, camera scanning, distribution signing, and store delivery were not tested. The QA APK and local debug signing key are excluded from this source repository.

For source performance measurements and regression details, see the [24 October performance audit](performance-2026-10-24.md). For implementation coverage and platform limits, see the [Expo mobile verification record](expo-mobile.md).

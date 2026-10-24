# Expo mobile implementation and verification

Implementation date: 24 October 2026. The Expo/React Native/TypeScript client replaces the former Flutter mobile app. Git history retains the previous client. The Desktop connector and Desktop integration remain in the repository.

## Product boundaries

The only real mobile connection is through the hosted OpenTunnel service to the existing Desktop connector and existing Desktop sidecar. Mobile does not create a second agent, a BharatCode-managed relay, a user account, LAN discovery, or a manual host URL. Desktop remains the owner of provider credentials, repositories, tools, project data, and execution.

Phone pairing is explicitly approved in Desktop. Desktop chats remain server-owned. Drafts and uncertain-send request identities are stored on the phone; Flutter drafts and credentials are not migrated automatically. An offline draft is not silently submitted.

The mobile client provides chat search and paging, streamed replies, tool activity, Markdown/code rendering, reading-position preservation, drafts, model/agent selection, Stop and question controls, read-only project files and diffs, and Activity. The sample client is isolated and cannot pair with Desktop.

## Source changes and verification

The final source changes address streamed-message projection and rendering work, activity discovery concurrency, transactional draft/history persistence, local-first restore and cached offline deep links, route recovery after delayed connection, same-ID admission reconciliation, Desktop compatibility event subscriptions, and bodyless HTTP 204 prompt acknowledgements. The detailed regressions and source performance measurements are in the [24 October performance audit](performance-2026-10-24.md).

Final local gates passed:

- Mobile TypeScript, ESLint, and 49 tests across 10 suites.
- Expo dependency compatibility check.
- Expo Doctor: 20/20 checks.
- Desktop connector suite: 35 tests.
- Linux host-browser helpers: 3 tests.
- Desktop integration generator: 2 tests against the available pinned Desktop source.
- GitHub Actions runs the mobile source/dependency checks, connector suite, and Linux host-browser helper suite on pushes and pull requests.

The fresh `npm audit` and `npm audit --omit=dev` checks each reported four high-severity advisories in the installed Expo CLI/code-signing chain: `expo/node_modules/@expo/cli` → `@expo/code-signing-certificates` → `node-forge` at or below 1.4.0 (GHSA-86w9-cpqp-85rv). The production-only audit still includes this Expo package dependency; it does not establish that the affected CLI tooling ships in the embedded Android app bundle. The offered automatic Expo fix is a major downgrade to Expo 44, so the qualified dependency tree was not changed as part of this release. This audit result is separate from the passing source gates.

The mobile tests cover protocol validation, bounded SSE parsing and projection, durable drafts and outbox behavior, request isolation, question/permission decisions, lifecycle recovery, and key UI interactions. Passing tests establish their covered cases; they do not substitute for native acceptance.

## Final Android release QA

The Android release variant was built from the finalized source inputs and installed under the isolated releaseqa application ID on an API 35 x86_64 emulator. Hermes is embedded; the tested app ran without Metro. A real response from the existing Desktop profile visibly grew on the phone before completion, and the mobile event stream delivered 441 text deltas totaling 3,829 characters. Same-ID uncertain-send recovery admitted the stored request once without duplication.

The final run also verified cached conversation and draft restoration after a cold offline deep link, cold reopen, background/resume, settled scrolling, and the phone reconnecting after a normal Desktop profile restart. The complete metrics and limits are in the [Android release QA report](android-release-qa-2026-10-24.md).

The APK used a local Android debug certificate and is a QA artifact, not a distribution build. It is not committed or published. The final APK was tested only on the emulator.

## Remaining platform coverage

No physical Android handset, iOS simulator/device, camera QR scan, distribution signing, or store delivery was available for this qualification. The visible Desktop Settings approval click was not independently exercised; the fresh phone/Desktop confirmation was verified in memory and the request was approved through the existing Desktop IPC. The emulator's software renderer does not qualify hardware-GPU smoothness.

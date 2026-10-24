# Expo mobile verification

Implementation date: 24 October 2026. Baseline: Flutter repository `3b1b073`; replacement branch `codex/expo-mobile`.

## Source implementation

Expo/React Native/TypeScript is the sole mobile client. Flutter source, tests, native templates, pubspec, and active CI commands are removed. Git retains the previous client. Existing `desktop-connector/` and `desktop-integration/` source/contracts are retained.

Fresh pairing is explicitly approved. Desktop chats remain server-owned. No automatic import of local Flutter drafts or secure-storage records is claimed.

## Local source results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test -- --runInBand`: 36 tests passed across nine suites.
- `npx expo install --check`: compatible dependencies.
- `npx expo-doctor`: 20/20 checks passed.
- Connector `npm test`: 31/31 passed against unchanged source.
- Linux host-browser Python helpers: 3/3 passed.
- Desktop integration generator using local pinned source: 2/2 passed, including repeated application.

## Control inventory and acceptance ownership

| Surface | Controls/behavior | Automated source coverage | Native check |
| --- | --- | --- | --- |
| First launch/pairing | Scan/paste, permission recovery, matching code, approve/decline, cancel/expiry, fresh secure persistence | Payload/origin validation, Add Computer routing | Paste/IPC approval passed; camera QR and visible Desktop approval click unverified |
| Chats | Search, cursor paging, project/device selectors, refresh, new chat | Context isolation, late-page rejection | Real fixture history/search opened; full paging/project/new-chat matrix not separately recorded |
| Conversation | History, streamed text, tool expansion, selectable Markdown/code, copy/fullscreen, reading position/jump | SSE/projection/dedup/window tests | Real reply and keyboard passed; incremental transport probe passed; full-app incremental/reading matrix incomplete |
| Composer | Multiline, clipboard context, Send, Stop, model/agent | Durable ID/admission/failures, Stop wire contract, per-chat labels | Send/Stop passed; model/agent options loaded; selection mutation/context clipboard not separately confirmed |
| Requests | Allow once/Deny, single/multiple/custom question answers, duplicate prevention | Decision payload, single-choice/custom interaction | Two real question answers confirmed; permission decision UI not separately exercised |
| Files/changes | Breadcrumbs, directory/file switch, diff selection, copy, wrap, binary/large/error states | Existing connector confinement tests; typed client/context guards | README file/diff read, wrap and copy passed; full binary/large/error matrix incomplete |
| Activity | Running/attention, refresh, open relevant session | Real discovery service and stale-context protection | Active question, Stop, completed answers and return to All quiet observed |
| Devices/preferences | Restore/switch/add/remove, identity, offline revocation notice, Dark/about | Storage isolation/removal, auth rejection | Reopen/remove passed; revocation produced 401-specific native warning; multiple-computer switch not separately exercised |
| Recovery | Offline edits, explicit retry, process reopen, suspend/resume, Desktop restart | Outbox + queue barriers, generations, bounded events | Draft process reopen and send after Wi-Fi toggle passed; uncertain send same-ID reconciliation passed; full outage matrix incomplete |
| Sample | Labelled, isolated in-memory client, all sample navigation | Preview initialization/service behavior | Native sample launch and browser export passed; isolated sample storage covered in source |

## Review findings resolved in source

Independent review reproduced and implementation fixed: premature Add Computer redirect; cancelled debounce handle suppressing refresh; missing Desktop identity/protocol health check; stale Activity replacing search results; resume using a previous computer's session; successful health retry leaving streams aborted; draft read bypassing queued writes; execution during outbox hydration; and 401 handling omitted from supporting resource/configuration requests. Regression tests cover the safety-critical cases.

## Native qualification

Owned exclusively by the designated `gpt-6-luna` / `max` delegate, including the early transport probe and app packaging/install.

Early native transport probe passed using the actual TypeScript API client with Expo Fetch on Android API 35: incremental fragmented Unicode SSE, AbortController reader release, and authenticated redirect rejection. The redirect target received zero requests. Native timeout checks also passed: header inactivity rejected at 20,020 ms, body inactivity at 21,001 ms, and SSE inactivity at 46,000 ms (native scheduling included). The probe used a separate package and synthetic credential; this does not establish the full app/Desktop flow.

The full app was built and installed on an Android API 35 emulator under an isolated `.nativeqa` package. The original Flutter installation and its data remain intact. Native SQLite/SecureStore initialization, sample Chats/conversation, and real-mode fresh pairing screen launched successfully.

Observed against the **existing MobileDev main-process connector, hosted OpenTunnel, and existing Desktop-owned sidecar/data**:

- Fresh paste pairing passed. Actual phone/Desktop confirmation was compared in memory before approval through existing Desktop IPC. The visible Desktop approval UI click remains unverified.
- A real prompt/reply passed. The first send exposed shared cancellation between event streams and prompt requests. A failing source regression reproduced it; separate stream cancellation fixed it. Native same-ID retry reconciled admission, cleared the pending prompt/draft, displayed the synthetic Desktop reply, and left the Desktop prompt present exactly once.
- The native composer originally sat behind Android's keyboard. Explicit resize and keyboard avoidance fixed this: Send/Stop remain above the IME, and tapping Send with the keyboard open submitted the prompt.
- Native question sheets opened from the real conversation footer. Selecting the safe Cancel option and tapping Send answer completed two pending questions; Desktop confirmed nothing ran or changed.
- Native Stop cancelled an active isolated task. Desktop reported Aborted. After resolving pending questions, Activity returned to All quiet.
- Files listed the isolated project, opened its README, toggled line wrapping, and confirmed Copy file. Working changes opened the fixture README diff, toggled wrapping, and confirmed Copy diff.
- A synthetic unsent draft survived Android force-stop/relaunch and reopening the same conversation without clearing data.
- Model and agent choosers loaded the actual configured Desktop options. Selection mutation is recorded separately from opening the chooser.
- A new native send returned the expected synthetic reply after toggling AVD Wi-Fi off/on. This establishes successful sending after the toggle; a complete transport outage was not separately demonstrated.
- Desktop revoked only the fresh QA pairing, returning to the original two devices with remote access enabled and no gateway error. The native app displayed its HTTP-401-specific authorization warning. No raw status log was retained. Native Remove computer cleared the QA app's sole local computer and returned to the welcome screen.
- Browser sample export passed with all Router paths emitted; this does not prove real browser pairing, which is intentionally unsupported.

The delegated local Android run is complete. Safe screenshots and the detailed native report are preserved in the original workspace at `.local/verification/expo-2026-10-24/native-qualification.md`. The QA build is the debug package `ai.bharatcode.bharatcode_mobile.nativeqa` (minSdk 24, targetSdk 36), using the current JavaScript through Metro. It is not an offline release artifact.

Cleanup was verified by the delegate: normal MobileDev launch restored with the same profile and no temporary remote-debugging flag; ports 8767/9224 closed; only the original sidecar remains; remote access enabled with the two pre-existing devices; QA device revoked/removed; probe fixture/Metro/clipboard bridge stopped; AVD Wi-Fi enabled. The root app Metro server remains available on 8082 for development.

No iOS simulator/device is available on this Linux host. Physical Android/iPhone, camera QR, signed distribution, and store delivery remain unverified. Native incremental transport delivery is proven by the isolated probe above; a completed Desktop reply alone does not establish visible incremental text in the full app.

## Dependency audit

The original Markdown dependencies reported known parser/linkification issues; compatible patched Markdown/linkification versions and Zod are pinned through npm overrides and exercised by source/native checks. Expo CLI's node-forge chain still reports a high-severity upstream advisory with no patched published version at implementation time. It is a Node development-tool dependency; this app does not configure EAS/OTA code signing. No claim of a clean npm audit is made.

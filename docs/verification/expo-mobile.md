# Expo mobile verification

Implementation date: 24 October 2026. Baseline: Flutter repository `3b1b073`; replacement branch `codex/expo-mobile`.

## Source implementation

Expo/React Native/TypeScript is the sole mobile client. Flutter source, tests, native templates, pubspec, and active CI commands are removed. Git retains the previous client. Existing `desktop-connector/` and `desktop-integration/` source/contracts are retained.

Fresh pairing is explicitly approved. Desktop chats remain server-owned. No automatic import of local Flutter drafts or secure-storage records is claimed.

## Local source results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test -- --runInBand`: 33 tests passed across eight suites.
- `npx expo install --check`: compatible dependencies.
- `npx expo-doctor`: 20/20 checks passed.
- Connector `npm test`: 31/31 passed against unchanged source.
- Linux host-browser Python helpers: 3/3 passed.
- Desktop integration generator using local pinned source: 2/2 passed, including repeated application.

## Control inventory and acceptance ownership

| Surface | Controls/behavior | Automated source coverage | Native check |
| --- | --- | --- | --- |
| First launch/pairing | Scan/paste, permission recovery, matching code, approve/decline, cancel/expiry, fresh secure persistence | Payload/origin validation, Add Computer routing | Delegate: QR separate from paste, actual Desktop approval |
| Chats | Search, cursor paging, project/device selectors, refresh, new chat | Context isolation, late-page rejection | Delegate: real server history/search/new chat |
| Conversation | History, streamed text, tool expansion, selectable Markdown/code, copy/fullscreen, reading position/jump | SSE/projection/dedup/window tests | Delegate: incremental text, long response/keyboard/reading |
| Composer | Multiline, clipboard context, Send, Stop, model/agent | Durable ID/admission/failures, Stop wire contract, per-chat labels | Delegate: real execution, selectors, clipboard |
| Requests | Allow once/Deny, single/multiple/custom question answers, duplicate prevention | Decision payload, single-choice/custom interaction | Delegate: actual pending requests/server confirmation |
| Files/changes | Breadcrumbs, directory/file switch, diff selection, copy, wrap, binary/large/error states | Existing connector confinement tests; typed client/context guards | Delegate: actual fixture files/diff |
| Activity | Running/attention, refresh, open relevant session | Real discovery service and stale-context protection | Delegate: actual status/request transitions |
| Devices/preferences | Restore/switch/add/remove, identity, offline revocation notice, Dark/about | Storage isolation/removal, auth rejection | Delegate: reopen, remove and old-token HTTP 401 |
| Recovery | Offline edits, explicit retry, process reopen, suspend/resume, Desktop restart | Outbox + queue barriers, generations, bounded events | Delegate: real platform lifecycle/connectivity |
| Sample | Labelled, isolated in-memory client, all sample navigation | Preview initialization/service behavior | Browser/native visual check, no real credentials |

## Review findings resolved in source

Independent review reproduced and implementation fixed: premature Add Computer redirect; cancelled debounce handle suppressing refresh; missing Desktop identity/protocol health check; stale Activity replacing search results; resume using a previous computer's session; successful health retry leaving streams aborted; draft read bypassing queued writes; execution during outbox hydration; and 401 handling omitted from supporting resource/configuration requests. Regression tests cover the safety-critical cases.

## Native qualification

Owned exclusively by the designated `gpt-6-luna` / `max` delegate, including the early transport probe and app packaging/install.

Early native transport probe passed using the actual TypeScript API client with Expo Fetch on Android API 35: incremental fragmented Unicode SSE, AbortController reader release, and authenticated redirect rejection. The redirect target received zero requests. Native timeout checks also passed: header inactivity rejected at 20,020 ms, body inactivity at 21,001 ms, and SSE inactivity at 46,000 ms (native scheduling included). The probe used a separate package and synthetic credential; this does not establish the full app/Desktop flow.

Full app Android debug packaging/install passed under the isolated `.nativeqa` ID, preserving the original Flutter installation/data. The native bundle launched sample Chats and the real-mode fresh Pair screen with SQLite/SecureStore initialization. Full Desktop acceptance is in progress. Android API 35 emulator is available; Linux host has no Xcode/macOS/iOS runtime. Original Flutter app/data is retained. Probe uses a distinct package and synthetic credentials. No physical Android/iPhone, camera QR, signed distribution, or store delivery claim is made from source tests.

Native outcomes and exact artifact/device identifiers will be appended after the delegated runs. A fixture/probe result does not establish the full Desktop flow.

## Dependency audit

The original Markdown dependencies reported known parser/linkification issues; compatible patched Markdown/linkification versions and Zod are pinned through npm overrides and exercised by source/native checks. Expo CLI's node-forge chain still reports a high-severity upstream advisory with no patched published version at implementation time. It is a Node development-tool dependency; this app does not configure EAS/OTA code signing. No claim of a clean npm audit is made.

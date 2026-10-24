# BharatCode Mobile Expo Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Primary owns implementation; release work follows the delegated boundary below.

**Goal:** Permanently replace Flutter with an Expo/React Native/TypeScript app preserving the selected design and all working mobile features.

**Architecture:** Root Expo application, focused injected services and an external application store. Reuse the unchanged Desktop connector and hosted OpenTunnel protocol; Desktop continues to own all execution/data. Remove Flutter from the supported tree; use Git history for recovery.

**Tech Stack:** Stable Expo with compatible React Native/React, strict TypeScript, npm/Node >=22, Expo Router, expo/fetch, SecureStore, SQLite, Camera, Clipboard, Font, Crypto, SVG, Jest/jest-expo and React Native Testing Library. Native Markdown renderer selected/pinned in Task 1; development-build qualification delegated.

**Spec:** `docs/superpowers/specs/2026-10-24-expo-mobile-design.md`

## Global Constraints

- Mobile targets remain Android and iOS.
- Use only `Mobile -> hosted OpenTunnel -> existing desktop-connector -> existing Desktop sidecar`.
- No mobile account, BC-managed relay, LAN/Tailscale mode, custom URL UI, or provider-key form.
- Visual authority remains `docs/design/assets/selected-conversation.png`.
- Delegate release preparation, packaging, qualification, publishing, and installation to a `gpt-6-luna` subagent with `max` reasoning. Primary implements and supplies source verification evidence.
- Keep source implementation/tests, native packaging, installation, emulator results, physical hardware, and store delivery as distinct claims.
- No dual-client maintenance, framework comparison milestone, or binary-upload/notifications/terminal scope expansion.
- Run local relevant source gates before every push. No publication requested by this plan alone.

## Review Focus

1. A late response after switching computer/session must not display or execute in the new context (Tasks 3–4).
2. Storage/admission failure and app restart must retain recoverable prompt text/identity without duplicate sends (Tasks 2 and 4).
3. Authenticated redirects and malformed origins must never expose device credentials (Task 2, native check Task 7).
4. Fragmented/duplicate events, missing replay, and long disconnects must recover coherent text and history cursors (Task 4).
5. Large messages/files, keyboard, text scaling, and incoming updates must keep reading and controls usable (Tasks 5–7).

## File map

- Root: `package.json`, `package-lock.json`, `app.config.ts`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `metro.config.js`, `.gitignore`, `README.md`, `.github/workflows/ci.yml`.
- Routes: `app/_layout.tsx`, `app/index.tsx`, `app/pair.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/chats.tsx`, `app/(tabs)/activity.tsx`, `app/(tabs)/devices.tsx`, `app/conversation/[id].tsx`, `app/conversation/[id]/files.tsx`, `app/conversation/[id]/changes.tsx`. Keep routes thin; configure explicit initial navigation rather than transient incorrect screens during restore. Index owns restore/redirect; no duplicate root route.
- Shared: `src/domain/types.ts`, `src/domain/decode.ts`, `src/design/tokens.ts`, `src/design/components.tsx`, `src/preview/workspace.ts`.
- Connections: `src/connection/origin.ts`, `pairing-payload.ts`, `transport.ts`, `api-client.ts`, `sse.ts`.
- Persistence: `src/storage/credentials.ts`, `database.ts`, `conversation-store.ts`.
- State: `src/state/app-store.ts`, `react.ts`, `pairing-service.ts`, `sessions-service.ts`, `conversation-service.ts`, `activity-service.ts`, `lifecycle.ts`.
- Features: `src/features/pairing/PairingScreen.tsx`, `ScannerScreen.tsx`; `sessions/ChatsScreen.tsx`; `devices/DevicesScreen.tsx`; `activity/ActivityScreen.tsx`; `conversation/ConversationScreen.tsx`, `Message.tsx`, `ToolPanel.tsx`, `Composer.tsx`, `ConfigurationSheet.tsx`, `QuestionSheet.tsx`, `PermissionCard.tsx`; `files/FilesScreen.tsx`; `changes/ChangesScreen.tsx`.
- Tests: colocated `*.test.ts`/`*.test.tsx`; shared fakes/fixtures in `src/test/`; `e2e/` native flows and `docs/verification/expo-mobile.md` evidence/control inventory.
- Keep: `desktop-connector/`, `desktop-integration/`, `assets/`, existing design docs. Remove Flutter-managed source/config/test/native templates after extracting the behavior inventory in Task 1.

## Common interfaces

Define types once in Task 2; services consume them rather than raw route state:

- `DesktopDevice`: public identity/name/platform/origin/credentialID, no token field in UI snapshots.
- `SessionSummary`, `ChatMessage`, `ToolActivity`, `AgentRequest`: typed normalized existing Desktop wire data, including optional capability fields.
- `Context = { deviceId: string; sessionId: string; generation: number }`.
- `PendingPrompt = { id: string; text: string; state: 'pending' | 'admitted' }`.
- `ApiClient.request<T>(method, path, options?: {body?: unknown; query?: Record<string,string>; signal?: AbortSignal}): Promise<T>`; `events(sessionId, after, signal): AsyncIterable<WireEvent>`; `liveEvents(sessionId, signal): AsyncIterable<WireEvent>`; `close(): void`.
- `ConversationStore.read(deviceId, sessionId)`, `saveDraft(deviceId, sessionId, text)`, `savePending(deviceId, sessionId, prompt)`, `admit(deviceId, sessionId, id, submittedText)`, `clearDevice(deviceId)` are asynchronous. Admission clears only a still-matching draft within the same transaction.
- `AppStore.getSnapshot(): AppSnapshot`, `subscribe(listener): () => void`; injected dependencies include API factory, persistence, credentials, clock/timers and ID generator.
- Service async actions return promises and publish typed loading/error state; React screens do not start network calls during render.

### Task 1: Establish the replacement foundation and feature inventory

**Files:** Root Expo/config files, route shell, design tokens/components, sample fixture; `docs/verification/expo-mobile.md`; remove Flutter files; retain connector/integration/assets.

**Consumes:** Approved spec, current Dart source/tests and design image.
**Produces:** Sole Expo root, reproducible toolchain, design shell, explicit feature/control inventory and native prerequisites.

- [ ] Record every current screen/action and important test scenario with its new owner and acceptance check before removing Dart. Record the pre-rewrite Git revision; preserve unrelated/ignored files.
- [ ] Resolve one stable compatible Expo/React Native/React toolchain, SDK platform floors and native Markdown renderer from primary docs; pin dependencies/lockfile. Use npm and `expo install` for Expo-compatible modules. Do not blindly use an unversioned nightly API.
- [ ] Create strict TS Expo app, test/lint/typecheck scripts and sample mode. Select injected in-memory sample storage/client before initializing real adapters. Test that preview never opens SecureStore/SQLite or hydrates real computers. Sample data must be visibly labelled and use no real API or credentials.
- [ ] Reuse the logo/font files/licenses; implement the exact design tokens, scalable text, root safe areas, reading width, sheets, and thin Router shell.
- [ ] Verify shell rendering, sample/real isolation, route back behavior, font loading error, and large-text layout with focused component tests. Run `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`.
- [ ] Remove `lib/`, Flutter `test/`, `integration_test/`, `test_driver/`, `pubspec.*`, `.metadata`, `analysis_options.yaml`, and tracked Flutter `android/`, `ios/`, `web/` templates. Expo-generated native directories must be derived from config, never overwrite old templates in place. Update local AGENTS.md stack line, keeping it ignored.
- [ ] Review the source diff and checkpoint the foundation in Git; no push.

### Task 2: Implement transport, wire types, pairing validation, and transactional storage

**Files:** `src/domain/*`, `src/connection/*`, `src/storage/*`, corresponding tests/fakes.

**Consumes:** Existing connector contracts; native module adapters from Task 1.
**Produces:** Common interfaces above; `parsePairingPayload(text, nowMs): PairingPayload`, `validateOrigin(value): string`, bounded `decodeSse(chunks): AsyncIterable<WireEvent>`.

- [ ] Write failing tests for valid/invalid pairing origins, payload v1/ID/code/expiry, JSON request methods/bodies/cursors, redirect denial, auth errors, 20s timeouts/16MiB cap, and SSE fragmented UTF-8/CRLF/multiline/1,048,576-character bound. Test real v2 message/session field decoding.
- [ ] Run targeted tests to confirm they fail; implement typed client and decoder against existing endpoints. Pass AbortSignal through every request and stream; use explicit Accept headers and reject redirects before credential forwarding.
- [ ] Write failing storage tests: restart reads pending ID/text, concurrent draft/admission preserves newer text, transaction failure leaves recoverable state, per-device isolation/removal, and SecureStore write/delete failure.
- [ ] Implement SecureStore credential adapter and versioned SQLite schema/transactions. Keep individual credentials out of snapshots/cache/logs; recover metadata inconsistencies without deleting unsent drafts.
- [ ] Run targeted tests and full typecheck. Delegate an early native transport check to `gpt-6-luna` with `max` reasoning and `fork_turns: none`: package/install a minimal development build using the implemented transport, verify incremental delivery, abort and idle timeout, and reject authenticated redirects against a controlled HTTPS fixture with a synthetic credential. Verify both platforms where available, with explicit missing-platform results. No real token goes to the fixture. Resolve any Android transport blocker before building dependent features; iOS remains an explicit open prerequisite if no Mac is available. Full product qualification remains Task 7; primary does not package/install/qualify this probe.
- [ ] Checkpoint the tested domain/transport/storage implementation.

### Task 3: Pair computers, restore connections, and implement the root surfaces

**Files:** pairing/sessions/activity services; app store/React adapter/lifecycle; pairing/scanner/Chats/Devices/Activity features and route wiring; corresponding tests.

**Consumes:** Task 2 API/storage; Task 1 navigation/design.
**Produces:** `pair(text)`, `cancelPairing()`, `connectDevice(id)`, `removeDevice(id)`, `setSearch(text)`, `setProject(project)`, `loadMoreSessions()`, `newChat()` store actions; snapshots for the root screens.

- [ ] Write failing tests for claim/status approval/decline/expiry/cancel, identity mismatch, stale approval after cancel, secure persistence failure, and 401/409 terminal connection rejection without background retry.
- [ ] Implement real scan/paste entry, camera permission and settings recovery, matching-code screen, cancellable polling, saved computers/restore/switch/details/removal, and offline remote-revocation warning.
- [ ] Write failing tests for session cursor/search outside first page, filter/new chat, activity navigation, initial-health retry, stale list/error after device replacement, and preview superseding unfinished real connection.
- [ ] Implement those services/screens with generation guards; derive activity only from actual Desktop state. Add AppState suspension/resumption with owned timers/requests. No hidden tabs inside conversation.
- [ ] Run service/component tests, typecheck, lint. Check sample actions and loading/empty/error/disabled states. Test cold restoration, pairing-success redirect, conversation back navigation and a conversation link whose context must be restored before requests start. Checkpoint.

### Task 4: Build reliable conversation delivery and streaming

**Files:** conversation service, domain projections/cache adapters, lifecycle integration, tests.

**Consumes:** Task 2 types/client/storage; Task 3 selected context and store.
**Produces:** `openConversation(id)`, `loadOlderMessages()`, `setDraft(text)`, `send()`, `restoreUnconfirmedDraft()`, `stop()`, `backToChats()`; coherent message/draft/delivery snapshots consumed by Task 5.

- [ ] Write failing tests for durable pending-before-send, explicit retry reusing ID, navigation during disk save causing no send to either context, admission failure, newer draft preserved, reopen recovery, and confirmed admission surviving history-read failure.
- [ ] Implement the outbox state machine and cache recovery using transactions. Disable send offline; reconnect does not automatically submit text. Stop uses the existing interrupt endpoint, including its empty-body behavior.
- [ ] Write failing tests for duplicate/live delta prefix handling, authoritative history wins, replay absent, event bursts refreshing before quiet, revoked credentials, resume/Desktop restart, contiguous cursor recovery after many new messages, and late requests/failures after switching sessions/computers. Include stream cleanup that never resolves.
- [ ] Implement bounded live/replay subscriptions, deduplication, generation guards, cancellation, refresh coalescing, reconnect and history paging. Abort old work without blocking navigation. Preserve each conversation's selected model/agent labels.
- [ ] Run deterministic tests with fake clocks/streams, typecheck and lint. Checkpoint; do not call mocked-stream success a native networking result.

### Task 5: Implement the conversation design and agent controls

**Files:** conversation screen/components/configuration/request sheets, route wiring, tests.

**Consumes:** Task 4 snapshot/actions plus `configuration(kind)`, `switchConfiguration(kind,id)`, `resolve(request,allow)`, `answer(request,answers)` implemented here using Task 2 request client.
**Produces:** Fully functional conversation/composer/tool/request interface matching the selected design.

- [ ] Write failing component/behavior tests for visible draft sent by Send, real Stop, agent/model selection scoped to session, clipboard context, pending/outcome feedback, malformed/unavailable configuration recovery, and copy actions.
- [ ] Implement compact header/project row/info, user bubbles/open assistant text, safe native Markdown with code/tables/links/selection/copy, expandable tools with stable identity, changes entry, composer and selectors. Preserve reading position; follow incoming text only when near the tail and offer jump-to-latest otherwise.
- [ ] Write failing tests for single/multiple/free-text questions, invalid incomplete sets, answer retention during disconnect, exact permission scope, duplicate-tap prevention, requests already resolved on Desktop, and network uncertainty without silent decision replay.
- [ ] Implement question/permission UI with server-confirmed outcomes and synchronized Activity state. Do not invent persistent permissions or unsupported attachments.
- [ ] Test narrow phone and 200% type, multiline keyboard composer, huge code/table content, scroll/read position and accessible labels. Compare composition to the selected image; use real content counts/status. Run component/service tests, typecheck and lint. Checkpoint.

### Task 6: Complete files, changes, documentation, and local source gates

**Files:** files/changes features and routes/tests; root scripts/README/workflow; verification inventory; existing helper/connector tests.

**Consumes:** Selected context/client and shared code rendering.
**Produces:** `loadFile(path)` and `loadChanges()` actions; complete read-only project navigation/diff interface; sole Expo documented workflow.

- [ ] Write failing tests for directory breadcrumbs, file switch, wrap/scroll/copy, real diff path/counts and line markers, large/binary/unavailable states, and stale responses after navigating away.
- [ ] Implement files/changes using unchanged authorized connector endpoints. Render read-only data with bounded content and explicit errors; no new commit/push/revert affordances.
- [ ] Update README and workflow to Expo typecheck/lint/tests plus existing connector/Python checks. Document fresh pairing/local Flutter draft limitation, native prerequisites, sample mode, version pins, and distinct verification results. Remove remaining active Flutter instructions and ignored tooling assumptions without deleting user data.
- [ ] Run `npm ci`, `npx expo install --check`, `npx expo-doctor`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`; in `desktop-connector/`, run `npm ci`, `npm test`; run `python3 -m unittest discover -s desktop-integration/linux-host-browser -p 'test_*.py'` and `python3 -m unittest discover -s desktop-integration -p 'test_apply.py'` with `BHARATCODE_DESKTOP_SOURCE` set to an existing compatible source when available. Report unavailable prerequisites/skips explicitly.
- [ ] Review all current controls against the feature inventory, fix omissions, run `git diff --check`, and inspect tracked source/artifacts for secrets, missing licenses, leftover Flutter tooling and unrelated changes. Do not push before source gates pass.
- [ ] Prepare a concrete source-verification handoff with commit/diff, commands/results, unresolved limitations, Desktop fixture and platform prerequisites. Checkpoint.

### Task 7: Delegate native packaging, installation, and qualification

**Owner:** A subagent explicitly configured `model: gpt-6-luna`, `reasoning_effort: max`, `fork_turns: none`. Primary must not do these operations. Supply the approved spec/plan and concrete source evidence; do not rely on inherited context.

**Files:** `e2e/` native acceptance flows and `docs/verification/expo-mobile.md` evidence; packaging config only as needed. Primary may implement test flows/fix source; delegate performs packaging/install/qualification.

**Consumes:** Task 6 tested source; compatible existing Desktop sidecar and hosted tunnel; available SDK/device/signing prerequisites.
**Produces:** Separately labelled Android emulator/device, iOS simulator/device, camera QR, native transport/security/storage, and packaged-artifact results with exact limitations.

- [ ] Delegate local native development build packaging/install without EAS account dependency. Preserve installed data/signing constraints; explain fresh pairing before replacing an existing installation. Do not uninstall/clear data as a workaround.
- [ ] Have the delegate test native authenticated redirect rejection, fragmented streamed replies before completion, abort/idle timeout, secure storage failure recovery, background/foreground, and process reopen. Do not relax hosted-origin or connector browser policy.
- [ ] Have the delegate exercise actual Desktop pairing/approval, chats/search/pages/projects/new chat, model/agent, requests, send/Stop, files/diffs/copy, draft restart, connectivity/Desktop restart, switching devices and revoke/old-token 401. Use an isolated Desktop project; camera QR is separate from paste pairing.
- [ ] Have the delegate inspect narrow Android/iPhone screenshots, keyboard/safe areas, larger type, reduced motion, screen-reader traversal and every interactive control in the inventory. Record hardware/OS/build identity and observed outcomes.
- [ ] Primary resolves implementation failures, reruns relevant source tests and hands off new source for affected delegated checks. Keep outstanding platform prerequisites visible; never infer iOS or physical-phone success from emulator results.
- [ ] Finish with Expo as the sole supported app and a clear source/native verification report. Publishing to GitHub/stores or signed distribution is a separate authorized release action, handled by the same required delegation model.

## Plan review and execution

This planning turn creates documents only. User review comes before implementation because they requested a plan first. Proposed execution: primary implements the tasks inline; the required Luna/max delegate owns native packaging/install/qualification and any later authorized release work. No repeated old/new comparison checkpoints. Fresh pairing is the only proposed visible migration compromise and is called out for review.

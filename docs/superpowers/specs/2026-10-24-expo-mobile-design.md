# BharatCode Mobile: permanent Expo replacement

Status: approved by the user on 24 October 2026, including permanent replacement and fresh pairing.

## Intent and decisions

Replace the Flutter mobile client permanently with React Native, Expo, and strict TypeScript. Rebuild cleanly where useful; do not translate Dart widget-for-widget, maintain two clients, or make comparing implementations a project milestone. Keep the selected design and every working current feature. Desktop remains the owner of agents, tools, providers, credentials, repositories, execution, and conversations.

The user explicitly selected Expo/TypeScript and rejected a temporary side-by-side migration. The proposed execution is a direct replacement in this repository, with Flutter recoverable through Git history. There is no alternative framework decision left to make.

The original Flutter-only line in local AGENTS.md is superseded by the user's 24 October 2026 instruction. Update that local guidance during implementation without publishing agent instructions.

## Constraints

- Mobile targets remain Android and iOS.
- Use only `Mobile -> hosted OpenTunnel -> existing desktop-connector -> existing Desktop sidecar`.
- Keep `desktop-connector/` and `desktop-integration/`, their public contracts, and their tests. Do not embed their Node runtime in the phone or create another agent/server.
- No mobile account, BC-managed relay, LAN/Tailscale mode, custom URL UI, or provider-key form.
- Visual authority remains `docs/design/assets/selected-conversation.png`. Follow `docs/design/SCREEN-EXPERIENCES.md` for supported interactions; aspirational features in that document do not become new scope.
- Keep source implementation/tests, native packaging, installation, emulator results, physical hardware, and store delivery as distinct claims.
- Delegate release preparation, packaging, qualification, publishing, and installation to a `gpt-6-luna` subagent with `max` reasoning. Primary implements and supplies source verification evidence.
- No dependency installation, scaffolding, product edits, build, installation, or publication in the planning turn.

## Approach and layout

Make the repository root the Expo app. Retain `assets/`, `docs/`, `desktop-connector/`, and `desktop-integration/`. Remove Flutter source, native templates, manifests, dependency files, test runners, and Flutter CI references as part of the replacement; Git retains the old client. Do not relocate it into a maintained legacy folder. Preserve unrelated workspace files and ignored local data.

Use Expo Router for the root Chats/Activity/Devices tabs and conversation/files/changes stack. `app/index.tsx` owns initial restoration/redirect; the Chats tab uses `app/(tabs)/chats.tsx` to avoid duplicate root paths. Conversation hides the root tabs. Keep route parameters limited to identifiers; tokens and pairing payloads never enter URLs. A conversation link must resolve its saved computer/session context before starting any request.

Use a small injected TypeScript application store exposed through React's `useSyncExternalStore`, with separate pairing, sessions, conversation, and activity services. Keep network, persistence, clocks, IDs, and lifecycle injectable so the hard behaviors can be tested without a phone. Do not reproduce the 1,200-line Dart controller as one React component or hook.

Use Expo's compatible React Native/React versions and pin the resolved stable SDK and lockfile at execution. Node 22 or newer, npm, strict TypeScript, ESLint, Jest/jest-expo, and React Native Testing Library. Use Expo Camera, SecureStore, SQLite, Clipboard, Font, Crypto, safe-area-context, and react-native-svg. Use a maintained native Markdown renderer with disabled raw HTML and controlled external links, selected and pinned in Task 1 after compatibility checks. No WebView chat UI.

Use explicit `expo/fetch` imports for ordinary JSON requests and readable streamed responses. Implement a small bounded SSE decoder for the existing wire format, with AbortController ownership and cancellation. Before relying on it, verify native redirect rejection with Authorization headers, idle timeout, UTF-8 chunking, and abort semantics. A transport that follows redirects with credentials is unacceptable; fix the transport choice rather than relaxing connector policy.

Use SecureStore per computer credential, not one unbounded JSON array. Keep computer metadata, caches, drafts, pending prompt IDs, and admission state in SQLite; credentials stay out of SQLite and logs. Transactions own draft/outbox updates. No destructive reset on storage failure. Surface a recoverable error and retain unsent text.

Native development builds are the acceptance target. Expo Go and browser sample mode may aid development but do not establish native networking/camera/storage correctness. Browser sample mode injects in-memory storage and a fake client before any native credential/database initialization; it never hydrates real devices or opens SecureStore/SQLite. No EAS cloud build, OTA service, Expo account, or paid service is required for the app's runtime.

## Current feature inventory

| Area | Required behavior | Current source reference |
| --- | --- | --- |
| Pairing | Scan QR or paste payload; camera denial recovery; matching code; Desktop approval/decline; expiry, cancel, retry; persist approved computer | `lib/features/pairing_screen.dart`, `lib/controller.dart:1025` |
| Computers | Restore saved computers, switch, add, inspect identity/status, remove locally and revoke when reachable; explain offline revocation uncertainty | `lib/features/sessions_screen.dart`, `lib/controller.dart:825`, `:1120` |
| Chats | Search with server search/cursors, load more, filter by project, create chat with existing Desktop configuration, open existing chat; loading/empty/error/retry | `lib/features/sessions_screen.dart`, `lib/controller.dart:869`, `:987` |
| Conversation | Paged history, user/assistant Markdown, selectable/copyable text/code, tool inputs/results, reading position and jump-to-latest, session/project information | `lib/features/conversation_screen.dart`, `lib/models/models.dart` |
| Composer | Multiline draft, clipboard context, Send, Stop, real model/agent selection, per-session labels, editing while running, offline send disabled | `lib/features/conversation_screen.dart`, `lib/controller.dart:473`, `:662`, `:767` |
| Delivery | Durable pending prompt identity, clear only on confirmed admission, restore uncertain text, explicit retry with same identity, preserve a newer draft | `lib/connection/device_store.dart`, `test/controller_test.dart` |
| Updates | Live deltas plus authoritative history, replay when available, deduplication, reconnect, initial-health recovery, suspend/resume, revoked-access handling | `lib/controller.dart`, `test/controller_test.dart` |
| Requests | Allow once/Deny with exact command/resource and directory; question choices, multi/single and free text, complete answer set; disable duplicate decisions | `lib/features/question_sheet.dart`, `lib/features/conversation_screen.dart` |
| Changes/files | Real working-tree diff list, file switching, marked diff lines, source viewing, directory navigation, wrap/scroll, copy; large/binary/error states | `lib/features/changes_screen.dart`, `lib/features/files_screen.dart` |
| Activity | Running and needs-attention entries from Desktop, navigate to chat/request, synchronize confirmed decisions | `lib/features/sessions_screen.dart`, `lib/controller.dart:921` |
| Appearance/sample | Warm dark appearance and about sheet, bundled brand/fonts/licenses; clearly labelled sample workspace, functional sample controls isolated from real data | `lib/design/theme.dart`, `lib/app.dart`, `lib/controller.dart:133` |

The current attachment button offers clipboard text/file references, not binary uploads. Preferences currently show Dark/about information; do not turn this rewrite into a new preferences product. Notifications, terminal, arbitrary uploads, new git write actions, pin/archive/rename/fork, and unsupported design-document ideas are excluded. Do not fabricate backend capabilities or live progress.

## Design preservation

Preserve warm canvas `#181817`, surfaces `#242422`/`#2D2D29`, text `#F2F0E9`, muted `#B9B9B0`, orange `#FF6933`, actual BC logo, Inter and JetBrains Mono. Use the current theme for supported semantic states and the selected image for composition. Match the compact header, project row, understated prompt bubbles, open assistant text, code/tool panels, changes summary, composer, model/agent controls, and rounded sheets.

Use logical dimensions, safe areas, keyboard avoidance, native back behavior, scalable type, accessible names/states, redundant status icons/text, reduced motion, and adequate touch targets. Preserve the 720-logical-pixel reading width on wide displays. Validate with real screenshots and interaction checks; do not copy generated sample code/counts from the image as real data.

## Protocol and correctness requirements

Preserve existing pairing v1 JSON fields and desktop identity check. HTTPS subdomains of `opentunnel.xyz` only; reject bare domain, credentials, non-443 ports, non-root paths, query, fragment, lookalike suffixes, and invalid/expired payloads. Explicit 443 and trailing slash normalize like the current parser. Payload lifetime cannot exceed six minutes; code is 43 URL-safe characters, desktop ID matches `pc_[A-Za-z0-9_-]+`.

Keep current endpoints/methods/payloads and compatibility decoding from `lib/connection/api_client.dart`, controller calls, and `desktop-connector/src/desktop-api.mjs`. Distinguish ordinary JSON Accept from SSE Accept as required by the unchanged gateway. Preserve 20-second request/body inactivity limits, 45-second stream idle timeout, 16 MiB JSON response cap, and bounded SSE events matching the current 1,048,576-character limit. Test fragmented UTF-8/CRLF/multiline data, not just whole events.

Each async operation belongs to a computer/client generation and, where relevant, a session/search generation. Abandoned responses, failures, and subscriptions cannot mutate the replacement context. Switching must not wait indefinitely for old stream cleanup. Deduplicate live events; authoritative history replaces provisional content. A server without replay still works through live events and history refresh. A reconnect resets to a contiguous message window/cursor rather than splicing discontinuous history.

Persist the outgoing ID/text before network send. Never automatically send an offline draft, replay an uncertain permission decision, or send a prompt to a newly selected computer/session after a delayed disk write. An admitted prompt stays admitted even if the next history refresh fails. 401 disables execution controls immediately and offers re-pairing. Terminal pairing/authentication conflicts do not trigger background retries.

## Existing installations and data

Proposed default: this development-stage framework replacement uses a fresh mobile store and re-pairing. Do not promise transparent reading of FlutterSecureStorage/SharedPreferences through Expo modules. Desktop chat/history remains available after pairing; unsent local Flutter drafts are not automatically imported. Explain this before an existing installation is replaced; never uninstall/clear app data to make a test pass. Leave old data untouched where the OS preserves it.

Keep the existing product identifiers in source (`ai.bharatcode.bharatcode_mobile` Android, `ai.bharatcode.bharatcodeMobile` iOS). Whether a built artifact can update an installed app depends on signing/provisioning and is a delegated packaging check, not an implementation assumption. Do not add a custom native storage bridge unless the user requires old local-data import.

## Verification and completion

Implement behavior-focused tests for the new client, using the existing tests as requirements/evidence of known failure modes, not a line-by-line port or old/new comparison exercise. All current controls must work in the new app. Keep connector and Desktop helper checks. Run local gates before any push; no push/PR requested in this planning turn.

The delegated native qualification covers the actual hosted tunnel and existing Desktop: pair/approve, chat/send/stream, search/project/history pages, new chat, model/agent, questions and permissions, Stop, files/diffs/copy, reopen with draft, switch computers, lost network/resume/Desktop restart, and remove/revoke with old token receiving 401. Camera QR and physical iOS/Android remain explicit separate results. Use an isolated Desktop test project for real prompts/commands.

Expo becomes the sole supported mobile app with root documentation/CI/scripts updated and Flutter removed. Do not declare Android and iOS verified from a browser preview or unit tests. If native platforms/hardware are unavailable, complete source work and report those checks as blocked/unverified with the exact prerequisite.

## Documentation references consulted 24 October 2026

- Expo streaming Fetch API: https://docs.expo.dev/versions/latest/sdk/expo/
- SecureStore platform/storage limits: https://docs.expo.dev/versions/latest/sdk/securestore/
- Native development builds: https://docs.expo.dev/develop/development-builds/introduction/

## Builder choices and approval

Proposed implementation choices: root replacement; Router; injected external store/services; SQLite for transactional local state; SecureStore per credential; expo/fetch; fresh pairing instead of a custom Flutter-data importer; local native builds. The user has chosen the permanent Expo/TypeScript direction and preserved product boundaries. These implementation choices are submitted together for review before code.

# Native acceptance flows

These flows require an installed native development build. A browser/sample run never counts as Desktop acceptance. The release delegate owns packaging, installation, and qualification in this workspace.

`sample.yaml` is a Maestro smoke flow for a bundle built with `EXPO_PUBLIC_BC_PREVIEW=1`. It checks only labelled sample navigation/send/files/diffs. It is supplied as a reusable flow; a checked-in YAML file is not evidence it was run. For a QA package suffix, override its `appId` to the actual installed QA package. Keep production IDs in app.config.ts.

For real Desktop acceptance, omit the preview environment variable, use the existing Desktop sidecar with mobile integration, and prepare an isolated project with a tracked README change and a conversation titled `BC Mobile qualification baseline`.

1. Pair using a current Desktop QR or full pasted payload. Confirm matching code and explicitly approve in Desktop; force-close/reopen and verify the saved computer. Record camera scanning separately from paste pairing.
2. Open the baseline conversation. Send a harmless request in the fixture; observe reply text before completion. Verify the same prompt/reply appears on Desktop.
3. Search, page chats/history, select projects, create a chat, choose actual configured agents/models, and return to the baseline. Never assume sample data demonstrates provider availability.
4. Trigger a bounded permission/question task only in the fixture. Verify Allow once, Deny and complete single/multiple/custom answers, confirmed by Desktop; failed or uncertain network requests remain visible.
5. Send a bounded long-running fixture request, tap Stop, and verify Desktop reports idle.
6. Browse real fixture files and working-tree changes. Exercise breadcrumbs, file selection, wrapping, copy, binary/large-file states, and a missing-file retry.
7. Save a distinct draft, force-close/reopen without clearing data, and verify exact text. Interrupt connectivity/foreground the app and restart Desktop; verify recovery without silently sending drafts or duplicating prompts.
8. Read older messages during incoming text, then Jump to latest. Check keyboard/safe areas, narrow phones, landscape, 200% text, reduced motion, labelled controls and screen-reader traversal.
9. Remove the QA computer pairing through the UI and verify its prior token now returns HTTP 401 when Desktop was reachable. Do not publish the credential. Re-pair if needed for a final screenshot; remove only disposable QA credentials.

Record the exact app package/build, Desktop identity/source, emulator or hardware, renderer, observed outcome, and any unavailable prerequisite in `docs/verification/expo-mobile.md`. Keep local screenshots/logs/short-lived payloads in ignored `.local/`; never commit tokens, pairing payloads, or signing material.

# Self-hosted tunnel integration plan

> **For agentic workers:** Use superpowers:executing-plans. Primary implements; mandated gpt-6-luna/max delegate owns packaging and runtime qualification.

**Goal:** Connect the existing Mobile client to the existing Desktop sidecar through https://tunnel.bharatcode.ai, using explicit Desktop-approved pairing.

**Architecture:** Keep the loopback mobile gateway, route allowlist, device verifier registry and existing sidecar. Run the OpenTunnel SDK in Desktop main with its API explicitly selected and private persistent identity/certificate storage. Pairing links contain public Desktop identity/origin only; authorization requires a short-lived pairing window, matching confirmation on both screens, explicit Desktop approval and a device token delivered in an HTTPS response body.

**Tech Stack:** Existing Expo/React Native/TypeScript, Electron/Solid, Node >=22, @opentunnel/client 0.5.2.

**Spec:** User's 2026-10-25 instructions and bharatcode-tunnel fe7dfa73b35ebb035ba42a62482ec230a7e1a8bf packages/client/README.md and docs/trust-boundary.md.

## Global constraints

- No account requirement, alternative transport, API/Chat service change, second agent, AWS/ZeroSSL credentials, or release publication.
- The routed gateway requires application authentication regardless of loopback peer, Host or forwarding headers; never route the sidecar directly.
- No device tokens, sidecar credentials or pairing claim secrets in URLs, logs or cookies. Use credential-free deep links and native credential storage.
- Preserve selected Mobile design and Desktop localization/main-preload-renderer boundaries.
- User authorized completion, separate Desktop/Mobile PRs and push after verification; keep qualification claims exact.

## Review focus

- Host/forwarding-header spoofing and browser origins cannot bypass authentication or reach local management endpoints.
- Expired/replayed/declined claims and revocation during streaming cannot grant or retain access.
- Starting/slow certificate issuance can be cancelled; progress remains visible without blocking status reads.
- Desktop restart retains the same tunnel/certificate and device credentials; disabled remote access stays disabled.
- Deep links reject credentials, malformed hosts, duplicate parameters, unexpected fields and expired pairing windows.

## Task 1: Tunnel policy and lifecycle

Files: desktop-connector/src/{policy,tunnel,desktop-access,index.d}.mjs (declarations index.d.ts), desktop-integration/{mobile-types,mobile-english,settings-mobile}.tsx/ts; connector tests.
- [x] Add failing allowlist, SDK API/progress/storage/cancellation and restart/disable tests.
- [x] Select only HTTPS tenant hostnames under tunnel.bharatcode.ai; reject upstream and malformed origins.
- [x] Explicitly configure SDK API; provision with progress callbacks before connecting; private persistent identity; cancellable creation.
- [x] Expose connected/reconnecting/provisioning/off/error status and separate disconnect, unpair, and tunnel reset controls.
- [x] Verify full connector suite.

## Task 2: Credential-free pairing links and mobile transport

Files: src/connection/{pairing-payload,api-client}.ts, app/pair.tsx, src/features/pairing/PairingScreen.tsx, desktop-connector/src/gateway.mjs and related tests.
- [x] Add failing tests for public pairing links, active pairing windows, pending claim bounds, approval and revocation; retain JSON scan compatibility.
- [x] Encode only origin and Desktop identity in bharatcode://pair links; open links at pairing screen and submit claim by POST only.
- [x] Allow public link enrollment only during an explicitly opened pairing window, with bounded pending attempts and explicit matching-code Desktop approval. A link never grants API access.
- [x] Omit ambient cookies in native fetch and retain redirect rejection; distinguish offline/reconnecting/revoked states.
- [x] Verify mobile typecheck/lint/security/full tests and connector tests.

## Task 3: Current Desktop integration and security review

Files: desktop-integration/apply.py, desktop-integration/test_apply.py and generated Desktop package/app/main/preload integration in isolated .local/tunnel-desktop, based on current origin/dev.
- [x] Apply integration to current Desktop revision without unrelated sidecar/product-policy changes.
- [x] Test trusted main-frame IPC, idempotent generator, localized settings, app/desktop typechecks and package suites.
- [x] Run an independent whole-diff correctness/security review against the tunnel trust boundary; fix actionable findings with regressions.

## Task 4: Qualification and delivery

- [x] Hand concrete implementation and source results to mandated qualification delegate.
- [x] Delegate tests live HTTPS pairing, authenticated requests/streaming, negative auth/Host/cookie boundaries, reconnect, isolated Desktop restart and revocation; report any unavailable native/physical verification.
- [x] Record exact evidence and limitations, review diffs for secrets/unrelated changes.
- [ ] Commit and push focused branches; create and attach separate Desktop and Mobile PRs. No merge or release publication.

## Execution record

- Primary implemented the connector, Mobile link/transport changes and current Desktop integration; the user authorized implementation and push after verification.
- Source baselines passed 49 Mobile and 35 connector tests. The final implementation passes 53 Mobile tests, 15 security regressions, and 44 connector tests, plus Mobile lint/typecheck, Desktop/app typechecks, 168 Desktop tests, two generator and three browser-helper tests.
- Independent review: no actionable auth bypass; reset could await unfinished issuance, and phone-initiated unpair left a stale Desktop list. Both were reproduced then fixed with regressions. The stale-list issue was treated as functional correctness because a revoked phone must not remain presented as paired.
- Migration regression: a dedicated service identity directory prevents replaying upstream credentials to the self-hosted API.
- Existing app-suite failure reproduced on clean Desktop base: 748 pass, one i18n parity failure for four unrelated ui.message.outputLimit keys. Keep this visible in verification/PR evidence; do not change UI/session copy or suppress the test.
- Shared English fallback follows the existing BharatCode locale mechanism; additional languages require reviewed translations.

- Final hosted/native qualification: first issuance and certificate reuse, real-sidecar stream revocation, actual Electron restart with identical persistent identity, Android emulator saved-credential restart/network recovery and revoked UI. Visible signed-in Desktop settings, physical camera/iOS and native incremental text rendering remain separate, unverified tiers.

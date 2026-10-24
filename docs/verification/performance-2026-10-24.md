# Mobile performance and reliability audit — 24 October 2026

Baseline: `b3a481f8adda120ec0be747fb43893d1df6b7055` (Expo 0.2.0). The fixes described here were implemented and regression-tested against that pre-fix source. The existing Desktop sidecar and hosted OpenTunnel remain the connection path.

## Reproduced and resolved in source

1. Every live text update decoded all loaded messages again, including tool inputs/outputs. Decoded messages now use a weak cache; a changed live reply invalidates its own entry. Authoritative page updates compare all rendered text/tool fields, retaining unchanged identities and replacing changed content.
2. Typing into the composer rerendered completed replies with new Markdown renderer props. A memoized message component now skips those renders. A regression test observes the actual Markdown parser: three keystrokes previously caused three additional parses; they now cause zero.
3. Activity discovery checked projects sequentially. It now checks up to three projects concurrently, with at most six requests at once. A deterministic latency test with five projects and 25 ms requests previously completed at 150 ms; it now completes at 75 ms, with the same running/attention results.
4. Draft saves parsed and rewrote all cached history for every keystroke. History now lives in a separate cache record; queued transactions preserve draft/outbox ordering, and older embedded-history records migrate atomically on the next update. Tests cover restart, device removal, admission, legacy records, and rollback/retry when either migration write fails.
5. Cold start waited for remote connection health before exposing the restored computer through the app provider. Local restoration now finishes before that request, with health/session loading continuing in the background and a loading state in Chats. A deferred-health regression reproduced the original startup barrier; the fix and its asynchronous lifetime passed independent review. This source test does not substitute for the native offline cold-start check below.
6. A conversation route mounted before credential restoration could remain empty after the connection became ready. Its loading effect now retries on connectivity changes, while navigation cleanup is separate. Failing component regressions covered delayed initial connection and offline cached history/draft hydration; the final fix preserves both, and independent review passed.

7. The release emulator reproduced an additional cold offline deep-link failure: remote session metadata was required before reading local history. History cache now includes its session summary and is restored before credential/network readiness, with a legacy-cache fallback and normal reconnection afterward. A new cold AppStore regression holds credentials unresolved and verifies the cached title, reply and durable draft.
8. Desktop could persist and execute a user message while leaving its async HTTP acknowledgement pending. Admission now probes the durable matching message concurrently, acknowledges it without waiting for that HTTP response, and never forwards an uncertain ID again. A stalled-acknowledgement regression reproduces the old failure.
9. Desktop live subscriptions used the modern event endpoint while prompt execution/history used its compatibility engine. The connector now subscribes to that engine's project-scoped `/event` stream. A gateway regression requires an actual projected compatibility text delta before history refresh, and failed against the old route.

10. A real Desktop async prompt returns HTTP 204 with a null response body. The connector previously attempted to iterate that body and returned HTTP 500 even after the engine stored the prompt. Its upstream response adapter now handles bodyless success before reading chunks. A real HTTP integration test with delayed message storage failed with 500 before this fix and now returns 200; independent review passed.

11. The compatibility live projector mislabeled initial empty text-part creation as text-ended, causing the first observer to stop before the answer streamed. Full raw/mobile correlation proved all 227 deltas and 1,791 answer characters arrived before completion. Creation now emits text-started; text-ended requires the part's completion timestamp. A trace-shaped regression failed before this fix, and the 35-test connector suite and independent review pass.

Performance, startup, admission and stream regressions were run against the earlier implementation and failed before their corresponding fixes. The delayed-cache/unmount regression also failed against the preceding cleanup condition before matching opening-intent cancellation was added. Independent source review found no actionable correctness regressions, including after the authoritative-refresh identity fix.

The subsequent storage change also passed independent review after the host restart. Supplemental checks covered cache-replacement migration failures, concurrent queued draft/cache/admission work, device isolation, and rollback during device removal; no important findings were reported.

## Source CPU benchmark

Run `node scripts/benchmark-mobile.cjs` from the repository root. This runs the actual TypeScript projection code on Node v24.19.0 with synthetic completed replies and tool results, seven repetitions per size, 200 streamed deltas per repetition. Measurements below are median total CPU-path wall times, rounded. Initial history construction is outside the timed section.

| Loaded messages | Before | After |
| --- | ---: | ---: |
| 50 | 14.47 ms | 0.75 ms |
| 500 | 120.11 ms | 2.96 ms |
| 2,000 | 466.98 ms | 9.83 ms |

This measures projection and decoding on the development host. It excludes network transport, periodic history refreshes, Markdown parsing, Hermes, native layout, and frame rendering. It establishes reduced source processing cost, not a phone FPS improvement or a release startup result. Refresh identity reuse and composer parser avoidance have separate regression tests.

The public report records the summarized source measurements and their scope; raw development-host benchmark captures are not part of this source repository.

The draft-storage benchmark (`node scripts/benchmark-storage.cjs --baseline`, then without `--baseline`) exercises the actual storage code over MemoryDatabase. The baseline script reads the fixed b3a481f8adda120ec0be747fb43893d1df6b7055 version, independent of the current HEAD. In the original five-run measurement, 1 MB of cached history and 100 durable draft edits took a median 138.47 ms before and 0.26 ms after; data written fell from 100,011,450 bytes to 6,250 bytes. After pinning the script to the pre-fix commit, a separate refreshed five-run measurement produced medians of 119 ms before and 0.20 ms after, with the same byte counts. These are distinct host runs, not a replacement of the original measurement. Restored draft, history and sequence are checked after each run. This excludes native SQLite and flash latency. The new write-amplification regression failed before the fix (three edits wrote 3,000,198 bytes); additional migration tests verify compatibility and transactional recovery. The measurements are summarized here; native SQLite and flash latency are not represented.

## Source verification

- `npm run check`: TypeScript, ESLint without warnings, 49 mobile tests across 10 suites, and 15 node-forge security regressions passed.
- Expo dependency compatibility and Expo Doctor (20/20 checks) passed.
- `npm audit --audit-level=high` and `npm audit --omit=dev --audit-level=high`: no known advisories for the resolved dependency tree. Registry audit metadata does not analyze the local node-forge backport; its patch, regression coverage, and scope are documented in the [Expo mobile verification record](expo-mobile.md).
- `npm test --prefix desktop-connector`: 35 tests passed.
- Linux host-browser helpers: 3 tests passed.
- Desktop integration generator: 2 tests passed against the available local Desktop clone.
- `git diff --check`: passed.

Existing tests cover context isolation, uncertain delivery and same-ID admission, draft durability, revoked credentials, request decisions, stream cancellation, fragmented Unicode SSE, bounded event frames, file confinement, and connector integration. Passing tests establish those tested cases; they do not exhaust every device or network condition.

## Final Android release qualification

The isolated Android release variant, `ai.bharatcode.bharatcode_mobile.releaseqa` v0.2.0, was built from all 55 finalized source inputs with Hermes embedded and no Metro dependency. The APK is 130,378,625 bytes, SHA-256 `b16fa4987a490606d79fffe047e7c6155be48162199a71bff87b6f2b500b4420`. Root and release-checkout manifests match (SHA-256 `be19503dfd1384dcde915da6dfe7dad19a09cc0aa7d3362311419e81cb5d9b72`). It uses a local debug certificate for QA only and is not a distribution artifact.

The final app paired to the existing MobileDev sidecar through hosted OpenTunnel and visibly rendered a real Desktop response as it streamed. The phone showed answer lines 1–18 at 15:36:38.634Z and lines 45–61 at 15:36:49.516Z, before message completion at 15:36:58.076Z. The mobile stream recorded one text-started event, 441 text deltas (3,829 characters), and one text-ended event. Same-ID pending delivery reconciled once without duplication. After the temporary observer was revoked and the same Desktop profile restarted without CDP, the final release app still showed the host online.

With both emulator network interfaces disabled, a cold deep link restored cached conversation history and a saved QA draft in 1.984 s. Force-stop/reopen and background/resume also returned to the fixture conversation. The separate settled eight-swipe sample captured 371 frames, 3 deadline janks (0.81%), P50/P90/P95/P99 of 16 ms, and 135,460 KB PSS / 243,484 KB RSS / 362 KB swap PSS. A separate cold-launch capture measured 30 frames and 8 janks (26.67%), with P95 129 ms and 121,510 KB PSS; it is a different workload and should not be compared to settled scrolling.

The bounded PID-scoped final scan covered 5,153 log lines and found no Java fatal, fatal signal, ANR, or ReactNativeJS error-severity markers; one informational ReactNativeJS entry was present. Emulator measurements used software rendering and do not establish physical-device smoothness. Physical Android, iOS, camera scanning, distribution signing, and store delivery remain unqualified. The complete published summary of artifact, stream, offline restore, runtime metrics, and limits is in the [final Android release QA report](android-release-qa-2026-10-24.md).

# BharatCode review follow-ups

**Goal:** Address Shrey's Desktop #60/#59 and Mobile #1 feedback without publishing or replying before user approval.

**Architecture:** Mobile owns the connector source; synchronize the Desktop copy and verify the pinned generator. Explicit reset quarantines invalid admissions state and persists a recovery marker before moving any journal. Existing conversations cannot forward unknown prompts after recovery; matching stored messages can reconcile. New conversations created through the connector use random identities recorded durably in the replacement journal. Healthy admission journals survive reset. Support #59 remains the sole exporter, with adversarial fixtures adapted from #67/#68 and attribution.

**Constraints:** Existing Desktop sidecar and hosted OpenTunnel only. No new relay or connection flow. Source verification is separate from packaged/native/physical verification. No PR, push, or posted reply before approval of exact proposed text.

## Recovery
- [x] Reproduce invalid JSON and invalid-shaped journals; confirm storage reporting and failed pairing before reset.
- [x] Add regressions for quarantine, restart, crash between cutoff and replacement, reset failure, and healthy ambiguous-delivery retention.
- [x] Implement strict journal validation and explicit recovery in desktop-connector/src/admissions.mjs and desktop-api.mjs; wire reset/reporting in desktop-access.mjs.
- [x] Verify exact stored retry, blocked unknown/mismatched old prompts, normal new-session submission, and repeated reset/restart.
- [x] Synchronize Desktop source/test trees; prove parity, verify desktop-integration/apply.py on its documented pin, and run connector/Desktop/settings checks on current dev.

## Support bundle
- [x] Inspect latest #67 code and fixtures; document differences from #59 (the latest #67 still exports raw redacted logs and sanitized config).
- [x] Reuse relevant privacy cases as actual-archive tests for #59, preserving Krish6115/prashilthul attribution.
- [x] Validate OPENCODE_DB, live WAL immutability, both Settings layouts, and both legacy/new IPC routes on current dev.
- [x] Run affected package tests/typechecks; reproduce and report any baseline failures.

## Review and handoff
- [x] Obtain a fresh independent source review, resolve material findings, and record verification limits.
- [x] Prepare exact PR/update/reply drafts with evidence; wait for user approval before external writes.

## Review decision

The fresh independent source review reproduced a backward-clock replay risk in the initial timestamp-based design. The fix rejects caller-selected identities during recovery and durably records connector-generated random session identities. Old sessions are readable, and exact stored retries reconcile without forwarding; fresh sends require a new conversation created on the phone. This is intentionally conservative when the delivery journal is unrecoverable. The regression failed before the fix and passes afterward. No user approval is needed for local implementation; external PRs, pushes, and replies remain pending approval.

## Verification record

See `docs/verification/admissions-recovery-2026-10-30.md` and Desktop `docs/support-review-2026-10-30.md`. Full app suites retain only the independently reproduced current-dev Arabic parity failure. Publication remains awaiting user approval of exact drafts; no PR, push, reply, installation, or deployment has occurred. In response to the request for stronger verification, a delegated gpt-6-luna/max worker built an isolated combined Linux package and verified actual export and Reset IPC. See the verification document for exact scope and remaining platform/device limits.

# CI run audit and subsequent approved build — November 18, 2026

This record preserves the initial CI hold and its historical accounting, then
separately records the parent's subsequent approval and single consolidated
Android build. **This documentation update authorizes no additional push, CI,
native build, cancellation, or store upload.** Parent owns followthrough and the
final Android status.

## Latest parent-reported facts

- The reviewed consolidated commit is
  [`79510e0012e3505b937f813faa92e3bd39ecc407`](https://github.com/BharatCode-ai/bharatcode-mobile/commit/79510e0012e3505b937f813faa92e3bd39ecc407).
  It fixes the SDK 58 compatibility drift and implements the explicitly approved,
  expiring Android internal-test picomatch exception; it does not patch picomatch.
- One subsequent signed Android build-only run,
  [44171899132](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44171899132),
  was launched by the parent. **Source, security-policy, and compatibility passed;
  native Android is compiling.** The parent will append the final native result.
- That consolidated push used `[skip ci]` to avoid a duplicate push Source checks
  run. It is additional to the twelve pre-hold runs audited below: **13 known
  runs in this chronology**, consisting of seven push Source checks and six native
  workflow starts. The historical timing totals do not include this new run.
- Prior Intel iOS run 44159414042 subsequently completed native compilation and
  unsigned artifact creation successfully. The overall run remained red because
  its old audit/compatibility gates failed. It is not TestFlight-ready.
- The original Play Draft for `ai.bharatcode.bharatcode_mobile` is retained; the
  parent verified deletion of the duplicate Draft. Original package identity is
  unchanged. The dedicated upload key and agreed environment inputs are provisioned.
- No store upload/publication is reported, and no iOS rebuild is part of the new
  approved operation.

## Historical snapshot boundary

The accounting below was inspected November 17, 2026, approximately 20:01 UTC
(November 18 in India). iOS was active then; its later successful native result
does not change that snapshot or retroactively clear the old failed gates.

## Accounting method

At that pre-hold snapshot there were **12 runs: 7 automatic Source checks runs from
pushes and 5 native-workflow starts**. No retry-attempt API calls or signed runs
had been made. The first manual dispatch returned 404 before workflow registration;
it did not create an additional run.

GitHub's per-run `/actions/runs/{id}/timing` endpoint returned **0 billable
milliseconds for every job in all 12 runs** at inspection. This is the API's usage
report, not an independent invoice audit or a claim that no compute was consumed.
The then-active iOS job's usage was provisional. No final iOS or new-run billing
data is supplied by this reconciliation. The repository is public.

Actual runner time below is computed from job start/end timestamps for jobs that
were allocated a runner. A skipped job consumes no runner time; the ARM iOS job
had `runner_id: 0` and no runner name, so its 15-minute queue time is not counted
as native execution. Workflow elapsed time and runner time are different: jobs
can run concurrently and a workflow can spend time queued.

Completed Ubuntu runner time across those twelve runs at that snapshot: **40m27s**. This includes
**20m15s in Android native jobs** (28s failed prebuild + 19m47s successful build)
and **20m12s in source/security/compatibility jobs**, including the seven push
workflows. The Intel iOS job is additional and was still active at the snapshot.

## Historical native workflows

All links refer to `https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/`.

| Run | Native execution/status | Reported native billable time | Exact failure and reason for the attempt |
| --- | --- | --- | --- |
| [44156068957](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44156068957) | Android/iOS skipped, 0s | 0 ms | Bootstrap on preparation branch to register a manual-only workflow without merging. Source `npm audit --audit-level=high` failed: 67 high / 11 moderate findings. No native build ran. |
| [44156614948](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44156614948) | Android/iOS skipped, 0s | 0 ms | Attempt after isolating security as a hard signing gate while allowing unsigned diagnostics. Source then failed `expo install --check`: 15 package recommendations had advanced. Audit also failed. These prerequisite failures should have been gathered together before repeating CI. |
| [44157231353](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44157231353) | Android failed after **28s**; iOS never received a runner | 0 ms | Android prebuild completed but the newly written guard raised `ValueError: Unexpected Android applicationId`: it incorrectly required double quotes while Expo generated single quotes. This was an implementation bug, not an app ID change. The ARM iOS job queued 19:20:37–19:35:37 UTC, then GitHub cancelled it with `The job was not acquired by Runner of type hosted even after multiple attempts` and ARM capacity notices. Known audit/compatibility failures also remained visible. |
| [44157827174](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44157827174) | Android **succeeded, 19m47s**, 19:23:19–19:43:06 UTC; iOS skipped | 0 ms | The one full Android compile, after fixing and testing the quote parser. Produced unsigned AAB artifact 14362289455. Overall workflow remains red only because the audit and Expo gates fail; the Android build did not fail. |
| [44159414042](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44159414042) | **Active at the accounting snapshot; subsequently native/artifact success**, unsigned. Started 19:32:20 UTC; archive step started 19:41:06 UTC. | 0 ms at snapshot; final usage not recorded here | Alternative standard host after the ARM runner remained unassigned. Same Xcode 26.6. Parent later confirmed native compilation and unsigned artifact success; overall run stayed red due the historical audit/compatibility failures. No iOS retry is authorized by this record. |

## Automatic push workflows (no native jobs)

Each of these seven pre-consolidation pushes ran the existing Source checks workflow. Runner time is
the sum of its connector and mobile jobs, not workflow wall-clock duration.
All seven report 0 billable milliseconds. Connector checks passed in every run.

| Run | Commit | Actual Ubuntu runner time | Result and why triggered |
| --- | --- | --- | --- |
| [44156010712](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44156010712) | `3e7c981` | 45s | Initial workflow preparation push. Mobile job automatically cancelled by the existing `cancel-in-progress: true` Source checks policy when the bootstrap commit was pushed; no explicit cancellation call was made. |
| [44156068818](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44156068818) | `35ed0b7` | 2m01s | Bootstrap trigger commit. Mobile failed the high-severity npm audit. |
| [44156618226](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44156618226) | `f2671b7` | 1m57s | Removed bootstrap and isolated audit/signing gate. Mobile failed the same audit. |
| [44157231091](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44157231091) | `f2da86b` | 1m42s | Separated compatibility readiness from unsigned diagnostics. Mobile failed the same audit. |
| [44157825603](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44157825603) | `1fd886c` | 1m05s | Fixed the Gradle quoting guard and added policy tests. Mobile failed the same audit. |
| [44159413048](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44159413048) | `636e7a3` | 50s | Added the alternate standard macOS host. Mobile failed the same audit. |
| [44163975634](https://github.com/BharatCode-ai/bharatcode-mobile/actions/runs/44163975634) | `52de271` | 1m01s | Defaulted to Intel and allowlisted runner choices. Mobile failed the same audit. |

These repeated source runs were a consequence of incremental pushes. The known
audit failures did not require repeated confirmation. The preparation should have
batched prerequisite findings and local guard fixes before triggering more CI.
The Gradle quoting error was avoidable with a realistic generated-template fixture.
The subsequent consolidated change did not conceal those failures. It corrected
compatibility and added a named, owner-approved exception with explicit evidence
and limits; ordinary Source checks retain the original audit policy.

## Consolidated fix: reviewed and committed after the hold

The pre-hold pushed head was `52de2719c5215fa481526a3246fe8ed35e404ae6` on
`prep/internal-test-builds-20261118`. This worker did not push or dispatch during
the hold. The parent subsequently reviewed and committed the consolidated fix as
`79510e0012e3505b937f813faa92e3bd39ecc407`, then launched only the new Android run
listed above under the owner's explicit exception approval.

- The consolidated `package.json` / `package-lock.json` align all 15 packages from the observed
  Expo recommendation: Expo 58.0.26, React Native 0.88.1, the corresponding Expo
  module patches, safe-area-context 5.11.1, screens 4.30.1, and jest-expo 58.0.15.
- The lockfile was regenerated with Node 24.21.0 / npm 11.19.0 using
  `--package-lock-only --ignore-scripts --no-audit --no-fund`. No local node_modules
  or native build was created. This happened before the local-only hold.
- A local old/new lockfile comparison found **no package major-version changes**.
  The SDK 58 update does select allowed transitive minor/patch versions and
  deduplicates packages. The parent later completed JS-only preflight, and the
  current run's source and compatibility jobs passed. Native Android remains pending.
- Existing dependency overrides and the local node-forge security backport are
  unchanged. No `npm audit fix`, forced downgrade, blanket override, or audit
  exemption was used for that dependency alignment. The later named exception is
  a separate owner-approved policy decision, described below, not a dependency fix.
- Dependency-free tests now also verify manifest/lockfile-root agreement and
  preservation of the existing node-forge override; 28 such local tests passed
  before the additional security-guard tests were introduced. Parent preflight
  subsequently passed TypeScript, ESLint, 76 app tests, 15 node-forge regressions,
  and Expo compatibility. Jest matching on Windows was corrected and zero-test
  success disabled in the consolidated commit.
- Original Android package ID remains `ai.bharatcode.bharatcode_mobile`. The
  alternate draft/package was never targeted. The parent later verified deletion
  of the duplicate Draft and retention of the original. No store upload is reported.

## Unpatched picomatch: current explicit exception, not a silent bypass

The aligned lockfile still resolves picomatch **4.0.7 and 2.3.2**, both within
the reviewed advisory range `<= 4.0.7`. An upgraded Expo patch does not remove
that condition. Parent's fresh audit reports **78 total: 69 high and 9 moderate**,
not the historical 67 high / 11 moderate split. Direct advisories remain picomatch
(high), glob and minimatch (moderate); inherited findings are not independent CVEs.

Primary evidence inspected before the local-only hold:

- [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), updated
  November 17: high-severity ReDoS via attacker-supplied single-branch repeated
  extglob patterns; `first_patched_version` is null.
- [Latest upstream release 4.0.7](https://github.com/micromatch/picomatch/releases/tag/4.0.7)
  does not fix this advisory.
- [Open PR 194](https://github.com/micromatch/picomatch/pull/194) explicitly says it
  is not a general security fix and leaves `+(*a)` exponential. Do not treat it as
  a verified patch or vendor it as a silent workaround.
- [Merged PR 182](https://github.com/micromatch/picomatch/pull/182) addressed other
  repeated-extglob cases; the current single-branch advisory still applies.

Observed dependency paths are Expo CLI/Metro, Jest, file watching and globbing
tooling (`@parcel/watcher`, anymatch/micromatch, tinyglobby). No direct import of
picomatch, micromatch, anymatch, tinyglobby, or glob was found in `app/` or `src/`.
No user-controlled glob evaluation sink has been identified in the phone source.
This supports a **tooling-path assessment**, but it is not proof that every
transitive module is absent from the shipped native bundle. Npm's production
dependency classification is not equivalent to Metro runtime reachability.

At the original hold, the completed native artifacts did not retain Metro module
inventories, so runtime exclusion was unproven. The parent subsequently performed
a bounded Windows JS-only install and production Android export: **1,520 source-map
entries, none of the flagged matching libraries**. This is supporting evidence,
not a substitute for the current native build's own packager source map.

After reviewing that evidence, the owner explicitly approved policy
`20261118-picomatch-internal`, expiring **December 2, 2026 (UTC)**. The guard in
commit `79510e0` permits only the exact GHSA-fc5q-39xc-vjpf finding for reviewed
picomatch 2.3.2/4.0.7 and its inherited findings, and enables that exception only
for the Android upload-key internal-test path. It is not enabled for iOS, general
Source checks, or public publication. Other high/critical findings, incomplete
reports, unreviewed versions and expiry remain blocking.

The raw audit and policy decision remain artifacts and the exception emits a CI
warning. Before the signed AAB is made available as a GitHub build artifact, the
actual native Metro source map must exclude picomatch, micromatch, anymatch,
tinyglobby, glob and minimatch. Missing/invalid evidence fails that step. Existing
identity, Release/debug, certificate and signature checks remain in force. No
store-upload command is added. See
[the approved exception record](android-internal-exception-2026-11-18.md).

The security-policy job in run 44171899132 has passed **under that explicit
exception**, not because npm audit became clean. Compatibility/source checks also
passed. Android compilation, runtime exclusion, signing and artifact validation
subsequently passed in this same run, with no retry.
The dedicated RSA3072 PKCS12 upload key and agreed `mobile-internal` secrets/public
fingerprint variable are provisioned by the parent, with verified encrypted backup;
the workflow did not create or change them.

## Final Android build status

Run **44171899132**, attempt 1, succeeded. The Android job took 18m08s (native
compile 17m14s), with no retry. Artifact **14368399936** contains the upload-key
signed 0.2.0 (1) AAB for the original application ID. The downloaded checksum and
certificate were independently verified. The native runtime inventory contains
1,520 sources and no flagged glob tooling. See the [build record](internal-builds-2026-11-18.md)
for exact hashes. Manual Play INTERNAL delivery is tracked separately; the CI
workflow did not upload to a store or publish publicly.

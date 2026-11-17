# Android internal candidate: scoped tooling exception

Owner approval: 18 November 2026. Only Android internal-test builds; expires
2 December 2026 (UTC). This is not approval for public distribution or a claim
that npm audit is clean.

The accepted exception is solely GHSA-fc5q-39xc-vjpf in picomatch 2.3.2/4.0.7
and its inherited audit findings. Upstream has no patched release. The issue
requires an attacker-controlled glob; CI builds this reviewed source with fixed
configuration, not customer projects or supplied glob expressions. Source checks
outside this internal build retain their ordinary unmodified audit policy.

The raw audit remains an artifact and the exception emits a CI warning. Other
high/critical findings, incomplete reports, unreviewed versions and expiry fail
the gate. The actual native build's Metro source map must exclude picomatch,
micromatch, anymatch, tinyglobby, glob and minimatch before the signed AAB is
published as a build artifact. No Play upload is performed by the workflow.

Local preflight: Expo SDK 58 patches aligned; React Native 0.88.1. TypeScript,
ESLint, 76 app tests, 15 node-forge security regressions and Expo compatibility
pass. Android release JS export contains 1,520 sources and none of the flagged
matching libraries. This export is supporting evidence, not a substitute for the
native artifact's own source-map check. Windows Jest matching was corrected and
zero-test success disabled. Application ID remains
`ai.bharatcode.bharatcode_mobile`.

The dependency audit still reports 69 high inherited findings and 9 moderate
findings. These are not 78 independent vulnerabilities: direct advisories are
picomatch (high), glob and minimatch (moderate). Do not describe them as fixed.

One consolidated push uses `[skip ci]` to avoid duplicating the manual workflow's
source/tests/audit/compatibility checks. One Android upload-key build is then
dispatched. No iOS retry or store publication is part of this operation.

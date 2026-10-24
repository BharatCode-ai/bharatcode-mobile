# Local node-forge security backport

This private, vendored package is based on the complete `lib/` source from
`node-forge@1.4.0`. Its local version, `1.4.0-bharatcode.1`, is not an official
upstream release. The upstream dual license is retained in `LICENSE`.

Upstream npm archive:
`https://registry.npmjs.org/node-forge/-/node-forge-1.4.0.tgz`

Original archive integrity:
`sha512-LarFH0+6VfriEhqMMcLX2F7SwSXeWwnEAJEsYm5QKWchiVYVvJyV9v7UDvUv+w5HO23ZpQTXDv/GxdDdMyOuoQ==`

Only `lib/rsa.js` differs from that archive's library source. RSA PKCS#1 v1.5
verification requires the nested DigestAlgorithm sequence to contain exactly
an OID and, optionally, a universal primitive NULL with an empty value. This
rejects both extra children and malformed replacements for the optional NULL.
The ordinary signature, certificate, CSR, encryption and other library APIs
remain available.

The root package's direct tooling dependency and `$node-forge` override route
both Expo CLI and Expo's code-signing package to this checked-in implementation.
No install hook patches `node_modules`; a clean install with scripts disabled
uses the same source. Expo remains at its existing version.

The registry advisory does not audit this local fork's implementation. The
security guarantee comes from the backport and the malformed-signature and
Expo compatibility regressions in `security/node-forge.test.cjs`, which run as
part of `npm run check`. Do not treat an empty npm audit alone as proof.

References:

- [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [Upstream report](https://github.com/digitalbazaar/forge/issues/1149)
- [Proposed upstream fix](https://github.com/digitalbazaar/forge/pull/1152)

When upstream publishes a verified fix, replace this backport with that release,
remove the local dependency/override, and retain the security regressions.

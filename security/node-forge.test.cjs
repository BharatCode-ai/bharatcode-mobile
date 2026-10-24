const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const { generateKeyPairSync, verify } = require("node:crypto");
const { createRequire } = require("node:module");
const { test } = require("node:test");

const expoRequire = createRequire(require.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli"));
const signingRequire = createRequire(
  cliRequire.resolve("@expo/code-signing-certificates"),
);
const pem = generateKeyPairSync("rsa", {
  modulusLength: 1024,
  publicExponent: 3,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});

for (const [caller, load] of [
  ["Expo CLI", cliRequire],
  ["Expo signing", signingRequire],
]) {
  const forge = load("node-forge");
  const { asn1 } = forge;
  const privateKey = forge.pki.privateKeyFromPem(pem.privateKey);
  const publicKey = forge.pki.publicKeyFromPem(pem.publicKey);
  const digest = forge.md.sha256
    .create()
    .update("security regression")
    .digest()
    .bytes();
  const node = (
    type,
    value,
    constructed = false,
    tagClass = asn1.Class.UNIVERSAL,
  ) => asn1.create(tagClass, type, constructed, value);
  const oid = () =>
    node(asn1.Type.OID, asn1.oidToDer(forge.oids.sha256).getBytes());
  const nil = () => node(asn1.Type.NULL, "");
  const extra = () => node(asn1.Type.OCTETSTRING, "garbage");
  function signature(children) {
    const der = asn1
      .toDer(
        node(
          asn1.Type.SEQUENCE,
          [
            node(asn1.Type.SEQUENCE, children, true),
            node(asn1.Type.OCTETSTRING, digest),
          ],
          true,
        ),
      )
      .getBytes();
    // A test key signs attacker-shaped DER to exercise the actual verifier.
    // This is a parser-boundary regression, not a private-key-free forgery.
    return privateKey.sign(der, "NONE");
  }
  for (const [shape, children] of [
    ["OID only", () => [oid()]],
    ["OID and empty NULL", () => [oid(), nil()]],
  ])
    test(`${caller}: accepts ${shape}`, () => {
      const signed = signature(children());
      assert.equal(publicKey.verify(digest, signed), true);
      assert.equal(publicKey.verify(digest.slice(0, -1) + "x", signed), false);
    });
  for (const [shape, children] of [
    ["extra nested child", () => [oid(), nil(), extra()]],
    ["garbage replacing optional NULL", () => [oid(), extra()]],
    ["nonempty NULL", () => [oid(), node(asn1.Type.NULL, "garbage")]],
    ["constructed NULL", () => [oid(), node(asn1.Type.NULL, [], true)]],
    [
      "non-universal NULL",
      () => [
        oid(),
        node(asn1.Type.NULL, "", false, asn1.Class.CONTEXT_SPECIFIC),
      ],
    ],
  ])
    test(`${caller}: rejects ${shape}`, () => {
      assert.throws(
        () => publicKey.verify(digest, signature(children())),
        /DigestInfo/,
      );
    });
}

test("Expo certificate, key, signature and CSR workflows still work", () => {
  const signing = cliRequire("@expo/code-signing-certificates");
  const forge = signingRequire("node-forge");
  const generated = signing.generateKeyPair();
  const keys = signing.convertKeyPairPEMToKeyPair(
    signing.convertKeyPairToPEM(generated),
  );
  const certificate = signing.generateSelfSignedCodeSigningCertificate({
    keyPair: keys,
    validityNotBefore: new Date(Date.now() - 60_000),
    validityNotAfter: new Date(Date.now() + 86_400_000),
    commonName: "BharatCode security test",
  });
  const restored = signing.convertCertificatePEMToCertificate(
    signing.convertCertificateToCertificatePEM(certificate),
  );
  assert.doesNotThrow(() =>
    signing.validateSelfSignedCertificate(restored, keys),
  );
  const content = Buffer.from("legitimate Expo manifest");
  const signature = Buffer.from(
    signing.signBufferRSASHA256AndVerify(keys.privateKey, restored, content),
    "base64",
  );
  const publicKey = forge.pki.publicKeyToPem(keys.publicKey);
  assert.equal(verify("sha256", content, publicKey, signature), true);
  assert.equal(
    verify("sha256", Buffer.from("tampered manifest"), publicKey, signature),
    false,
  );
  const csr = signing.convertCSRPEMToCSR(
    signing.convertCSRToCSRPEM(signing.generateCSR(keys, "test")),
  );
  assert.equal(csr.verify(), true);
});

import { validateOrigin, parsePairingPayload } from "./pairing-payload";
import { decodeSse } from "./sse";

const now = 1_000_000;
const payload = (origin = "https://pc.opentunnel.xyz") =>
  JSON.stringify({
    v: 1,
    origin,
    desktopID: "pc_test",
    code: "a".repeat(43),
    expiresAt: now + 300_000,
  });
test("normalizes only hosted tunnel origins", () => {
  expect(validateOrigin("https://pc.opentunnel.xyz:443/")).toBe(
    "https://pc.opentunnel.xyz",
  );
  for (const origin of [
    "http://pc.opentunnel.xyz",
    "https://opentunnel.xyz",
    "https://pc.opentunnel.xyz.evil.com",
    "https://pc.opentunnel.xyz/path",
    "https://u:p@pc.opentunnel.xyz",
    "https://pc.opentunnel.xyz?x=1",
    "https://pc.opentunnel.xyz#",
    "https://pc.opentunnel.xyz:444",
  ])
    expect(() => validateOrigin(origin)).toThrow();
});
test("validates pairing identity, expiry, code and version", () => {
  expect(parsePairingPayload(payload(), now).desktopID).toBe("pc_test");
  for (const patch of [
    { v: 2 },
    { desktopID: "evil" },
    { code: "short" },
    { expiresAt: now },
    { expiresAt: now + 360_001 },
  ])
    expect(() =>
      parsePairingPayload(
        JSON.stringify({ ...JSON.parse(payload()), ...patch }),
        now,
      ),
    ).toThrow();
});
async function* chunks(text: string) {
  for (const byte of new TextEncoder().encode(text))
    yield new Uint8Array([byte]);
}
test("decodes byte-fragmented Unicode CRLF SSE and multiline data", async () => {
  const result = [];
  for await (const e of decodeSse(
    chunks(
      ': heartbeat\r\ndata: {"type":"delta",\r\ndata: "text":"안녕"}\r\n\r\n',
    ),
  ))
    result.push(e);
  expect(result).toEqual([{ type: "delta", text: "안녕" }]);
});
test("rejects unbounded event frames", async () => {
  const consume = async () => {
    for await (const e of decodeSse(
      (async function* () {
        yield new TextEncoder().encode("x".repeat(1_048_577));
      })(),
    ))
      void e;
  };
  await expect(consume()).rejects.toThrow("Event exceeds");
});

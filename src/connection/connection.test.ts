import { validateOrigin, parsePairingPayload } from "./pairing-payload";
import { decodeSse } from "./sse";

const now = 1_000_000;
const payload = (origin = "https://pc.tunnel.bharatcode.ai") =>
  JSON.stringify({
    v: 1,
    origin,
    desktopID: "pc_test",
    code: "a".repeat(43),
    expiresAt: now + 300_000,
  });
test("normalizes only hosted tunnel origins", () => {
  expect(validateOrigin("https://pc.tunnel.bharatcode.ai:443/")).toBe(
    "https://pc.tunnel.bharatcode.ai",
  );
  for (const origin of [
    "http://pc.tunnel.bharatcode.ai",
    "https://tunnel.bharatcode.ai",
    "https://pc.opentunnel.xyz",
    "https://pc.tunnel.bharatcode.ai\\@evil.com",
    "https://pc..tunnel.bharatcode.ai",
    "https://-pc.tunnel.bharatcode.ai",
    "https://pc.tunnel.bharatcode.ai/../",
    " https://pc.tunnel.bharatcode.ai",
    "https://pc.tunnel.bharatcode.ai.evil.com",
    "https://pc.tunnel.bharatcode.ai/path",
    "https://u:p@pc.tunnel.bharatcode.ai",
    "https://pc.tunnel.bharatcode.ai?x=1",
    "https://pc.tunnel.bharatcode.ai#",
    "https://pc.tunnel.bharatcode.ai:444",
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

test("opens only credential-free Desktop pairing links", () => {
  const link =
    "bharatcode://pair?origin=https%3A%2F%2Fpc.tunnel.bharatcode.ai&desktopID=pc_test";
  expect(parsePairingPayload(link, now)).toEqual({
    v: 1,
    origin: "https://pc.tunnel.bharatcode.ai",
    desktopID: "pc_test",
  });
  for (const value of [
    link + "&token=secret",
    link + "&desktopID=pc_other",
    link + "#secret",
    link.replace("bharatcode:", "https:"),
    link.replace("pc_test", "evil"),
    link.replace("pair?", "pair/path?"),
  ])
    expect(() => parsePairingPayload(value, now)).toThrow();
});

import { normalizePairingCode, resolvePairingCode } from "./pairing-code";
const value = {
  v: 1,
  origin: "https://pc.tunnel.bharatcode.ai",
  desktopID: "pc_one",
  code: "a".repeat(43),
  serverTime: 1000,
  expiresAt: 301000,
};
const reply = (data: unknown = value, status = 200) =>
  ({
    ok: status === 200,
    status,
    redirected: false,
    headers: { get: () => null },
    text: async () => JSON.stringify(data),
  }) as unknown as Response;
test("normalizes only ASCII spaces and hyphens in eight digits", () => {
  expect(normalizePairingCode("12 34-5678")).toBe("12345678");
  for (const text of [
    "1234567",
    "１２３４５６７８",
    "1234\t5678",
    "https://pc.tunnel.bharatcode.ai",
    "123456789",
  ])
    expect(() => normalizePairingCode(text)).toThrow();
});
test("redeems at the fixed origin with no redirect or credentials and server-relative expiry", async () => {
  const transport = jest.fn(async () => reply());
  const result = await resolvePairingCode("1234-5678", {
    transport,
    now: () => 9000000,
  });
  expect(transport).toHaveBeenCalledWith(
    "https://tunnel.bharatcode.ai/api/pairing/redeem",
    expect.objectContaining({
      method: "POST",
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      body: '{"code":"12345678"}',
    }),
  );
  expect(result.expiresAt).toBe(9300000);
});
test.each([
  { origin: "https://evil.example" },
  { origin: "https://pc.tunnel.bharatcode.ai@evil.example" },
  { origin: "https://pc.tunnel.bharatcode.ai/path" },
  { desktopID: [] },
  { desktopID: "pc_" },
  { code: "bad" },
  { v: 2 },
  { expiresAt: 301001 },
  { expiresAt: 1000 },
  { serverTime: "1000" },
  { token: "unexpected" },
])("rejects untrusted service payload %j", async (patch) => {
  await expect(
    resolvePairingCode("12345678", {
      transport: async () => reply({ ...value, ...patch }),
    }),
  ).rejects.toThrow("unavailable");
});
test("rejects oversized and redirected responses", async () => {
  for (const response of [
    reply("x".repeat(5000)),
    { ...reply(), redirected: true },
  ])
    await expect(
      resolvePairingCode("12345678", {
        transport: async () => response as Response,
      }),
    ).rejects.toThrow("unavailable");
});
test("unknown expired and used failures have the same generic error; guesses are rate limited", async () => {
  for (const status of [400, 404, 409, 410])
    await expect(
      resolvePairingCode("12345678", {
        transport: async () => reply({}, status),
      }),
    ).rejects.toThrow("expired or already used");
  await expect(
    resolvePairingCode("12345678", { transport: async () => reply({}, 429) }),
  ).rejects.toThrow("Too many attempts");
});
test("cancellation wins even if transport ignores AbortSignal", async () => {
  const controller = new AbortController();
  let done!: (response: Response) => void;
  const pending = resolvePairingCode("12345678", {
    signal: controller.signal,
    transport: () => new Promise((r) => (done = r)),
  });
  controller.abort();
  await expect(pending).rejects.toThrow("cancelled");
  done(reply());
});
test("a stalled resolver times out even when transport ignores AbortSignal", async () => {
  jest.useFakeTimers();
  try {
    const result = resolvePairingCode("12345678", {
      transport: () => new Promise(() => {}),
    });
    const rejected = expect(result).rejects.toThrow("unavailable");
    await jest.advanceTimersByTimeAsync(15000);
    await rejected;
  } finally {
    jest.useRealTimers();
  }
});

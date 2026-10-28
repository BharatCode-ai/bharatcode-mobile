import { AppStore } from "./app-store";
import {
  ConversationStore,
  MemoryDatabase,
} from "../storage/conversation-store";
import { PairingPayload } from "../connection/pairing-payload";
import { API } from "../domain/types";
const payload: PairingPayload = {
  v: 1,
  origin: "https://pc.tunnel.bharatcode.ai",
  desktopID: "pc_one",
  code: "a".repeat(43),
  expiresAt: 9300000,
};
function setup(
  resolveCode: (text: string, signal: AbortSignal) => Promise<PairingPayload>,
) {
  const request = jest.fn(async (_method, path) =>
    path === "/mobile/v1/claim"
      ? {
          confirmation: "123456",
          claimID: "claim",
          claimSecret: "secret",
          expiresAt: 301000,
        }
      : { state: "waiting" },
  );
  const store = new AppStore({
    persistence: new ConversationStore(new MemoryDatabase()),
    credentials: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
    },
    now: () => 9000000,
    resolveCode,
    apiFactory: () => ({
      request: request as API["request"],
      events: async function* () {},
      liveEvents: async function* () {},
      close() {},
    }),
  });
  return { store, request };
}
test("resolved invitation enters matching-code approval despite phone clock skew", async () => {
  const { store, request } = setup(async () => payload);
  try {
    await store.pairCode("12345678");
    expect(store.getSnapshot().confirmation).toBe("123456");
    expect(store.getSnapshot().error).toBeUndefined();
    expect(request).toHaveBeenCalledWith(
      "POST",
      "/mobile/v1/claim",
      expect.objectContaining({
        body: { code: payload.code, deviceName: "Phone" },
        signal: expect.anything(),
      }),
    );
    expect(request).toHaveBeenCalledWith(
      "POST",
      "/mobile/v1/claim/status",
      expect.anything(),
    );
  } finally {
    store.dispose();
  }
});
test.each(["cancel", "dispose", "replace"])(
  "a late resolver cannot claim after %s",
  async (action) => {
    let done!: (p: PairingPayload) => void;
    let signal!: AbortSignal;
    const { store, request } = setup(async (_text, s) => {
      signal = s;
      return new Promise((r) => (done = r));
    });
    const pending = store.pairCode("12345678");
    if (action === "cancel") store.cancelPairing();
    else if (action === "dispose") store.dispose();
    else await store.pair("bad");
    expect(signal.aborted).toBe(true);
    done(payload);
    await pending;
    expect(request).not.toHaveBeenCalled();
    expect(store.getSnapshot().confirmation).toBeUndefined();
    store.dispose();
  },
);
test("cancel during a late claim response cannot start approval polling", async () => {
  const { store, request } = setup(async () => payload);
  let done!: (p: unknown) => void;
  request.mockImplementationOnce(() => new Promise((r) => (done = r)) as never);
  const pending = store.pairCode("12345678");
  await Promise.resolve();
  store.cancelPairing();
  done({ confirmation: "123456", claimID: "c", claimSecret: "s" });
  await pending;
  expect(request).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().confirmation).toBeUndefined();
  store.dispose();
});

import { ApiError } from "../connection/api-client";
import { AppStore } from "./app-store";
import {
  MemoryDatabase,
  ConversationStore,
} from "../storage/conversation-store";
import { API, DesktopDevice } from "../domain/types";
const device: DesktopDevice = {
  id: "pc_one",
  name: "Computer",
  platform: "Linux",
  origin: "https://pc.opentunnel.xyz",
  credentialID: "dev_one",
};
function setup() {
  const sent: unknown[] = [];
  const api: API = {
    request: jest.fn(
      async (method: string, path: string, options?: { body?: unknown }) => {
        if (path.endsWith("/health"))
          return {
            protocol: 1,
            desktop: { id: store.getSnapshot().device?.id },
            capabilities: { replay: false },
          };
        if (path === "/api/session")
          return {
            data: [
              {
                id: "ses_one",
                title: "Chat",
                location: { directory: "/project" },
                time: { updated: 1 },
              },
            ],
          };
        if (path.endsWith("/prompt")) {
          sent.push(options?.body);
          return {};
        }
        if (path.endsWith("/message")) return { data: [] };
        if (path.endsWith("/active")) return { data: {} };
        return { data: [] };
      },
    ) as API["request"],
    async *events() {},
    async *liveEvents() {
      await new Promise(() => {});
    },
    close: jest.fn(),
  };
  const persistence = new ConversationStore(new MemoryDatabase());
  const store = new AppStore({
    persistence,
    credentials: {
      get: async () => "token",
      set: async () => {},
      remove: async () => {},
    },
    apiFactory: () => api,
    id: () => "msg_fixed",
  });
  return { store, api, sent, persistence };
}
test("send preserves durable ID and clears only after admission", async () => {
  const { store, persistence, sent } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  store.setDraft("hello");
  await store.send();
  expect(sent).toEqual([{ id: "msg_fixed", prompt: { text: "hello" } }]);
  expect(store.getSnapshot().draft).toBe("");
  expect((await persistence.read(device.id, "ses_one")).pending?.state).toBe(
    "admitted",
  );
  store.dispose();
});
test("switching away during durable save cannot execute in replacement context", async () => {
  const { store, persistence, sent } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  store.setDraft("hello");
  let release!: () => void;
  const save = persistence.savePending.bind(persistence);
  persistence.savePending = async (...args) => {
    await new Promise<void>((r) => (release = r));
    await save(...args);
  };
  const sending = store.send();
  store.backToChats();
  release();
  await sending;
  expect(sent).toEqual([]);
  store.dispose();
});
test("uncertain delivery survives reopen and cannot be replaced by a new prompt", async () => {
  const { store, api, sent } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  const request = api.request;
  api.request = async (...args) => {
    if (args[1].endsWith("/prompt")) throw new Error("network");
    return request(...args);
  };
  store.setDraft("original");
  await store.send();
  store.backToChats();
  await store.openConversation("ses_one");
  expect(store.getSnapshot().pending?.id).toBe("msg_fixed");
  store.setDraft("different");
  await store.send();
  expect(sent).toEqual([]);
  expect(store.getSnapshot().error).toContain("Restore");
  store.dispose();
});
test("preview initializes without calling real adapters", async () => {
  const { store } = setup();
  await store.enterPreview();
  expect(store.getSnapshot().preview).toBe(true);
  await store.openConversation("ses_checkout");
  store.setDraft("preview");
  await store.send();
  expect(store.getSnapshot().messages.at(-1)?.text).toContain("sample");
  store.dispose();
});
test("a newer draft is preserved while the outgoing prompt is admitted", async () => {
  const { store, api } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  store.setDraft("first");
  const original = api.request;
  let release!: () => void;
  api.request = async (...args) => {
    if (args[1].endsWith("/prompt"))
      await new Promise<void>((r) => (release = r));
    return original(...args);
  };
  const send = store.send();
  await new Promise((r) => setTimeout(r, 0));
  store.setDraft("second");
  release();
  await send;
  expect(store.getSnapshot().draft).toBe("second");
  expect(store.getSnapshot().pending).toBeUndefined();
  store.dispose();
});
test("admitted prompt remains admitted if subsequent history read fails", async () => {
  const { store, api, persistence } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  const original = api.request;
  api.request = async (...args) => {
    if (args[1].endsWith("/message")) throw new Error("history unavailable");
    return original(...args);
  };
  store.setDraft("hello");
  await store.send();
  expect(store.getSnapshot().pending).toBeUndefined();
  expect((await persistence.read(device.id, "ses_one")).pending?.state).toBe(
    "admitted",
  );
  store.dispose();
});
test("revoked API credentials disable sending immediately", async () => {
  const { store, api } = setup();
  await store.connectDevice(device);

  api.request = async () => {
    throw new ApiError(401, "Pair again");
  };
  await store.refreshSessions();
  expect(store.getSnapshot().online).toBe(false);
  store.dispose();
});
test("a late old-computer page cannot replace the selected computer", async () => {
  const { store, api } = setup();
  await store.connectDevice(device);
  const original = api.request;
  let release!: (v: unknown) => void;
  let delayed = true;
  api.request = async (...args) => {
    if (args[1] === "/api/session" && delayed) {
      delayed = false;
      return (await new Promise<unknown>((r) => (release = r))) as never;
    }
    return original(...args);
  };
  const pending = store.refreshSessions();
  await store.connectDevice({ ...device, id: "pc_two" });
  release({ data: [{ id: "ses_wrong" }] });
  await pending;
  expect(store.getSnapshot().device?.id).toBe("pc_two");
  expect(store.getSnapshot().sessions.some((s) => s.id === "ses_wrong")).toBe(
    false,
  );
  store.dispose();
});
test("pending storage failure prevents network execution and preserves input", async () => {
  const { store, persistence, sent } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  persistence.savePending = async () => {
    throw new Error("disk full");
  };
  store.setDraft("hello");
  await store.send();
  expect(sent).toEqual([]);
  expect(store.getSnapshot().draft).toBe("hello");
  store.dispose();
});
test("model and agent labels remain scoped to each conversation", async () => {
  const { store } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  await store.switchConfiguration("agent", { id: "plan", name: "Plan" });
  store.backToChats();
  await store.openConversation("ses_one");
  expect(store.getSnapshot().agent).toBe("Plan");
  store.dispose();
});
test("Stop sends the bodyless interrupt contract", async () => {
  const { store, api } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  await store.stop();
  expect(api.request).toHaveBeenCalledWith(
    "POST",
    "/api/session/ses_one/interrupt",
    expect.objectContaining({ signal: expect.anything() }),
  );
  store.dispose();
});
test("permission decisions use once/reject without automatic replay", async () => {
  const { store, api } = setup();
  await store.connectDevice(device);
  await store.decide(
    {
      id: "per_one",
      sessionID: "ses_one",
      title: "Allow",
      command: "test",
      directory: "/project",
      question: false,
      questions: [],
    },
    true,
  );
  expect(api.request).toHaveBeenCalledWith(
    "POST",
    "/api/session/ses_one/permission/per_one/reply",
    expect.objectContaining({ body: { reply: "once" } }),
  );
  store.dispose();
});
test("health rejects mismatched Desktop identity and protocol", async () => {
  const { store, api } = setup();
  const original = api.request;
  api.request = async (...args) =>
    args[1].endsWith("/health")
      ? ({ protocol: 99, desktop: { id: "pc_wrong" } } as never)
      : original(...args);
  await store.connectDevice(device);
  expect(store.getSnapshot().online).toBe(false);
  expect(store.getSnapshot().error).toContain("identity");
  store.dispose();
});
test("a cancelled refresh debounce does not block updates in the next conversation", async () => {
  jest.useFakeTimers();
  const { store, api } = setup();
  let emit!: () => void;
  api.liveEvents = async function* (_session, signal) {
    await new Promise<void>((r) => (emit = r));
    yield {
      type: "session.next.tool.progress",
      data: { sessionID: "ses_one" },
    };
    await new Promise<void>((r) =>
      signal.addEventListener("abort", () => r(), { once: true }),
    );
  };
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  emit();
  await jest.advanceTimersByTimeAsync(0);
  store.backToChats();
  await store.openConversation("ses_one");
  const initial = (api.request as jest.Mock).mock.calls.filter((c) =>
    c[1].endsWith("/message"),
  ).length;
  emit();
  await jest.advanceTimersByTimeAsync(200);
  expect(
    (api.request as jest.Mock).mock.calls.filter((c) =>
      c[1].endsWith("/message"),
    ).length,
  ).toBeGreaterThan(initial);
  store.dispose();
  jest.useRealTimers();
});
test("configuration and file authorization failures immediately disable execution", async () => {
  const { store, api } = setup();
  await store.connectDevice(device);
  await store.openConversation("ses_one");
  api.request = async () => {
    throw new ApiError(401, "Pair again");
  };
  await expect(store.configuration("model")).rejects.toMatchObject({
    status: 401,
  });
  expect(store.getSnapshot().online).toBe(false);
  store.dispose();
});
test("cannot overwrite an uncertain outgoing identity while conversation storage is loading", async () => {
  const { store, persistence, sent } = setup();
  await store.connectDevice(device);
  await persistence.savePending(device.id, "ses_one", {
    id: "msg_old",
    text: "uncertain",
    state: "pending",
  });
  const original = persistence.read.bind(persistence);
  let release!: () => void;
  let first = true;
  persistence.read = async (...args) => {
    if (first) {
      first = false;
      await new Promise<void>((r) => (release = r));
    }
    return original(...args);
  };
  const opening = store.openConversation("ses_one");
  store.setDraft("new while loading");
  await store.send();
  expect(sent).toEqual([]);
  release();
  await opening;
  expect(store.getSnapshot().pending?.id).toBe("msg_old");
  store.dispose();
});
test('successful health retry after resume restores live subscriptions and a usable request signal',async()=>{
 jest.useFakeTimers();const {store,api}=setup();let streams=0;api.liveEvents=async function*(_s,signal){streams++;await new Promise<void>(r=>signal.addEventListener('abort',()=>r(),{once:true}));};
 await store.connectDevice(device);await store.openConversation('ses_one');expect(streams).toBe(1);store.suspend();const original=api.request;let fails=true;api.request=async(...args)=>{if(args[1].endsWith('/health')&&fails){fails=false;throw new Error('Temporary outage');}return original(...args);};
 await store.resume();await jest.advanceTimersByTimeAsync(4100);expect(store.getSnapshot().online).toBe(true);expect(streams).toBe(2);store.setDraft('resume');await store.send();
 const calls=(api.request as unknown);void calls;expect(store.getSnapshot().pending).toBeUndefined();store.dispose();jest.useRealTimers();
});

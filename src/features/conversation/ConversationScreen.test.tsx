import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import ConversationScreen from "./ConversationScreen";
import { StoreProvider } from "../../state/react";
import { AppStore } from "../../state/app-store";
import {
  ConversationStore,
  MemoryDatabase,
} from "../../storage/conversation-store";
import { API } from "../../domain/types";
// The runtime parser has no bundled TS types; keep this observation test local.
const MarkdownIt = jest.requireActual("markdown-it") as {
  prototype: { parse: (...args: unknown[]) => unknown };
};
const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: "ses_checkout" }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => {}),
  getStringAsync: jest.fn(async () => "context"),
}));
test("the visible composer sends its current text and renders the sample reply", async () => {
  const store = new AppStore({
    persistence: new ConversationStore(new MemoryDatabase()),
    credentials: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
    },
  });
  await store.enterPreview();
  const screen = await render(
    <StoreProvider store={store}>
      <ConversationScreen />
    </StoreProvider>,
  );
  await waitFor(() => expect(store.getSnapshot().conversationReady).toBe(true));
  await fireEvent.changeText(
    screen.getByLabelText("Message BharatCode"),
    "Run the sample checks",
  );
  await fireEvent.press(screen.getByLabelText("Send message"));
  await waitFor(() =>
    expect(screen.getByText("Run the sample checks")).toBeTruthy(),
  );
  expect(store.getSnapshot().draft).toBe("");
  expect(screen.getByText(/This is a sample workspace/)).toBeTruthy();
  expect(screen.getByLabelText("View working changes")).toBeTruthy();
  await screen.unmount();
  store.dispose();
});
test("typing in the composer does not reparse completed Markdown replies", async () => {
  const store = new AppStore({
    persistence: new ConversationStore(new MemoryDatabase()),
    credentials: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
    },
  });
  await store.enterPreview();
  const parse = jest.spyOn(MarkdownIt.prototype, "parse");
  const screen = await render(
    <StoreProvider store={store}>
      <ConversationScreen />
    </StoreProvider>,
  );
  try {
    await waitFor(() =>
      expect(screen.getByText("Read 3 files · completed")).toBeTruthy(),
    );
    const before = parse.mock.calls.length;
    expect(before).toBeGreaterThan(0);
    await fireEvent.changeText(
      screen.getByLabelText("Message BharatCode"),
      "a",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Message BharatCode"),
      "ab",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Message BharatCode"),
      "abc",
    );
    expect(parse.mock.calls.length).toBe(before);
  } finally {
    await screen.unmount();
    store.dispose();
    parse.mockRestore();
  }
});
async function restoringFixture() {
  const persistence = new ConversationStore(new MemoryDatabase());
  await persistence.db.set(
    "devices",
    JSON.stringify([
      {
        id: "pc_one",
        name: "Computer",
        platform: "Linux",
        origin: "https://pc.opentunnel.xyz",
        credentialID: "dev_one",
      },
    ]),
  );
  let release!: (token: string) => void;
  const api: API = {
    async request<T>(_method: string, path: string) {
      const session = {
        id: "ses_checkout",
        title: "QA conversation",
        location: { directory: "/fixture" },
      };
      return (
        path.endsWith("/health")
          ? {
              protocol: 1,
              desktop: { id: "pc_one" },
              capabilities: { replay: false },
            }
          : path === "/api/session"
            ? { data: [session] }
            : path === "/api/session/ses_checkout"
              ? { data: session }
              : path.endsWith("/message")
                ? {
                    data: [
                      {
                        id: "reply",
                        type: "assistant",
                        text: "Restored reply",
                      },
                    ],
                  }
                : { data: [] }
      ) as T;
    },
    async *events() {},
    async *liveEvents() {
      await new Promise(() => {});
    },
    close() {},
  };
  const store = new AppStore({
    persistence,
    credentials: {
      get: () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
      set: async () => {},
      remove: async () => {},
    },
    apiFactory: () => api,
  });
  await store.restore();
  return {
    store,
    persistence,
    api,
    releaseCredentials: (token: string) => release(token),
  };
}
test("a conversation opened during local restoration loads once the connection becomes ready", async () => {
  const { store, releaseCredentials } = await restoringFixture();
  const screen = await render(
    <StoreProvider store={store}>
      <ConversationScreen />
    </StoreProvider>,
  );
  try {
    await act(async () => {
      releaseCredentials("synthetic-token");
    });
    await waitFor(() =>
      expect(screen.getByText("Restored reply")).toBeTruthy(),
    );
    expect(store.getSnapshot().selected?.id).toBe("ses_checkout");
  } finally {
    await screen.unmount();
    store.dispose();
  }
});
test("a known conversation still hydrates cached history and draft when opened offline", async () => {
  const { store, persistence, api, releaseCredentials } =
    await restoringFixture();
  releaseCredentials("synthetic-token");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await store.openConversation("ses_checkout");
  store.setDraft("Keep this offline draft");
  await persistence.read("pc_one", "ses_checkout");
  store.backToChats();
  api.request = async () => {
    throw new Error("Offline");
  };
  await store.refreshSessions();
  expect(store.getSnapshot().online).toBe(false);
  const screen = await render(
    <StoreProvider store={store}>
      <ConversationScreen />
    </StoreProvider>,
  );
  try {
    await waitFor(() =>
      expect(screen.getByText("Restored reply")).toBeTruthy(),
    );
    expect(screen.getByLabelText("Message BharatCode").props.value).toBe(
      "Keep this offline draft",
    );
    expect(store.getSnapshot().online).toBe(false);
  } finally {
    await screen.unmount();
    store.dispose();
  }
});
test("a cold offline deep link restores cached history before credentials and network", async () => {
  const { store, persistence, api, releaseCredentials } =
    await restoringFixture();
  releaseCredentials("synthetic-token");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await store.openConversation("ses_checkout");
  store.setDraft("Durable offline draft");
  await persistence.read("pc_one", "ses_checkout");
  store.dispose();
  const cold = new AppStore({
    persistence,
    credentials: {
      get: () => new Promise(() => {}),
      set: async () => {},
      remove: async () => {},
    },
    apiFactory: () => api,
  });
  await cold.restore();
  const screen = await render(
    <StoreProvider store={cold}>
      <ConversationScreen />
    </StoreProvider>,
  );
  try {
    await waitFor(() =>
      expect(screen.getByText("Restored reply")).toBeTruthy(),
    );
    expect(screen.getByText("QA conversation")).toBeTruthy();
    expect(screen.getByLabelText("Message BharatCode").props.value).toBe(
      "Durable offline draft",
    );
    expect(cold.getSnapshot().online).toBe(false);
  } finally {
    await screen.unmount();
    cold.dispose();
  }
});
test("unmounting while cached history is loading cancels the opening conversation", async () => {
  const { store, persistence, releaseCredentials } = await restoringFixture();
  releaseCredentials("synthetic-token");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const read = persistence.read.bind(persistence);
  let releaseRead!: () => void;
  const blocked = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  jest.spyOn(persistence, "read").mockImplementation(async (...args) => {
    await blocked;
    return read(...args);
  });
  const screen = await render(
    <StoreProvider store={store}>
      <ConversationScreen />
    </StoreProvider>,
  );
  await screen.unmount();
  releaseRead();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(store.getSnapshot().selected).toBeUndefined();
  expect(store.getSnapshot().conversationReady).toBe(false);
  store.dispose();
});

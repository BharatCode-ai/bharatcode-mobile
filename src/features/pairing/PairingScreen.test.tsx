import { fireEvent, render } from "@testing-library/react-native";
import PairingScreen from "./PairingScreen";
import { StoreProvider } from "../../state/react";
import { AppStore } from "../../state/app-store";
import {
  ConversationStore,
  MemoryDatabase,
} from "../../storage/conversation-store";
let mockParams: Record<string, string | string[]> = {};
const replace = jest.fn();
const mockRouter = { replace, back: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [
    { granted: false, canAskAgain: true },
    jest.fn(),
  ],
}));
test("Add computer stays on pairing even when another computer is selected", async () => {
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
      <PairingScreen />
    </StoreProvider>,
  );
  expect(screen.getByLabelText("Eight-digit Desktop code")).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
  store.dispose();
});

test("routed pairing deliveries start and retry a real claim without a URL listener", async () => {
  mockParams = {
    link: "bharatcode://pair?origin=https%3A%2F%2Fpc.tunnel.bharatcode.ai&desktopID=pc_one",
    delivery: "first",
  };
  let claims = 0;
  const store = new AppStore({
    persistence: new ConversationStore(new MemoryDatabase()),
    credentials: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
    },
    apiFactory: () => ({
      request: async (_method, path) =>
        (path === "/mobile/v1/claim"
          ? {
              confirmation: String(123455 + ++claims),
              claimID: "claim_test",
              claimSecret: "secret_test",
              expiresAt: Date.now() + 300_000,
            }
          : { state: "waiting" }) as never,
      events: async function* () {},
      liveEvents: async function* () {},
      close() {},
    }),
  });
  const screen = await render(
    <StoreProvider store={store}>
      <PairingScreen />
    </StoreProvider>,
  );
  try {
    expect(
      await screen.findByText("Waiting for approval on your computer"),
    ).toBeTruthy();
    expect(screen.getByText("123456")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Cancel pairing"));
    mockParams = { ...mockParams, delivery: "second" };
    await screen.rerender(
      <StoreProvider store={store}>
        <PairingScreen />
      </StoreProvider>,
    );
    expect(await screen.findByText("123457")).toBeTruthy();
  } finally {
    store.dispose();
    mockParams = {};
  }
});

test("typed eight-digit code resolves and shows Desktop approval without using the camera", async () => {
  const store = new AppStore({
    persistence: new ConversationStore(new MemoryDatabase()),
    credentials: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
    },
    pairingTransport: async (_url, options) => {
      expect(JSON.parse(String(options?.body))).toEqual({ code: "12345678" });
      return {
        ok: true,
        status: 200,
        redirected: false,
        headers: { get: () => null },
        text: async () =>
          JSON.stringify({
            v: 1,
            origin: "https://pc.tunnel.bharatcode.ai",
            desktopID: "pc_one",
            code: "a".repeat(43),
            serverTime: 1000,
            expiresAt: 301000,
          }),
      } as unknown as Response;
    },
    apiFactory: () => ({
      request: async (_method, path) =>
        (path.endsWith("/claim")
          ? { confirmation: "654321", claimID: "claim", claimSecret: "secret" }
          : { state: "waiting" }) as never,
      events: async function* () {},
      liveEvents: async function* () {},
      close() {},
    }),
  });
  const screen = await render(
    <StoreProvider store={store}>
      <PairingScreen />
    </StoreProvider>,
  );
  try {
    expect(screen.getByLabelText("Connect computer")).toBeDisabled();
    await fireEvent.changeText(
      screen.getByLabelText("Eight-digit Desktop code"),
      "1234-5678",
    );
    await fireEvent.press(screen.getByLabelText("Connect computer"));
    expect(await screen.findByText("654321")).toBeTruthy();
    expect(
      screen.getByText(
        "Check that this code matches Desktop before approving.",
      ),
    ).toBeTruthy();
  } finally {
    store.dispose();
  }
});

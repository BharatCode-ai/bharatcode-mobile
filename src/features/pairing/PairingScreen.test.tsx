import { render } from "@testing-library/react-native";
import PairingScreen from "./PairingScreen";
import { StoreProvider } from "../../state/react";
import { AppStore } from "../../state/app-store";
import {
  ConversationStore,
  MemoryDatabase,
} from "../../storage/conversation-store";
const mockPair = jest.fn();
let mockLink: string | null = null;
jest.mock("expo-linking", () => ({ useURL: () => mockLink }));
const replace = jest.fn();
const mockRouter = { replace, back: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
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
  expect(screen.getByLabelText("Paste pairing code")).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
  store.dispose();
});

test("opening a Desktop pairing link starts approval without pasting", async () => {
  mockLink =
    "bharatcode://pair?origin=https%3A%2F%2Fpc.tunnel.bharatcode.ai&desktopID=pc_one";
  const store = new AppStore({
    persistence: new ConversationStore(new MemoryDatabase()),
    credentials: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
    },
  });
  store.pair = mockPair;
  await render(
    <StoreProvider store={store}>
      <PairingScreen />
    </StoreProvider>,
  );
  expect(mockPair).toHaveBeenCalledWith(mockLink);
  store.dispose();
  mockLink = null;
});

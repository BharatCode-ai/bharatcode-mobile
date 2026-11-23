import * as previewWorkspace from "../preview/workspace";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { Alert } from "react-native";
import { AppStore } from "../state/app-store";
import { StoreProvider } from "../state/react";
import {
  ConversationStore,
  MemoryDatabase,
} from "../storage/conversation-store";
import Chats from "./sessions/ChatsScreen";
import Activity from "./activity/ActivityScreen";
import Devices from "./devices/DevicesScreen";
import Changes from "./changes/ChangesScreen";
import Files from "./files/FilesScreen";

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: "ses_checkout" }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => {}),
}));

let store: AppStore;
beforeEach(async () => {
  jest.clearAllMocks();
  store = new AppStore({
    persistence: new ConversationStore(new MemoryDatabase()),
    credentials: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
    },
  });
  await store.enterPreview();
});
afterEach(() => {
  store.dispose();
  jest.restoreAllMocks();
});
function open(view: React.ReactNode) {
  return render(<StoreProvider store={store}>{view}</StoreProvider>);
}
test("search, clear filters, pick a project, and open the resulting chat", async () => {
  const ui = await open(<Chats />);
  await fireEvent.changeText(ui.getByLabelText("Search chats"), "no match");
  expect(ui.getByText("No results")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Clear filters"));
  await fireEvent.press(ui.getByLabelText("All projects"));
  await fireEvent.press(ui.getByRole("button", { name: "storefront" }));
  expect(ui.queryByLabelText("Review authentication middleware")).toBeNull();
  await fireEvent.press(ui.getByLabelText("Fix checkout validation"));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/conversation/[id]",
    params: { id: "ses_checkout" },
  });
});
test("activity rows open their owning conversation", async () => {
  const ui = await open(<Activity />);
  await fireEvent.press(ui.getByLabelText("Refresh activity"));
  const request = store.getSnapshot().requests[0]!;
  await fireEvent.press(ui.getByRole("button", { name: request.title }));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/conversation/[id]",
    params: { id: request.sessionID, mode: "control", request: request.id },
  });
});
test("device details expose removal confirmation, preferences and pairing", async () => {
  const dialog = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const ui = await open(<Devices />);
  await fireEvent.press(ui.getByLabelText(store.getSnapshot().device!.name));
  await fireEvent.press(ui.getByLabelText("Remove computer"));
  expect(dialog.mock.calls[0]?.[2]?.map((action) => action.text)).toEqual([
    "Cancel",
    "Remove",
  ]);
  await fireEvent.press(ui.getByLabelText("Close"));
  await fireEvent.press(ui.getByLabelText("Preferences and about"));
  expect(ui.getByText("Dark")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Close"));
  await fireEvent.press(ui.getByLabelText("Add computer"));
  expect(mockRouter.push).toHaveBeenCalledWith("/pair");
});
test("file reader retries, copies exact text, wraps and returns to its directory", async () => {
  jest
    .spyOn(store, "loadFile")
    .mockRejectedValueOnce(new Error("Computer unreachable"));
  const ui = await open(<Files />);
  await fireEvent.press(await ui.findByLabelText("Retry files"));
  await fireEvent.press(await ui.findByRole("button", { name: "README.md" }));
  await fireEvent.press(await ui.findByLabelText("Wrap lines"));
  expect(ui.getByLabelText("Disable wrap")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Copy file"));
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
    expect.stringContaining("apartmentIsOptional"),
  );
  await fireEvent.press(ui.getByLabelText("Parent folder"));
  expect(await ui.findByLabelText("README.md")).toBeTruthy();
});
test.each([
  [{ type: "file" as const, binary: true }, /Binary file/],
  [{ type: "file" as const, tooLarge: true }, /too large/],
  [{ type: "directory" as const, entries: [] }, /folder is empty/],
] as const)(
  "file reader explains an unavailable text preview %#",
  async (result, label) => {
    jest
      .spyOn(store, "loadFile")
      .mockResolvedValue({ ...result, path: "", entries: [] });
    const ui = await open(<Files />);
    expect(await ui.findByText(label)).toBeTruthy();
  },
);
test("diff picker changes the copied patch and distinguishes an empty patch", async () => {
  jest
    .spyOn(store, "loadChanges")
    .mockResolvedValue([
      { file: "address.ts", patch: "+added\n-removed" },
      { file: "photo.png" },
    ]);
  const ui = await open(<Changes />);
  await fireEvent.press(await ui.findByLabelText("Copy diff"));
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith("+added\n-removed");
  await fireEvent.press(ui.getByLabelText("Wrap lines"));
  await fireEvent.press(ui.getByLabelText("address.ts · 1/2"));
  await fireEvent.press(ui.getByLabelText("photo.png"));
  expect(ui.getByText(/No text diff available/)).toBeTruthy();
});
test("changes can recover from a read failure to a clean working tree", async () => {
  jest
    .spyOn(store, "loadChanges")
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue([]);
  const ui = await open(<Changes />);
  await fireEvent.press(await ui.findByLabelText("Retry changes"));
  await waitFor(() =>
    expect(ui.getByText("Working tree is clear")).toBeTruthy(),
  );
});

test("one secure connection card replaces the empty state and recovers on retry", async () => {
  const api = previewWorkspace.previewAPI();
  jest
    .spyOn(api, "request")
    .mockRejectedValueOnce(
      new TypeError(
        "fetch failed: javax.net.ssl.SSLHandshakeException: connection closed",
      ),
    );
  jest.spyOn(previewWorkspace, "previewAPI").mockReturnValueOnce(api);
  await store.enterPreview();
  const ui = await open(<Chats />);
  expect(ui.getAllByText("Couldn’t connect securely")).toHaveLength(1);
  expect(ui.queryByText(/javax|No chats yet|Couldn’t load chats/)).toBeNull();
  await fireEvent.press(ui.getByLabelText("Try again"));
  expect(await ui.findByLabelText("Fix checkout validation")).toBeTruthy();
  expect(ui.queryByText("Couldn’t connect securely")).toBeNull();
});

test("copy rejection keeps file content visible and offers manual selection", async () => {
  jest
    .mocked(Clipboard.setStringAsync)
    .mockRejectedValueOnce(new Error("native clipboard diagnostic"));
  const ui = await open(<Files />);
  await fireEvent.press(await ui.findByRole("button", { name: "README.md" }));
  await fireEvent.press(await ui.findByLabelText("Copy file"));
  expect(await ui.findByText("Clipboard unavailable")).toBeTruthy();
  expect(ui.queryByText(/native clipboard diagnostic/)).toBeNull();
  expect(ui.getByText(/apartmentIsOptional/)).toBeTruthy();
});

test("an activity refresh failure can recover without a false all-clear", async () => {
  const api = previewWorkspace.previewAPI();
  const normal = api.request.bind(api);
  let failActivity = true;
  api.request = (method, path, options) => {
    if (failActivity && path === "/api/session/active")
      return Promise.reject(
        new Error("The computer could not complete that request (403)."),
      );
    return normal(method, path, options);
  };
  jest.spyOn(previewWorkspace, "previewAPI").mockReturnValueOnce(api);
  await store.enterPreview();
  const ui = await open(<Activity />);
  expect(ui.getByText("Access wasn’t granted")).toBeTruthy();
  expect(ui.queryByText("All quiet for now")).toBeNull();
  failActivity = false;
  await fireEvent.press(ui.getByLabelText("Try again"));
  expect(await ui.findByText("Needs your attention")).toBeTruthy();
});

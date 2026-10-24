import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { QuestionSheet } from "./QuestionSheet";
import { StoreProvider } from "../../state/react";
import { AppStore } from "../../state/app-store";
import {
  ConversationStore,
  MemoryDatabase,
} from "../../storage/conversation-store";
import { AgentRequest } from "../../domain/types";
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
const request: AgentRequest = {
  id: "q",
  sessionID: "ses_auth",
  title: "Question",
  command: "",
  directory: "",
  question: true,
  questions: [
    {
      question: "Which approach?",
      options: [{ label: "First" }, { label: "Second" }],
      custom: true,
    },
  ],
};
test("a single-choice question replaces custom text and submits only the chosen option", async () => {
  const store = new AppStore({
    persistence: new ConversationStore(new MemoryDatabase()),
    credentials: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
    },
  });
  await store.enterPreview();
  const decide = jest.spyOn(store, "decide").mockResolvedValue(true);
  const close = jest.fn();
  const screen = await render(
    <StoreProvider store={store}>
      <QuestionSheet request={request} onClose={close} />
    </StoreProvider>,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Answer: Which approach?"),
    "Custom",
  );
  await fireEvent.press(screen.getByLabelText("☐ First"));
  await fireEvent.press(screen.getByLabelText("Send answer"));
  await waitFor(() =>
    expect(decide).toHaveBeenCalledWith(request, [["First"]]),
  );
  expect(close).toHaveBeenCalled();
  store.dispose();
});

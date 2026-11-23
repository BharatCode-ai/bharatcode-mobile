import { fireEvent, render } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { Linking } from "react-native";
import { Message } from "./Message";
import type { ChatMessage } from "../../domain/types";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => {}),
}));

function textViews(tree: unknown): number {
  if (!tree || typeof tree !== "object") return 0;
  const node = tree as { type?: string; children?: unknown[] };
  return (
    (node.type === "Text" ? 1 : 0) +
    (node.children ?? []).reduce<number>(
      (sum, child) => sum + textViews(child),
      0,
    )
  );
}

test("long plain replies preserve every line without a native text view per token", async () => {
  const reply: ChatMessage = {
    id: "reply",
    role: "assistant",
    text: "1\n2\n3",
    tools: [],
  };
  const screen = await render(<Message message={reply} />);
  try {
    const baseline = textViews(screen.toJSON());
    expect(baseline).toBeGreaterThan(0);
    const text = Array.from({ length: 600 }, (_, i) => String(i + 1)).join(
      "\n",
    );
    await screen.rerender(<Message message={{ ...reply, text }} />);
    expect(screen.getByText(text)).toBeTruthy();
    expect(textViews(screen.toJSON())).toBeLessThanOrEqual(baseline + 10);
  } finally {
    await screen.unmount();
  }
});

test("formatted reply spans keep their Markdown styling", async () => {
  const screen = await render(
    <Message
      message={{
        id: "rich",
        role: "assistant",
        text: "Hello **bold** and `code`.\nNext line.",
        tools: [],
      }}
    />,
  );
  try {
    expect(screen.getByText("bold")).toHaveStyle({ fontWeight: "bold" });
    expect(screen.getByText("code")).toHaveStyle({
      fontFamily: "JetBrainsMono",
    });
    expect(screen.getByText(/Next line\./)).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test.each([
  ["#", 25, 32],
  ["##", 21, 29],
  ["###", 18, 26],
])(
  "plain %s headings keep their heading styles",
  async (prefix, fontSize, lineHeight) => {
    const screen = await render(
      <Message
        message={{
          id: "heading",
          role: "assistant",
          text: `${prefix} Heading`,
          tools: [],
        }}
      />,
    );
    try {
      expect(screen.getByText("Heading")).toHaveStyle({ fontSize, lineHeight });
    } finally {
      await screen.unmount();
    }
  },
);

test("the reply, expanded code and expanded tool actions copy their own complete payloads", async () => {
  const code = "const result = 42;\n";
  const text = "Here is the result.\n\n```typescript\n" + code + "```";
  const output = "a".repeat(4200);
  const ui = await render(
    <Message
      message={{
        id: "r",
        role: "assistant",
        text,
        tools: [
          {
            id: "t",
            name: "Read file",
            status: "completed",
            input: "index.ts",
            output,
          },
        ],
      }}
    />,
  );
  await fireEvent.press(ui.getByLabelText("Copy reply"));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(text);
  await fireEvent.press(ui.getByLabelText("Expand"));
  await fireEvent.press(ui.getByLabelText("Copy code"));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(code);
  await fireEvent.press(ui.getByLabelText("Close"));
  await fireEvent.press(ui.getByLabelText("Read file · completed"));
  await fireEvent.press(ui.getByLabelText("View full tool output"));
  await fireEvent.press(ui.getByLabelText("Copy tool output"));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
    "Input\nindex.ts\n\nOutput\n" + output,
  );
  await fireEvent.press(ui.getByLabelText("Close"));
  await fireEvent.press(ui.getByLabelText("Read file · completed"));
  expect(ui.queryByLabelText("View full tool output")).toBeNull();
});
test("a reply link opens its displayed HTTP destination", async () => {
  const launch = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  try {
    const ui = await render(
      <Message
        message={{
          id: "link",
          role: "assistant",
          text: "[Read docs](https://example.org/docs)",
          tools: [],
        }}
      />,
    );
    await fireEvent.press(ui.getByText("Read docs"));
    expect(launch).toHaveBeenCalledWith("https://example.org/docs");
  } finally {
    launch.mockRestore();
  }
});

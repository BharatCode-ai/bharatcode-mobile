import { render } from "@testing-library/react-native";
import { Message } from "./Message";
import type { ChatMessage } from "../../domain/types";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

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

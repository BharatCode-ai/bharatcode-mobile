import { ConversationProjection } from "./conversation-projection";
const raw = (id: string, text: string) => ({
  id,
  type: "assistant",
  content: [{ id: "txt", type: "text", text }],
});
test("delta attaches to historical prefix and duplicate events are ignored", () => {
  const p = new ConversationProjection();
  p.page([raw("msg", "Hello")], undefined);
  const event = {
    id: "one",
    type: "session.next.text.delta",
    data: {
      sessionID: "ses",
      assistantMessageID: "msg",
      textID: "txt",
      delta: " world",
    },
  };
  p.apply(event, "ses");
  p.apply(event, "ses");
  expect(p.messages()[0]?.text).toBe("Hello world");
  p.page([raw("msg", "Hello world!")], undefined);
  expect(p.messages()[0]?.text).toBe("Hello world!");
});
test("authoritative divergent history wins over provisional content", () => {
  const p = new ConversationProjection();
  p.page([raw("msg", "old")], "before");
  p.apply(
    {
      type: "session.next.text.delta",
      data: {
        sessionID: "ses",
        assistantMessageID: "msg",
        textID: "txt",
        delta: " partial",
      },
    },
    "ses",
  );
  p.page([raw("msg", "Server corrected text")], undefined);
  expect(p.messages()[0]?.text).toBe("Server corrected text");
});
test("events from another conversation do not project text", () => {
  const p = new ConversationProjection();
  p.apply(
    {
      type: "session.next.text.delta",
      data: {
        sessionID: "wrong",
        assistantMessageID: "msg",
        textID: "txt",
        delta: "leak",
      },
    },
    "ses",
  );
  expect(p.messages()).toEqual([]);
});
test("long gap replaces the history window and older cursor", () => {
  const p = new ConversationProjection();
  p.page([raw("msg2", "second"), raw("msg1", "first")], "older");
  p.page([raw("msg100", "latest")], "before100");
  expect(p.messages().map((m) => m.id)).toEqual(["msg100"]);
  expect(p.cursor).toBe("before100");
  p.page([raw("msg99", "previous")], undefined, true);
  expect(p.messages().map((m) => m.id)).toEqual(["msg99", "msg100"]);
});
test("streaming only decodes the changed reply and preserves completed message identities", () => {
  const p = new ConversationProjection();
  p.page([raw("tail", "Live"), raw("head", "Completed")], undefined);
  const before = p.messages();
  p.apply(
    {
      type: "session.next.text.delta",
      data: {
        sessionID: "ses",
        assistantMessageID: "tail",
        textID: "txt",
        delta: " update",
      },
    },
    "ses",
  );
  const after = p.messages();
  expect(after[0]).toBe(before[0]);
  expect(after[1]?.text).toBe("Live update");
  expect(after[1]).not.toBe(before[1]);
  expect(p.messages()[1]).toBe(after[1]);
  p.page([raw("tail", "Live update"), raw("head", "Corrected")], undefined);
  expect(p.messages()[0]?.text).toBe("Corrected");
  expect(p.messages()[1]?.text).toBe("Live update");
});
test("identical history refreshes preserve completed reply identities while tool changes replace them", () => {
  const p = new ConversationProjection();
  const page = (output: string) => [
    {
      ...raw("tail", "Live"),
      content: [
        {
          id: "tool",
          type: "tool",
          name: "Read",
          state: { status: "completed", content: output },
        },
      ],
    },
    raw("head", "Completed"),
  ];
  p.page(page("original"), undefined);
  const before = p.messages();
  p.page(page("original"), undefined);
  const refreshed = p.messages();
  expect(refreshed[0]).toBe(before[0]);
  expect(refreshed[1]).toBe(before[1]);
  p.page(page("changed"), undefined);
  const changed = p.messages();
  expect(changed[0]).toBe(before[0]);
  expect(changed[1]?.tools[0]?.output).toBe("changed");
  expect(changed[1]).not.toBe(before[1]);
});

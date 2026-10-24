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

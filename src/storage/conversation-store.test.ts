import { ConversationStore, MemoryDatabase } from "./conversation-store";
test("draft and outgoing identity persist across store instances", async () => {
  const db = new MemoryDatabase();
  const one = new ConversationStore(db);
  await one.saveDraft("pc", "ses", "hello");
  await one.savePending("pc", "ses", {
    id: "msg_one",
    text: "hello",
    state: "pending",
  });
  const two = new ConversationStore(db);
  expect((await two.read("pc", "ses")).pending?.id).toBe("msg_one");
  await two.saveDraft("pc", "ses", "new draft");
  await two.admit("pc", "ses", "msg_one", "hello");
  expect(await two.read("pc", "ses")).toMatchObject({
    draft: "new draft",
    pending: { state: "admitted" },
  });
  expect((await two.read("other", "ses")).draft).toBe("");
  await two.clearDevice("pc");
  expect((await one.read("pc", "ses")).pending).toBeUndefined();
});
test("admission cannot clear another outgoing message", async () => {
  const store = new ConversationStore(new MemoryDatabase());
  await store.saveDraft("p", "s", "hello");
  await store.savePending("p", "s", {
    id: "one",
    text: "hello",
    state: "pending",
  });
  await expect(store.admit("p", "s", "other", "hello")).rejects.toThrow();
  expect((await store.read("p", "s")).draft).toBe("hello");
});
test("reading immediately after an unawaited draft write sees that write", async () => {
  const store = new ConversationStore(new MemoryDatabase());
  const saving = store.saveDraft("pc", "ses", "Fresh typing");
  expect((await store.read("pc", "ses")).draft).toBe("Fresh typing");
  await saving;
});

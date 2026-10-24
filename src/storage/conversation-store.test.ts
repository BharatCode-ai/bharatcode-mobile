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
test("typing with large cached history writes only the draft and preserves history across restart", async () => {
  const db = new MemoryDatabase();
  const store = new ConversationStore(db);
  const messages = [{ id: "reply", text: "x".repeat(1_000_000) }];
  await store.saveCache("pc", "ses", messages, 42);
  let bytes = 0;
  const set = db.set.bind(db);
  db.set = async (key, value) => {
    bytes += value.length;
    await set(key, value);
  };
  for (const text of ["a", "ab", "abc"])
    await store.saveDraft("pc", "ses", text);
  expect(bytes).toBeLessThan(1_000);
  expect(await new ConversationStore(db).read("pc", "ses")).toEqual({
    draft: "abc",
    messages,
    sequence: 42,
  });
  await store.clearDevice("pc");
  expect(await store.read("pc", "ses")).toEqual({ draft: "" });
});
test("legacy cached records migrate atomically without losing draft, history or pending identity", async () => {
  const db = new MemoryDatabase();
  await db.set(
    "conversation:pc:ses",
    JSON.stringify({
      draft: "old",
      messages: [{ id: "reply", text: "original" }],
      sequence: 7,
      pending: { id: "one", text: "old", state: "pending" },
    }),
  );
  const store = new ConversationStore(db);
  await store.saveDraft("pc", "ses", "new");
  await store.admit("pc", "ses", "one", "old");
  expect(await new ConversationStore(db).read("pc", "ses")).toEqual({
    draft: "new",
    messages: [{ id: "reply", text: "original" }],
    sequence: 7,
    pending: { id: "one", text: "old", state: "admitted" },
  });
});
test.each([1, 2])(
  "legacy migration failure at write %i preserves the old record and can be retried",
  async (failureAt) => {
    const db = new MemoryDatabase();
    const legacy = {
      draft: "old",
      messages: [{ id: "m", text: "saved" }],
      sequence: 9,
      pending: { id: "one", text: "old", state: "pending" },
    };
    await db.set("conversation:pc:ses", JSON.stringify(legacy));
    const set = db.set.bind(db);
    let writes = 0;
    db.set = async (key, value) => {
      if (++writes === failureAt) {
        throw new Error("disk full");
      }
      return set(key, value);
    };
    const store = new ConversationStore(db);
    await expect(store.saveDraft("pc", "ses", "new")).rejects.toThrow(
      "disk full",
    );
    expect(await new ConversationStore(db).read("pc", "ses")).toEqual(legacy);
    await store.saveDraft("pc", "ses", "new");
    expect(await new ConversationStore(db).read("pc", "ses")).toEqual({
      ...legacy,
      draft: "new",
    });
  },
);

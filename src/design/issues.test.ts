import { describeIssue } from "./issues";
import { message } from "../domain/decode";

test.each([
  [
    "fetch failed: javax.net.ssl.SSLHandshakeException: connection closed",
    undefined,
    "Couldn’t connect securely",
  ],
  ["Network request failed", undefined, "Can’t reach Desktop"],
  ["Pairing code expired or used", 401, "Pairing code expired or invalid"],
  ["Revoked", 401, "Pair this phone again"],
  ["Desktop identity or protocol did not match", 409, "Pair this phone again"],
  ["Conflict", 409, "This item has changed"],
  ["Bad input", 422, "Desktop couldn’t use that input"],
  ["Unavailable", 403, "Access wasn’t granted"],
  ["Unavailable", 404, "This item is unavailable"],
  ["Unavailable", 408, "Desktop took too long to respond"],
  ["Response", 413, "Too much to load at once"],
  [
    "The computer could not complete that request (429).",
    undefined,
    "Too many requests right now",
  ],
  ["Response", 503, "Desktop couldn’t finish the request"],
  ["Draft could not be saved", undefined, "Your draft hasn’t been saved"],
  ["Approval delivery unknown", 502, "Decision not confirmed"],
  ["Create delivery unknown", undefined, "New chat not confirmed"],
  ["Stop delivery unknown", undefined, "Stop not confirmed"],
  ["Delivery is unconfirmed", undefined, "Message delivery is unconfirmed"],
  [
    "Message sent. Conversation updates are temporarily unavailable.",
    undefined,
    "Message sent",
  ],
  ["Connection declined on your computer.", undefined, "Pairing was declined"],
  ["reply/billing", undefined, "Provider credits are unavailable"],
  ["reply/access", undefined, "The model needs authorization"],
  ["reply/length", undefined, "The model reached its length limit"],
  ["reply/busy", undefined, "The model is busy"],
  ["reply/stopped", undefined, "Reply stopped"],
  ["reply/unrecognized", undefined, "The reply was interrupted"],
  ["SQLite failed", undefined, "Local storage is unavailable"],
  ["Clipboard unavailable", undefined, "Clipboard unavailable"],
  ["foreign diagnostic", undefined, "Couldn’t load chats"],
] as const)("presents %s with a recovery step", (raw, status, title) => {
  const result = describeIssue(raw, "Couldn’t load chats", "MSI", status);
  expect(result.title).toBe(title);
  expect(result.detail.length).toBeGreaterThan(20);
  expect(result.detail).not.toContain("javax.");
});

test("legacy Desktop errors are hidden without changing actual reply text", () => {
  const failure = {
    id: "m_error",
    type: "text",
    text: "The computer reported: secret stack trace",
  };
  const partial = {
    id: "paragraph",
    type: "text",
    text: "The computer reported: text in a normal reply",
  };
  expect(
    message({ id: "m", type: "assistant", content: [partial, failure] }),
  ).toMatchObject({ text: partial.text, replyIssue: "interrupted" });
  expect(
    message({
      id: "m",
      type: "assistant",
      content: [partial, { ...failure, replyIssue: "access" }],
    }).replyIssue,
  ).toBe("access");
});

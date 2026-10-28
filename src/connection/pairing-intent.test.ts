import { redirectSystemPath } from "../../app/+native-intent";

const link =
  "bharatcode://pair?origin=https%3A%2F%2Fpc.tunnel.bharatcode.ai&desktopID=pc_one";
const route = (path: string, initial = false) =>
  new URL(redirectSystemPath({ path, initial }), "https://router.invalid");

test.each(["bharatcode://", "bharatcode:///"])(
  "a cold launcher root opens the app without submitting a pairing claim: %s",
  (path) => expect(redirectSystemPath({ path, initial: true })).toBe("/"),
);

test.each([
  "bharatcode://?token=do-not-copy",
  "bharatcode:///?token=do-not-copy",
  "bharatcode:///pair",
])("cold malformed links still fail closed: %s", (path) => {
  const target = route(path, true);
  expect(target.searchParams.get("link")).toBe("invalid");
  expect(target.href).not.toContain("do-not-copy");
});

test("native cold and warm pairing intents retain the validated public URI", () => {
  for (const initial of [true, false]) {
    const target = route(link, initial);
    expect(target.pathname).toBe("/pair");
    expect(target.searchParams.get("link")).toBe(link);
  }
});

test("opening the same public link again delivers a new pairing attempt", () => {
  const first = route(link),
    second = route(link);
  expect(first.searchParams.get("delivery")).not.toBe(
    second.searchParams.get("delivery"),
  );
});

test.each([
  link + "&token=do-not-copy",
  link + "&desktopID=pc_two",
  link.replace("https%3A", "http%3A"),
  link.replace("//pair", "//user:do-not-copy@pair"),
  link.replace("//pair", "///pair"),
])("invalid native pairing intents cannot reach claim data: %s", (input) => {
  const target = route(input);
  expect(target.pathname).toBe("/pair");
  expect(target.searchParams.get("link")).toBe("invalid");
  expect(target.href).not.toContain("do-not-copy");
});

test.each(["/pair", "/(tabs)/chats", "exp://127.0.0.1:8081/--/"])(
  "ordinary and development routes remain usable: %s",
  (path) => expect(redirectSystemPath({ path, initial: true })).toBe(path),
);

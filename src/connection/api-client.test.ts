import { ApiClient } from "./api-client";
const fake = jest.fn();
test("sends JSON and credentials only to normalized hosted origin with redirect error", async () => {
  fake.mockResolvedValue(new Response('{"data":[]}', { status: 200 }));
  const api = new ApiClient("https://pc.tunnel.bharatcode.ai", "secret", fake);
  await api.request("POST", "/api/session", {
    body: {},
    query: { "location[directory]": "/project x" },
  });
  expect(fake.mock.calls[0][0]).toBe(
    "https://pc.tunnel.bharatcode.ai/api/session?location%5Bdirectory%5D=%2Fproject+x",
  );
  expect(fake.mock.calls[0][1]).toMatchObject({
    redirect: "error",
    credentials: "omit",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: "{}",
  });
  await expect(api.request("GET", "//evil.com")).rejects.toThrow();
  api.close();
});
test("401 is distinct from a transient connection failure", async () => {
  fake.mockResolvedValue(new Response("{}", { status: 401 }));
  const api = new ApiClient("https://pc.tunnel.bharatcode.ai", "x", fake);
  await expect(api.request("GET", "/mobile/v1/health")).rejects.toMatchObject({
    status: 401,
  });
  api.close();
});

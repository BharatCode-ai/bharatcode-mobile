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
test("a gateway device rejection requires pairing again", async () => {
  fake.mockResolvedValue(
    Response.json({ error: "Device authorization required" }, { status: 401 }),
  );
  const api = new ApiClient("https://pc.tunnel.bharatcode.ai", "x", fake);
  await expect(api.request("GET", "/mobile/v1/health")).rejects.toMatchObject({
    status: 401,
  });
  api.close();
});

test.each([
  ["/mobile/v1/health", "<html>Tunnel authentication required</html>"],
  ["/api/session", '{"error":"Computer could not complete the request"}'],
  ["/mobile/v1/claim/status", "{}"],
])("unrelated 401 on %s allows reconnection", async (path, body) => {
  const api = new ApiClient(
    "https://pc.tunnel.bharatcode.ai",
    "token",
    async () =>
      new Response(body, {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
  );
  await expect(api.request("GET", path)).rejects.toMatchObject({ status: 502 });
  api.close();
});

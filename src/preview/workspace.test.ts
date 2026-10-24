import { previewAPI } from "./workspace";
import { Json } from "../domain/types";
test("sample requests are scoped to their owning conversation", async () => {
  const api = previewAPI();
  expect(
    (await api.request<Json>("GET", "/api/session/ses_checkout/permission"))
      .data,
  ).toEqual([]);
  expect(
    (await api.request<Json>("GET", "/api/session/ses_auth/permission")).data,
  ).toHaveLength(1);
});
test("sample Stop changes the actual sample activity state", async () => {
  const api = previewAPI();
  await api.request("POST", "/api/session/ses_checkout/interrupt");
  expect((await api.request<Json>("GET", "/api/session/active")).data).toEqual(
    {},
  );
});

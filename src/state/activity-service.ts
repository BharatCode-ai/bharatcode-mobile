import { API, AgentRequest, Json, SessionSummary } from "../domain/types";
import { list, record, request } from "../domain/decode";
export async function discoverActivity(
  api: API,
  sessions: SessionSummary[],
  signal: AbortSignal,
) {
  const active = record(
    (await api.request<Json>("GET", "/api/session/active", { signal })).data,
  );
  const requests: AgentRequest[] = [];
  for (const directory of new Set(sessions.map((s) => s.directory))) {
    const query = directory ? { "location[directory]": directory } : undefined;
    const values = await Promise.all(
      ["permission", "question"].map((kind) =>
        api.request<Json>("GET", `/api/${kind}/request`, { query, signal }),
      ),
    );
    values.forEach((v, i) =>
      list(v.data).forEach((raw) => {
        if (!requests.some((r) => r.id === raw.id))
          requests.push(request(raw, directory, i === 1));
      }),
    );
  }
  return {
    requests,
    sessions: sessions.map((s) => ({
      ...s,
      status: requests.some((r) => r.sessionID === s.id)
        ? ("attention" as const)
        : Object.hasOwn(active, s.id)
          ? ("running" as const)
          : ("idle" as const),
    })),
  };
}

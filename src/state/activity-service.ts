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
  const seen = new Set<string>();
  const directories = [...new Set(sessions.map((s) => s.directory))];
  // Bound fan-out over the hosted tunnel: three projects, two requests each.
  for (let offset = 0; offset < directories.length; offset += 3) {
    const groups = await Promise.all(
      directories.slice(offset, offset + 3).map(async (directory) => {
        const query = directory
          ? { "location[directory]": directory }
          : undefined;
        const values = await Promise.all(
          ["permission", "question"].map((kind) =>
            api.request<Json>("GET", `/api/${kind}/request`, { query, signal }),
          ),
        );
        return values.flatMap((v, i) =>
          list(v.data).map((raw) => request(raw, directory, i === 1)),
        );
      }),
    );
    for (const item of groups.flat()) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      requests.push(item);
    }
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

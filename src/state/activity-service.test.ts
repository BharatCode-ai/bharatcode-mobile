import { API, SessionSummary } from "../domain/types";
import { discoverActivity } from "./activity-service";

test("activity checks projects concurrently with bounded requests and complete results", async () => {
  jest.useFakeTimers();
  let inFlight = 0,
    peak = 0;
  const sessions: SessionSummary[] = Array.from({ length: 5 }, (_, i) => ({
    id: `s${i}`,
    title: `Chat ${i}`,
    project: `p${i}`,
    directory: `/p${i}`,
    updated: 1,
    status: "idle",
  }));
  const api: API = {
    async request<T>(
      _method: string,
      path: string,
      options?: { query?: Record<string, string> },
    ) {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 25));
      inFlight--;
      return {
        data: path.endsWith("/active")
          ? { s0: {} }
          : path === "/api/question/request" &&
              options?.query?.["location[directory]"] === "/p4"
            ? [
                {
                  id: "q",
                  sessionID: "s4",
                  questions: [{ question: "Proceed?" }],
                },
              ]
            : [],
      } as T;
    },
    async *events() {},
    async *liveEvents() {},
    close() {},
  };
  try {
    const started = Date.now();
    let completedAt = 0;
    const pending = discoverActivity(
      api,
      sessions,
      new AbortController().signal,
    ).then((value) => {
      completedAt = Date.now() - started;
      return value;
    });
    await jest.runAllTimersAsync();
    const result = await pending;
    expect(result.sessions.map((s) => s.status)).toEqual([
      "running",
      "idle",
      "idle",
      "idle",
      "attention",
    ]);
    expect(result.requests[0]).toMatchObject({
      id: "q",
      sessionID: "s4",
      question: true,
    });
    expect(inFlight).toBe(0);
    expect(peak).toBeLessThanOrEqual(6);
    expect(completedAt).toBeLessThanOrEqual(75);
  } finally {
    jest.useRealTimers();
  }
});

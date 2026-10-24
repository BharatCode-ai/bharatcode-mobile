import { API, Json, WireEvent } from "../domain/types";
import { validateOrigin } from "./pairing-payload";
import { decodeSse } from "./sse";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export class ApiClient implements API {
  private active = new Set<AbortController>();
  readonly origin: string;
  constructor(
    origin: string,
    private token: string,
    private fetcher: Fetcher = globalThis.fetch,
  ) {
    this.origin = validateOrigin(origin);
  }
  private async *bytes(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string>;
      signal?: AbortSignal;
    } = {},
    stream = false,
  ): AsyncIterable<Uint8Array> {
    if (
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("://") ||
      /[\\#?]/.test(path)
    )
      throw new Error("Invalid API path");
    const url = new URL(path, this.origin);
    if (options.query)
      url.search = new URLSearchParams(options.query).toString();
    const controller = new AbortController();
    this.active.add(controller);
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort);
    if (options.signal?.aborted) controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), ms);
    };
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      arm(20_000);
      const response = await this.fetcher(url.toString(), {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: {
          accept: stream ? "text/event-stream" : "application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...(options.body !== undefined
            ? { "content-type": "application/json" }
            : {}),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiError(
          response.status,
          response.status === 401
            ? "This phone is no longer authorized. Pair again."
            : response.status === 404
              ? "This feature is unavailable or was resolved on Desktop."
              : `The computer could not complete that request (${response.status}).`,
        );
      }
      if (
        response.redirected ||
        (response.url && new URL(response.url).origin !== this.origin)
      )
        throw new ApiError(502, "Unexpected connection redirect");
      if (!response.body) return;
      reader = response.body.getReader();
      let size = 0;
      while (true) {
        arm(stream ? 45_000 : 20_000);
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          size += value.length;
          if (!stream && size > 16_777_216)
            throw new ApiError(
              413,
              "Response is too large. Try a smaller page.",
            );
          yield value;
        }
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
      options.signal?.removeEventListener("abort", abort);
      this.active.delete(controller);
      void reader?.cancel().catch(() => {});
    }
  }
  async request<T = Json>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, string>;
      signal?: AbortSignal;
    },
  ): Promise<T> {
    const decoder = new TextDecoder();
    let text = "";
    for await (const chunk of this.bytes(method, path, options))
      text += decoder.decode(chunk, { stream: true });
    text += decoder.decode();
    const value: unknown = text ? JSON.parse(text) : {};
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Unexpected server response");
    return value as T;
  }
  events(
    session: string,
    after: number,
    signal: AbortSignal,
  ): AsyncIterable<WireEvent> {
    return decodeSse(
      this.bytes(
        "GET",
        `/api/session/${encodeURIComponent(session)}/event`,
        { query: { after: String(after) }, signal },
        true,
      ),
    );
  }
  liveEvents(session: string, signal: AbortSignal): AsyncIterable<WireEvent> {
    return decodeSse(
      this.bytes(
        "GET",
        `/mobile/v1/session/${encodeURIComponent(session)}/live`,
        { signal },
        true,
      ),
    );
  }
  close() {
    for (const c of this.active) c.abort();
    this.active.clear();
  }
}

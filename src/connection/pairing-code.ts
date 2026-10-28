import { PairingPayload, validateOrigin } from "./pairing-payload";
export interface PairingCodeOptions {
  signal?: AbortSignal;
  transport?: typeof fetch;
  now?: () => number;
}
const unavailable =
  "Pairing is unavailable. Generate a new code on Desktop and try again.";
export function normalizePairingCode(text: string): string {
  if (typeof text !== "string" || text.length > 64 || !/^[0-9 -]+$/.test(text))
    throw new Error("Enter the eight-digit code from Desktop.");
  const code = text.replace(/[ -]/g, "");
  if (!/^[0-9]{8}$/.test(code))
    throw new Error("Enter the eight-digit code from Desktop.");
  return code;
}
async function boundedText(response: Response): Promise<string> {
  const size = response.headers.get("content-length");
  if (size && (!/^\d+$/.test(size) || Number(size) > 4096))
    throw new Error(unavailable);
  // Native fetch implementations may expose only text(); browser streams can
  // stop reading as soon as the byte budget is exceeded.
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 4096) throw new Error(unavailable);
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new TextDecoder().decode(bytes);
    } finally {
      await reader.cancel().catch(() => {});
    }
  }
  const text = await response.text();
  if (text.length > 4096) throw new Error(unavailable);
  return text;
}
export async function resolvePairingCode(
  text: string,
  options: PairingCodeOptions = {},
): Promise<PairingPayload> {
  const code = normalizePairingCode(text);
  const now = options.now ?? Date.now;
  const started = now();
  const controller = new AbortController();
  let rejectAbort!: (error: Error) => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const cancel = () => {
    controller.abort();
    rejectAbort(new Error("Pairing cancelled."));
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    controller.abort();
    rejectAbort(new Error(unavailable));
  }, 15000);
  try {
    if (options.signal?.aborted) throw new Error("Pairing cancelled.");
    return await Promise.race([
      aborted,
      (async () => {
        let response: Response;
        try {
          response = await (options.transport ?? fetch)(
            "https://tunnel.bharatcode.ai/api/pairing/redeem",
            {
              method: "POST",
              redirect: "error",
              credentials: "omit",
              cache: "no-store",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ code }),
              signal: controller.signal,
            },
          );
        } catch {
          throw new Error(unavailable);
        }
        if (controller.signal.aborted) throw new Error(unavailable);
        if (
          response.redirected ||
          (response.url &&
            response.url !== "https://tunnel.bharatcode.ai/api/pairing/redeem")
        )
          throw new Error(unavailable);
        if (response.status === 429)
          throw new Error(
            "Too many attempts. Wait before trying a new Desktop code.",
          );
        if ([400, 404, 409, 410].includes(response.status))
          throw new Error(
            "Code expired or already used. Generate a new code on Desktop.",
          );
        if (!response.ok) throw new Error(unavailable);
        try {
          const p = JSON.parse(await boundedText(response));
          if (
            !p ||
            typeof p !== "object" ||
            Array.isArray(p) ||
            Object.keys(p).sort().join(",") !==
              "code,desktopID,expiresAt,origin,serverTime,v" ||
            p.v !== 1 ||
            typeof p.desktopID !== "string" ||
            !/^pc_[A-Za-z0-9_-]{1,128}$/.test(p.desktopID) ||
            typeof p.code !== "string" ||
            !/^[A-Za-z0-9_-]{43}$/.test(p.code) ||
            !Number.isSafeInteger(p.serverTime) ||
            !Number.isSafeInteger(p.expiresAt)
          )
            throw new Error();
          const ttl = p.expiresAt - p.serverTime;
          if (
            ttl < 1 ||
            ttl > 300000 ||
            started + ttl <= now() ||
            controller.signal.aborted
          )
            throw new Error();
          return {
            v: 1 as const,
            origin: validateOrigin(p.origin),
            desktopID: p.desktopID,
            code: p.code,
            expiresAt: started + ttl,
          };
        } catch {
          throw new Error(unavailable);
        }
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export interface PairingPayload {
  v: 1;
  origin: string;
  desktopID: string;
  code?: string;
  expiresAt?: number;
}
export function validateOrigin(value: string): string {
  if (
    typeof value !== "string" ||
    !/^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+tunnel\.bharatcode\.ai(?::443)?\/?$/i.test(
      value,
    )
  )
    throw new Error("Scan a valid BharatCode Desktop pairing QR.");
  const url = new URL(value);
  return url.origin;
}
export function parsePairingPayload(
  text: string,
  now = Date.now(),
): PairingPayload {
  let p: PairingPayload;
  if (text.startsWith("bharatcode:")) {
    const url = new URL(text);
    if (
      url.protocol !== "bharatcode:" ||
      url.hostname !== "pair" ||
      url.pathname !== "" ||
      url.hash ||
      url.username ||
      url.password ||
      url.port ||
      [...url.searchParams.keys()].some(
        (key) => !["origin", "desktopID"].includes(key),
      ) ||
      url.searchParams.getAll("origin").length !== 1 ||
      url.searchParams.getAll("desktopID").length !== 1 ||
      !/^pc_[A-Za-z0-9_-]+$/.test(url.searchParams.get("desktopID") ?? "")
    )
      throw new Error("This link is not a BharatCode Desktop pairing link.");
    return {
      v: 1,
      origin: validateOrigin(url.searchParams.get("origin") ?? ""),
      desktopID: url.searchParams.get("desktopID")!,
    };
  }
  try {
    p = JSON.parse(text);
  } catch {
    throw new Error("This QR is not a BharatCode pairing code.");
  }
  if (
    !p ||
    p.v !== 1 ||
    typeof p.origin !== "string" ||
    !/^pc_[A-Za-z0-9_-]+$/.test(p.desktopID ?? "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(p.code ?? "") ||
    !Number.isSafeInteger(p.expiresAt) ||
    p.expiresAt! <= now ||
    p.expiresAt! - now > 360_000
  )
    throw new Error(
      "Pairing code is invalid or expired. Refresh it on Desktop.",
    );
  return { ...p, origin: validateOrigin(p.origin) };
}

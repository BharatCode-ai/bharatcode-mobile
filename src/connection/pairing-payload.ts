export interface PairingPayload {
  v: 1;
  origin: string;
  desktopID: string;
  code: string;
  expiresAt: number;
}
export function validateOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Scan a valid BharatCode Desktop pairing QR.");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".opentunnel.xyz") ||
    url.hostname === "opentunnel.xyz" ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    value.includes("?") ||
    value.includes("#") ||
    value.includes("\\")
  )
    throw new Error("Scan a valid BharatCode Desktop pairing QR.");
  return url.origin;
}
export function parsePairingPayload(
  text: string,
  now = Date.now(),
): PairingPayload {
  let p: PairingPayload;
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
    p.expiresAt <= now ||
    p.expiresAt - now > 360_000
  )
    throw new Error(
      "Pairing code is invalid or expired. Refresh it on Desktop.",
    );
  return { ...p, origin: validateOrigin(p.origin) };
}

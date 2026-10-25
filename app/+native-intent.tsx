import { parsePairingPayload } from "../src/connection/pairing-payload";

let delivery = 0;

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  if (!path.startsWith("bharatcode:")) return path;
  let link = "invalid";
  try {
    parsePairingPayload(path);
    link = path;
  } catch {
    // Never copy a malformed URI's credentials or extra parameters into a route.
  }
  // Public links stay identical when Desktop refreshes its pairing window.
  // Give each delivered intent its own identity so cancellation can be retried.
  return `/pair?${new URLSearchParams({ link, delivery: String(++delivery) })}`;
}

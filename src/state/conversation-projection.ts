import { Json, WireEvent } from "../domain/types";
import { list, message } from "../domain/decode";
export class ConversationProjection {
  raw: Json[] = [];
  private seen = new Set<string>();
  private overlays = new Map<string, Map<string, string>>();
  private tail?: string;
  cursor?: string;
  private loaded = false;
  hydrate(raw: Json[]) {
    this.raw = raw;
    this.tail = raw.at(-1)?.id as string | undefined;
  }
  page(raw: Json[], cursor: string | undefined, older = false) {
    const incoming = [...raw].reverse();
    if (older) {
      const ids = new Set(this.raw.map((r) => r.id));
      this.raw = [...incoming.filter((r) => !ids.has(r.id)), ...this.raw];
      this.cursor = cursor;
    } else {
      if (this.tail && !incoming.some((r) => r.id === this.tail)) {
        this.raw = [];
        this.overlays.clear();
        this.loaded = false;
      }
      for (const item of incoming) {
        const overlays = this.overlays.get(String(item.id));
        for (const p of list(item.content)) {
          const live = overlays?.get(String(p.id));
          const text = String(p.text ?? "");
          if (
            p.type === "text" &&
            live !== undefined &&
            (text.startsWith(live) || (text && !live.startsWith(text)))
          )
            overlays?.delete(String(p.id));
        }
        const i = this.raw.findIndex((r) => r.id === item.id);
        if (i < 0) this.raw.push(item);
        else this.raw[i] = item;
      }
      if (!this.loaded) {
        this.cursor = cursor;
        this.loaded = true;
      }
      this.tail = incoming.at(-1)?.id as string | undefined;
    }
  }
  apply(event: WireEvent, session: string) {
    if (event.id && this.seen.has(event.id)) return false;
    if (event.id) {
      this.seen.add(event.id);
      if (this.seen.size > 2000)
        this.seen.delete(this.seen.values().next().value!);
    }
    const d = event.data ?? {};
    if (d.sessionID !== session) return false;
    if (
      event.type?.startsWith("session.next.text.") &&
      typeof d.assistantMessageID === "string" &&
      typeof d.textID === "string"
    ) {
      let raw = this.raw.find((r) => r.id === d.assistantMessageID);
      if (!raw) {
        raw = { id: d.assistantMessageID, type: "assistant", content: [] };
        this.raw.push(raw);
      }
      const parts =
        this.overlays.get(d.assistantMessageID) ?? new Map<string, string>();
      this.overlays.set(d.assistantMessageID, parts);
      const existing = list(raw.content).find((p) => p.id === d.textID);
      if (event.type.endsWith(".delta"))
        parts.set(
          d.textID,
          (parts.get(d.textID) ?? String(existing?.text ?? "")) +
            String(d.delta ?? ""),
        );
      if (event.type.endsWith(".ended"))
        parts.set(d.textID, String(d.text ?? ""));
    }
    return true;
  }
  messages() {
    return this.raw.map((raw) => {
      const overlay = this.overlays.get(String(raw.id));
      if (!overlay) return message(raw);
      const content = list(raw.content).map((p) => ({ ...p }));
      for (const [id, text] of overlay) {
        const i = content.findIndex((p) => p.id === id);
        if (i < 0) content.push({ id, type: "text", text });
        else content[i] = { id, type: "text", text };
      }
      return message({ ...raw, content });
    });
  }
}

import { ConversationRecord, PendingPrompt } from "../domain/types";
export interface Database {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
export class MemoryDatabase implements Database {
  private data = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();
  async get(key: string) {
    return this.data.get(key);
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
  }
  async removePrefix(prefix: string) {
    for (const key of this.data.keys())
      if (key.startsWith(prefix)) this.data.delete(key);
  }
  transaction<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue
      .catch(() => {})
      .then(async () => {
        const backup = new Map(this.data);
        try {
          return await work();
        } catch (e) {
          this.data = backup;
          throw e;
        }
      });
    this.queue = next;
    return next;
  }
}
export class ConversationStore {
  constructor(readonly db: Database) {}
  private key(device: string, session: string) {
    return `conversation:${device}:${session}`;
  }
  read(device: string, session: string): Promise<ConversationRecord> {
    return this.db.transaction(() => this.readCurrent(device, session));
  }
  private async readCurrent(
    device: string,
    session: string,
  ): Promise<ConversationRecord> {
    const text = await this.db.get(this.key(device, session));
    return text ? JSON.parse(text) : { draft: "" };
  }
  private update(
    device: string,
    session: string,
    work: (value: ConversationRecord) => void,
  ) {
    return this.db.transaction(async () => {
      const value = await this.readCurrent(device, session);
      work(value);
      await this.db.set(this.key(device, session), JSON.stringify(value));
    });
  }
  saveDraft(d: string, s: string, text: string) {
    return this.update(d, s, (v) => {
      v.draft = text;
    });
  }
  savePending(d: string, s: string, p: PendingPrompt) {
    return this.update(d, s, (v) => {
      v.pending = p;
    });
  }
  admit(d: string, s: string, id: string, text: string) {
    return this.update(d, s, (v) => {
      if (v.pending?.id !== id) throw new Error("Outbox identity changed");
      v.pending = { ...v.pending, state: "admitted" };
      if (v.draft.trim() === text) v.draft = "";
    });
  }
  saveCache(
    d: string,
    s: string,
    messages: Record<string, unknown>[],
    sequence: number,
  ) {
    return this.update(d, s, (v) => {
      v.messages = messages;
      v.sequence = sequence;
    });
  }
  clearDevice(d: string) {
    return this.db.transaction(() =>
      this.db.removePrefix(`conversation:${d}:`),
    );
  }
}
export interface Credentials {
  get(device: string): Promise<string | undefined>;
  set(device: string, token: string): Promise<void>;
  remove(device: string): Promise<void>;
}

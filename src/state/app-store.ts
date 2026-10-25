import { AuthenticatedAPI } from "../connection/authenticated-api";
import {
  API,
  AgentRequest,
  Change,
  ChatMessage,
  Configuration,
  DesktopDevice,
  Json,
  Page,
  PendingPrompt,
  ProjectFile,
  SessionSummary,
} from "../domain/types";
import {
  list,
  record,
  request as decodeRequest,
  session,
} from "../domain/decode";
import { ApiClient, ApiError } from "../connection/api-client";
import { parsePairingPayload } from "../connection/pairing-payload";
import {
  ConversationStore,
  Credentials,
  MemoryDatabase,
} from "../storage/conversation-store";
import { ConversationProjection } from "./conversation-projection";
import { discoverActivity } from "./activity-service";
import { previewAPI } from "../preview/workspace";
export interface Snapshot {
  ready: boolean;
  conversationReady: boolean;
  preview: boolean;
  devices: DesktopDevice[];
  device?: DesktopDevice;
  online: boolean;
  busy: boolean;
  sending: boolean;
  loadingSessions: boolean;
  sessions: SessionSummary[];
  selected?: SessionSummary;
  messages: ChatMessage[];
  requests: AgentRequest[];
  draft: string;
  pending?: PendingPrompt;
  search: string;
  project: string;
  sessionCursor?: string;
  messageCursor?: string;
  error?: string;
  notice?: string;
  confirmation?: string;
  agent: string;
  model: string;
  deciding: string[];
}
export interface Dependencies {
  persistence: ConversationStore;
  credentials: Credentials;
  apiFactory?: (origin: string, token: string) => API;
  id?: () => string;
  now?: () => number;
  deviceName?: string;
}
const empty: Snapshot = {
  ready: false,
  conversationReady: false,
  preview: false,
  devices: [],
  online: false,
  busy: false,
  sending: false,
  loadingSessions: false,
  sessions: [],
  messages: [],
  requests: [],
  draft: "",
  search: "",
  project: "All projects",
  agent: "Build",
  model: "Desktop model",
  deciding: [],
};
export class AppStore {
  private state: Snapshot = { ...empty };
  private listeners = new Set<() => void>();
  private api?: API;
  private clientRevision = 0;
  private conversationRevision = 0;
  private openingConversation?: string;
  private searchRevision = 0;
  private pairRevision = 0;
  private connection = new AbortController();
  private conversation = new AbortController();
  private streams = new AbortController();
  private pairing?: API;
  private poll?: ReturnType<typeof setTimeout>;
  private retry?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private pairTimer?: ReturnType<typeof setTimeout>;
  private refreshing = false;
  private refreshAgain = false;
  private disposed = false;
  private suspended = false;
  private replay = false;
  private sequence = 0;
  private seenSequence = 0;
  private projection = new ConversationProjection();
  private config = new Map<string, { agent?: string; model?: string }>();
  private persistence: ConversationStore;
  constructor(private deps: Dependencies) {
    this.persistence = deps.persistence;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private patch(value: Partial<Snapshot>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...value };
    for (const l of this.listeners) l();
  }
  private factory(origin: string, token: string): API {
    const inner =
      this.deps.apiFactory?.(origin, token) ?? new ApiClient(origin, token);
    if (!token) return inner;
    const rev = this.clientRevision;
    const wrapped = new AuthenticatedAPI(inner, (error) => {
      if (rev === this.clientRevision && this.api === wrapped) this.fail(error);
    });
    return wrapped;
  }
  private now() {
    return this.deps.now?.() ?? Date.now();
  }
  private id() {
    return (
      this.deps.id?.() ??
      `msg_${this.now()}_${Math.random().toString(36).slice(2)}`
    );
  }
  private fail(e: unknown) {
    this.patch({
      error:
        e instanceof Error
          ? e.message
          : "Could not reach your computer. Your draft is saved.",
      ...(e instanceof ApiError && e.status === 401 ? { online: false } : {}),
    });
  }
  clearError = () => this.patch({ error: undefined, notice: undefined });
  async restore() {
    try {
      const raw = await this.persistence.db.get("devices");
      const devices: DesktopDevice[] = raw ? JSON.parse(raw) : [];
      this.patch({ devices });
      // Restore local navigation before network health/history. An unavailable
      // computer must not hold the app behind its HTTP timeout at cold start.
      if (devices[0]) void this.connectDevice(devices[0]);
    } catch (e) {
      this.fail(e);
    } finally {
      this.patch({ ready: true });
    }
  }
  async enterPreview() {
    this.cancelPairing();
    this.api?.close();
    this.invalidate();
    this.persistence = new ConversationStore(new MemoryDatabase());
    const api = previewAPI();
    this.api = api;
    this.patch({
      ...empty,
      ready: true,
      preview: true,
      online: true,
      device: {
        id: "preview",
        name: "My workstation",
        platform: "Linux",
        origin: "",
        credentialID: "",
      },
    });
    await this.refreshSessions();
  }
  private invalidate() {
    this.clientRevision++;
    this.conversationRevision++;
    this.connection.abort();
    this.conversation.abort();
    this.streams.abort();
    this.connection = new AbortController();
    this.conversation = new AbortController();
    clearTimeout(this.poll);
    clearTimeout(this.retry);
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    clearTimeout(this.searchTimer);
    this.refreshing = false;
    this.refreshAgain = false;
  }
  async connectDevice(device: DesktopDevice) {
    this.cancelPairing();
    this.api?.close();
    this.invalidate();
    this.persistence = this.deps.persistence;
    const rev = this.clientRevision;
    this.patch({
      device,
      preview: false,
      ready: true,
      online: false,
      busy: true,
      sessions: [],
      selected: undefined,
      messages: [],
      requests: [],
      draft: "",
      pending: undefined,
      search: "",
      project: "All projects",
      error: undefined,
      sessionCursor: undefined,
      loadingSessions: false,
      sending: false,
    });
    try {
      const token = await this.deps.credentials.get(device.id);
      if (rev !== this.clientRevision) return;
      if (!token)
        throw new ApiError(
          401,
          "Saved pairing could not be opened. Pair your computer again.",
        );
      this.api = this.factory(device.origin, token);
      await this.recover(rev);
    } catch (e) {
      if (rev === this.clientRevision) {
        this.fail(e);
        if (!(e instanceof ApiError && [401, 409].includes(e.status)))
          this.scheduleHealth(rev);
      }
    } finally {
      if (rev === this.clientRevision) this.patch({ busy: false });
    }
  }
  private async health(rev: number) {
    const api = this.api;
    if (!api) return;
    const result = await api.request<Json>("GET", "/mobile/v1/health", {
      signal: this.connection.signal,
    });
    if (rev !== this.clientRevision) return;
    if (
      result.protocol !== 1 ||
      record(result.desktop).id !== this.state.device?.id
    ) {
      throw new ApiError(
        409,
        "Desktop identity or protocol did not match this pairing. Pair again.",
      );
    }
    this.replay = record(result.capabilities).replay === true;
    this.patch({ online: true, error: undefined, notice: undefined });
    await this.refreshSessions();
    this.schedulePoll(rev);
  }
  private scheduleHealth(rev: number) {
    clearTimeout(this.retry);
    if (this.suspended) return;
    this.retry = setTimeout(() => {
      if (rev !== this.clientRevision) return;
      void this.recover(rev).catch((e) => {
        if (rev === this.clientRevision) {
          this.fail(e);
          if (!(e instanceof ApiError && [401, 409].includes(e.status)))
            this.scheduleHealth(rev);
        }
      });
    }, 4000);
  }
  private schedulePoll(rev: number) {
    clearTimeout(this.poll);
    if (
      this.state.preview ||
      this.suspended ||
      rev !== this.clientRevision ||
      this.disposed
    )
      return;
    this.poll = setTimeout(() => {
      if (rev !== this.clientRevision) return;
      void this.activity().finally(() => this.schedulePoll(rev));
    }, 5000);
  }
  async refreshSessions(more = false) {
    const api = this.api,
      rev = this.clientRevision,
      search = this.state.search,
      requestID = ++this.searchRevision;
    if (!api) return;
    this.patch({ loadingSessions: true });
    try {
      const page = await api.request<Page<Json>>("GET", "/api/session", {
        query: {
          limit: "40",
          ...(more && this.state.sessionCursor
            ? { cursor: this.state.sessionCursor }
            : {}),
          ...(search ? { search } : {}),
        },
        signal: this.connection.signal,
      });
      if (
        rev !== this.clientRevision ||
        requestID !== this.searchRevision ||
        search !== this.state.search
      )
        return;
      const items = page.data.map(session);
      const ids = new Set(this.state.sessions.map((s) => s.id));
      this.patch({
        sessions: more
          ? [...this.state.sessions, ...items.filter((s) => !ids.has(s.id))]
          : items,
        sessionCursor: page.cursor?.next,
        online: true,
        error: undefined,
      });
      await this.activity();
    } catch (e) {
      if (rev === this.clientRevision && requestID === this.searchRevision) {
        this.patch({ online: false });
        this.fail(e);
      }
    } finally {
      if (rev === this.clientRevision && requestID === this.searchRevision)
        this.patch({ loadingSessions: false });
    }
  }
  setSearch(text: string) {
    this.patch({ search: text });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.refreshSessions(), 300);
  }
  setProject(project: string) {
    this.patch({ project });
  }
  async activity() {
    const api = this.api,
      rev = this.clientRevision;
    if (!api) return;
    try {
      const sessions = this.state.sessions;
      const result = await discoverActivity(
        api,
        sessions,
        this.connection.signal,
      );
      if (rev === this.clientRevision && sessions === this.state.sessions)
        this.patch({
          ...result,
          selected:
            result.sessions.find((s) => s.id === this.state.selected?.id) ??
            this.state.selected,
        });
    } catch (e) {
      if (rev !== this.clientRevision || this.suspended || this.disposed)
        return;
      if (e instanceof ApiError && e.status === 401) this.fail(e);
      else if (
        !(e instanceof ApiError) ||
        e.status >= 500 ||
        e.status === 408
      ) {
        this.patch({
          online: false,
          error: undefined,
          notice: "Desktop is offline or reconnecting. Your draft is saved.",
        });
        this.scheduleHealth(rev);
      }
    }
  }
  async newChat() {
    const api = this.api,
      rev = this.clientRevision;
    if (!api || !this.state.online) return;
    try {
      const directory = this.state.sessions.find(
        (s) => s.project === this.state.project,
      )?.directory;
      const result = await api.request<Json>("POST", "/api/session", {
        body: directory ? { location: { directory } } : {},
        signal: this.connection.signal,
      });
      if (rev !== this.clientRevision) return;
      const created = session(record(result.data));
      this.patch({ sessions: [created, ...this.state.sessions] });
      await this.openConversation(created.id);
    } catch (e) {
      if (rev === this.clientRevision) this.fail(e);
    }
  }
  async openConversation(id: string) {
    const api = this.api;
    this.backToChats();
    this.openingConversation = id;
    const rev = this.conversationRevision,
      device = this.state.device;
    if (!device) return;
    let saved;
    try {
      saved = await this.persistence.read(device.id, id);
    } catch (error) {
      if (rev === this.conversationRevision) this.fail(error);
      return;
    }
    if (rev !== this.conversationRevision) return;
    let selected =
      this.state.sessions.find((s) => s.id === id) ?? saved.session;
    // Legacy caches did not include a title/location. Their history and draft
    // are still useful offline; a later successful refresh supplies metadata.
    if (!selected && (saved.messages?.length || saved.draft || saved.pending))
      selected = {
        id,
        title: "Conversation",
        project: "",
        directory: "",
        updated: 0,
        status: "idle",
      };
    if (!selected) {
      if (!api) return;
      try {
        selected = session(
          record(
            (
              await api.request<Json>(
                "GET",
                `/api/session/${encodeURIComponent(id)}`,
                { signal: this.conversation.signal },
              )
            ).data,
          ),
        );
      } catch (e) {
        if (rev === this.conversationRevision) this.fail(e);
        return;
      }
    }
    if (rev !== this.conversationRevision) return;
    const names = this.config.get(`${device.id}:${id}`);
    this.projection = new ConversationProjection();
    this.sequence = 0;
    this.seenSequence = 0;
    this.patch({
      selected,
      messages: [],
      draft: "",
      pending: undefined,
      busy: true,
      sending: false,
      error: undefined,
      notice: undefined,
      agent: names?.agent ?? "Build",
      model: names?.model ?? "Desktop model",
      messageCursor: undefined,
    });
    try {
      if (rev !== this.conversationRevision) return;
      this.projection.hydrate(saved.messages ?? []);
      this.sequence = saved.sequence ?? 0;
      this.seenSequence = this.sequence;
      this.patch({
        draft: saved.draft,
        conversationReady: true,
        busy: false,
        pending: saved.pending?.state === "pending" ? saved.pending : undefined,
        messages: this.projection.messages(),
        error:
          saved.pending?.state === "pending"
            ? "A previous message has unconfirmed delivery. Restore its text and retry."
            : undefined,
      });
      this.subscribeEvents(rev);
      await this.refreshConversation(rev);
    } catch (e) {
      if (rev === this.conversationRevision) this.fail(e);
    } finally {
      if (rev === this.conversationRevision) this.patch({ busy: false });
    }
  }
  backToChats() {
    this.openingConversation = undefined;
    this.conversationRevision++;
    this.conversation.abort();
    this.streams.abort();
    this.conversation = new AbortController();
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    clearTimeout(this.retry);
    this.refreshing = false;
    this.refreshAgain = false;
    this.patch({
      selected: undefined,
      conversationReady: false,
      messages: [],
      draft: "",
      pending: undefined,
      sending: false,
      busy: false,
    });
  }
  closeConversation(id: string) {
    if (this.state.selected?.id === id || this.openingConversation === id)
      this.backToChats();
  }
  private context(rev: number) {
    return (
      rev === this.conversationRevision &&
      !this.disposed &&
      !!this.state.selected
    );
  }
  private async loadMessages(rev: number, older = false) {
    const api = this.api,
      selected = this.state.selected,
      device = this.state.device;
    if (!api || !selected || !device) return;
    const page = await api.request<Page<Json>>(
      "GET",
      `/api/session/${selected.id}/message`,
      {
        query: {
          limit: "50",
          ...(older && this.state.messageCursor
            ? { cursor: this.state.messageCursor }
            : { order: "desc" }),
        },
        signal: this.conversation.signal,
      },
    );
    if (!this.context(rev)) return;
    this.projection.page(page.data, page.cursor?.next, older);
    this.patch({
      messages: this.projection.messages(),
      messageCursor: this.projection.cursor,
      online: true,
    });
    if (!older)
      await this.persistence.saveCache(
        device.id,
        selected.id,
        [...page.data].reverse(),
        this.seenSequence,
        selected,
      );
  }
  async loadOlderMessages() {
    const rev = this.conversationRevision;
    if (!this.state.messageCursor) return;
    try {
      await this.loadMessages(rev, true);
    } catch (e) {
      if (this.context(rev)) this.fail(e);
    }
  }
  private async loadRequests(rev: number) {
    const api = this.api,
      selected = this.state.selected;
    if (!api || !selected) return;
    const values = await Promise.all(
      ["permission", "question"].map((kind) =>
        api.request<Json>("GET", `/api/session/${selected.id}/${kind}`, {
          signal: this.conversation.signal,
        }),
      ),
    );
    if (!this.context(rev)) return;
    const requests = values.flatMap((v, i) =>
      list(v.data).map((raw) =>
        decodeRequest(
          { ...raw, sessionID: selected.id },
          selected.directory,
          i === 1,
        ),
      ),
    );
    this.patch({
      requests: [
        ...this.state.requests.filter((r) => r.sessionID !== selected.id),
        ...requests,
      ],
    });
  }
  private async refreshConversation(rev: number) {
    await this.loadMessages(rev);
    if (!this.context(rev)) return;
    await this.loadRequests(rev);
    if (this.context(rev)) this.sequence = this.seenSequence;
  }
  private queueRefresh(rev: number) {
    if (!this.context(rev)) return;
    this.refreshAgain = true;
    if (this.refreshTimer || this.refreshing) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      if (!this.context(rev)) return;
      this.refreshing = true;
      this.refreshAgain = false;
      void this.refreshConversation(rev)
        .catch((e) => {
          if (this.context(rev)) this.fail(e);
        })
        .finally(() => {
          if (!this.context(rev)) return;
          this.refreshing = false;
          if (this.refreshAgain) this.queueRefresh(rev);
        });
    }, 180);
  }
  private subscribeEvents(rev: number) {
    const api = this.api,
      selected = this.state.selected;
    if (!api || !selected || this.state.preview || this.suspended) return;
    this.streams.abort();
    this.streams = new AbortController();
    const signal = this.streams.signal;
    const consume = async (live: boolean) => {
      try {
        for await (const event of live
          ? api.liveEvents(selected.id, signal)
          : api.events(selected.id, this.sequence, signal)) {
          if (!this.context(rev) || signal.aborted) return;
          if (live) {
            if (this.projection.apply(event, selected.id))
              this.patch({ messages: this.projection.messages() });
          } else {
            const seq = event.seq ?? event.durable?.seq;
            if (seq && seq > this.seenSequence) this.seenSequence = seq;
          }
          this.queueRefresh(rev);
        }
        if (!signal.aborted)
          this.lost(rev, new Error("Connection interrupted"));
      } catch (e) {
        if (!signal.aborted) this.lost(rev, e);
      }
    };
    if (this.replay) void consume(false);
    void consume(true);
  }
  private lost(rev: number, e: unknown) {
    if (!this.context(rev) || this.suspended) return;
    this.streams.abort();
    clearTimeout(this.retry);
    if (e instanceof ApiError && e.status === 401) {
      this.fail(e);
      return;
    }
    this.patch({
      notice: "Reconnecting conversation updates. Your draft is saved.",
    });
    this.retry = setTimeout(() => {
      if (!this.context(rev)) return;
      void this.refreshConversation(rev)
        .then(() => {
          if (this.context(rev)) {
            this.patch({ notice: undefined, error: undefined });
            this.subscribeEvents(rev);
          }
        })
        .catch((error) => {
          if (this.context(rev)) {
            this.patch({ online: false });
            this.fail(error);
            this.lost(rev, error);
          }
        });
    }, 4000);
  }
  setDraft(text: string) {
    if (!this.state.conversationReady || !this.state.selected) return;
    const { device, selected } = this.state;
    const revision = this.conversationRevision;
    this.patch({ draft: text });
    if (device && selected)
      void this.persistence
        .saveDraft(device.id, selected.id, text)
        .catch(() => {
          if (revision === this.conversationRevision)
            this.patch({
              error:
                "Your draft could not be saved. Keep the app open and retry.",
            });
        });
  }
  restoreUnconfirmedDraft() {
    if (this.state.pending) this.setDraft(this.state.pending.text);
  }
  async send() {
    const { device, selected, draft, online, sending, busy } = this.state;
    const api = this.api;
    if (
      !device ||
      !selected ||
      !api ||
      !online ||
      sending ||
      busy ||
      !this.state.conversationReady ||
      !draft.trim()
    )
      return;
    const rev = this.conversationRevision,
      text = draft.trim(),
      pending = this.state.pending ?? {
        id: this.id(),
        text,
        state: "pending" as const,
      };
    if (pending.text !== text) {
      this.patch({
        error:
          "Restore the previous unconfirmed message and retry before sending another.",
      });
      return;
    }
    this.patch({ sending: true, pending, error: undefined });
    let admitted = false;
    try {
      await this.persistence.savePending(device.id, selected.id, pending);
      if (!this.context(rev)) return;
      await api.request("POST", `/api/session/${selected.id}/prompt`, {
        body: { id: pending.id, prompt: { text } },
        signal: this.conversation.signal,
      });
      await this.persistence.admit(device.id, selected.id, pending.id, text);
      admitted = true;
      if (!this.context(rev)) return;
      this.patch({
        pending: undefined,
        draft: this.state.draft.trim() === text ? "" : this.state.draft,
        notice: "Message sent",
      });
      await this.loadMessages(rev);
    } catch (e) {
      if (this.context(rev)) {
        if (e instanceof ApiError && e.status === 401) this.fail(e);
        else
          this.patch({
            error: admitted
              ? "Message sent. Conversation updates are temporarily unavailable."
              : "Delivery is unconfirmed. Retry this message to check admission with the same message ID.",
          });
        if (admitted) this.lost(rev, e);
      }
    } finally {
      if (this.context(rev)) this.patch({ sending: false });
    }
  }
  async stop() {
    const rev = this.conversationRevision,
      selected = this.state.selected;
    if (!selected || !this.api) return;
    try {
      await this.api.request("POST", `/api/session/${selected.id}/interrupt`, {
        signal: this.conversation.signal,
      });
      if (this.context(rev)) {
        this.patch({ notice: "Stop requested" });
        await this.activity();
      }
    } catch (e) {
      if (this.context(rev)) this.fail(e);
    }
  }
  async configuration(kind: "agent" | "model") {
    const api = this.api;
    if (!api) return [];
    const rev = this.conversationRevision;
    const directory = this.state.selected?.directory;
    const result = await api.request<{ data: Configuration[] }>(
      "GET",
      `/api/${kind}`,
      {
        query: directory ? { "location[directory]": directory } : undefined,
        signal: this.conversation.signal,
      },
    );
    return this.context(rev)
      ? result.data.filter((i) => i.enabled !== false)
      : [];
  }
  async switchConfiguration(kind: "agent" | "model", item: Configuration) {
    const rev = this.conversationRevision,
      { selected, device } = this.state;
    if (!selected || !device || !this.api) return;
    await this.api.request("POST", `/api/session/${selected.id}/${kind}`, {
      body:
        kind === "agent"
          ? { agent: item.id }
          : { model: { id: item.id, providerID: item.providerID } },
      signal: this.conversation.signal,
    });
    const key = `${device.id}:${selected.id}`;
    this.config.set(key, {
      ...this.config.get(key),
      [kind]: item.name ?? item.id,
    });
    if (this.context(rev)) this.patch({ [kind]: item.name ?? item.id });
  }
  async decide(request: AgentRequest, value: boolean | string[][]) {
    const api = this.api,
      rev = this.clientRevision;
    if (!api || !this.state.online || this.state.deciding.includes(request.id))
      return false;
    this.patch({ deciding: [...this.state.deciding, request.id] });
    try {
      await api.request(
        "POST",
        `/api/session/${request.sessionID}/${request.question ? "question" : "permission"}/${request.id}/reply`,
        {
          body: request.question
            ? { answers: value }
            : { reply: value ? "once" : "reject" },
          signal: this.connection.signal,
        },
      );
      if (rev !== this.clientRevision) return false;
      this.patch({
        requests: this.state.requests.filter((r) => r.id !== request.id),
        notice: request.question
          ? "Answer sent"
          : value
            ? "Allowed once"
            : "Denied",
      });
      return true;
    } catch (e) {
      if (rev === this.clientRevision) {
        if (e instanceof ApiError && e.status === 404) {
          await this.activity();
          this.patch({ notice: "Resolved on Desktop" });
          return true;
        }
        this.fail(e);
      }
      return false;
    } finally {
      if (rev === this.clientRevision)
        this.patch({
          deciding: this.state.deciding.filter((id) => id !== request.id),
        });
    }
  }
  async loadFile(path: string): Promise<ProjectFile> {
    const rev = this.conversationRevision,
      selected = this.state.selected;
    if (!selected || !this.api) throw new Error("Select a conversation");
    const r = await this.api.request<{ data: ProjectFile }>(
      "GET",
      `/mobile/v1/session/${selected.id}/files`,
      { query: { path }, signal: this.conversation.signal },
    );
    if (!this.context(rev)) throw new Error("Conversation changed");
    return r.data;
  }
  async loadChanges(): Promise<Change[]> {
    const rev = this.conversationRevision,
      selected = this.state.selected;
    if (!selected || !this.api) throw new Error("Select a conversation");
    const r = await this.api.request<{ data: Change[] }>(
      "GET",
      `/mobile/v1/session/${selected.id}/changes`,
      { signal: this.conversation.signal },
    );
    if (!this.context(rev)) throw new Error("Conversation changed");
    return r.data;
  }
  async pair(text: string) {
    this.cancelPairing();
    const rev = this.pairRevision;
    this.patch({ busy: true, error: undefined });
    try {
      const payload = parsePairingPayload(text, this.now());
      const api = this.factory(payload.origin, "");
      this.pairing = api;
      const claim = await api.request<Json>("POST", "/mobile/v1/claim", {
        body: {
          ...(payload.code
            ? { code: payload.code }
            : { desktopID: payload.desktopID }),
          deviceName: this.deps.deviceName ?? "Phone",
        },
      });
      if (rev !== this.pairRevision) return;
      this.patch({ confirmation: String(claim.confirmation), busy: false });
      const poll = async () => {
        if (rev !== this.pairRevision) return;
        try {
          if (Number(claim.expiresAt ?? payload.expiresAt) <= this.now())
            throw new Error("Pairing code expired. Refresh it on Desktop.");
          const result = await api.request<Json>(
            "POST",
            "/mobile/v1/claim/status",
            {
              body: { claimID: claim.claimID, claimSecret: claim.claimSecret },
            },
          );
          if (rev !== this.pairRevision) return;
          if (result.state === "declined")
            throw new Error("Connection declined on your computer.");
          if (result.state === "approved") {
            const raw = record(result.desktop);
            if (raw.id !== payload.desktopID)
              throw new Error(
                "Computer identity did not match the scanned code.",
              );
            const device: DesktopDevice = {
              id: String(raw.id),
              name: String(raw.name),
              platform: String(raw.platform ?? "Computer"),
              origin: payload.origin,
              credentialID: String(record(result.device).id),
            };
            await this.deps.credentials.set(device.id, String(result.token));
            if (rev !== this.pairRevision) return;
            const devices = [
              ...this.state.devices.filter((d) => d.id !== device.id),
              device,
            ];
            await this.deps.persistence.db.transaction(() =>
              this.deps.persistence.db.set("devices", JSON.stringify(devices)),
            );
            if (rev !== this.pairRevision) return;
            this.patch({ devices, confirmation: undefined });
            await this.connectDevice(device);
            return;
          }
          this.pairTimer = setTimeout(() => void poll(), 2000);
        } catch (e) {
          if (rev === this.pairRevision) {
            this.patch({ confirmation: undefined });
            this.fail(e);
          }
        }
      };
      void poll();
    } catch (e) {
      if (rev === this.pairRevision) this.fail(e);
    } finally {
      if (rev === this.pairRevision) this.patch({ busy: false });
    }
  }
  cancelPairing() {
    this.pairRevision++;
    clearTimeout(this.pairTimer);
    this.pairing?.close();
    this.pairing = undefined;
    this.patch({ confirmation: undefined, busy: false });
  }
  async removeDevice(device: DesktopDevice) {
    let warning: string | undefined;
    if (!this.state.preview) {
      const token = await this.deps.credentials.get(device.id);
      const api = token ? this.factory(device.origin, token) : undefined;
      try {
        if (api) await api.request("DELETE", "/mobile/v1/device");
        else warning = "Removed locally. Revoke access in Desktop too.";
      } catch {
        warning =
          "Removed from this phone. If offline, revoke its access in Desktop too.";
      } finally {
        api?.close();
      }
      await this.deps.credentials.remove(device.id);
      await this.deps.persistence.clearDevice(device.id);
      const devices = this.state.devices.filter((d) => d.id !== device.id);
      await this.deps.persistence.db.transaction(() =>
        this.deps.persistence.db.set("devices", JSON.stringify(devices)),
      );
      this.patch({ devices });
    }
    if (this.state.device?.id === device.id) {
      this.api?.close();
      this.api = undefined;
      this.invalidate();
      this.patch({
        device: undefined,
        selected: undefined,
        messages: [],
        requests: [],
        sessions: [],
        draft: "",
        pending: undefined,
        online: false,
        preview: false,
      });
    }
    this.patch({ error: warning });
  }
  suspend() {
    this.suspended = true;
    this.conversationRevision++;
    this.conversation.abort();
    this.streams.abort();
    clearTimeout(this.poll);
    clearTimeout(this.retry);
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.refreshTimer = undefined;
    this.refreshing = false;
    if (!this.state.preview) this.patch({ online: false });
  }
  private async recover(rev: number) {
    const selected = this.state.selected?.id,
      conversationRev = this.conversationRevision;
    await this.health(rev);
    if (
      rev === this.clientRevision &&
      conversationRev === this.conversationRevision &&
      selected &&
      this.state.selected?.id === selected
    )
      await this.openConversation(selected);
  }
  async resume() {
    this.suspended = false;
    if (this.state.preview || !this.state.device) return;
    const rev = this.clientRevision;
    try {
      await this.recover(rev);
    } catch (e) {
      if (rev !== this.clientRevision) return;
      this.fail(e);
      if (!(e instanceof ApiError && [401, 409].includes(e.status)))
        this.scheduleHealth(rev);
    }
  }
  dispose() {
    this.disposed = true;
    this.cancelPairing();
    this.invalidate();
    this.api?.close();
    this.listeners.clear();
  }
}

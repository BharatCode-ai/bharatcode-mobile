export type Json = Record<string, unknown>;
export interface DesktopDevice {
  id: string;
  name: string;
  platform: string;
  origin: string;
  credentialID: string;
}
export interface SessionSummary {
  id: string;
  title: string;
  project: string;
  directory: string;
  updated: number;
  status: "idle" | "running" | "attention";
}
export interface ToolActivity {
  id: string;
  name: string;
  status: string;
  input: string;
  output: string;
}
export interface ChatMessage {
  id: string;
  role: string;
  text: string;
  tools: ToolActivity[];
}
export interface Question {
  question: string;
  options: { label: string; description?: string }[];
  multiple?: boolean;
  custom?: boolean;
}
export interface AgentRequest {
  id: string;
  sessionID: string;
  title: string;
  command: string;
  directory: string;
  question: boolean;
  questions: Question[];
}
export interface PendingPrompt {
  id: string;
  text: string;
  state: "pending" | "admitted";
}
export interface ConversationRecord {
  draft: string;
  pending?: PendingPrompt;
  messages?: Json[];
  sequence?: number;
}
export interface WireEvent {
  id?: string;
  type?: string;
  seq?: number;
  durable?: { seq?: number };
  data?: Json;
}
export interface Page<T> {
  data: T[];
  cursor?: { next?: string };
}
export interface Configuration {
  id: string;
  name?: string;
  providerID?: string;
  enabled?: boolean;
}
export interface ProjectFile {
  type: "file" | "directory";
  path: string;
  text?: string;
  binary?: boolean;
  tooLarge?: boolean;
  truncated?: boolean;
  entries?: { name: string; directory: boolean; symlink: boolean }[];
}
export interface Change {
  file: string;
  patch?: string;
  additions?: number;
  deletions?: number;
}
export interface API {
  request<T = Json>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, string>;
      signal?: AbortSignal;
    },
  ): Promise<T>;
  events(
    session: string,
    after: number,
    signal: AbortSignal,
  ): AsyncIterable<WireEvent>;
  liveEvents(session: string, signal: AbortSignal): AsyncIterable<WireEvent>;
  close(): void;
}

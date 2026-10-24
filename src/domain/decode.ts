import { AgentRequest, ChatMessage, Json, SessionSummary } from "./types";
export function record(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}
export function list(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(record) : [];
}
export function session(raw: Json): SessionSummary {
  const directory = String(record(raw.location).directory ?? "");
  const time = record(raw.time).updated;
  return {
    id: String(raw.id),
    title: String(raw.title ?? "New chat"),
    directory,
    project:
      directory.split("/").filter(Boolean).pop() ??
      String(raw.projectID ?? "Project"),
    updated:
      typeof time === "number" ? time : Date.parse(String(time)) || Date.now(),
    status: "idle",
  };
}
const text = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v ?? "", null, 2);
export function message(raw: Json): ChatMessage {
  const content = list(raw.content);
  return {
    id: String(raw.id),
    role: String(raw.type ?? "assistant"),
    text:
      typeof raw.text === "string"
        ? raw.text
        : content
            .filter((p) => p.type === "text")
            .map((p) => String(p.text ?? ""))
            .join("\n\n"),
    tools: content
      .filter((p) => p.type === "tool")
      .map((p, i) => {
        const s = record(p.state);
        return {
          id: String(p.id ?? i),
          name: String(p.name ?? "Tool"),
          status: String(s.status ?? "pending"),
          input: text(s.input),
          output: text(s.content),
        };
      }),
  };
}
export function request(
  raw: Json,
  directory = "",
  question = false,
): AgentRequest {
  return {
    id: String(raw.id),
    sessionID: String(raw.sessionID ?? ""),
    title: question
      ? "BharatCode has a question"
      : `Allow ${raw.action ?? "this action"}?`,
    command: Array.isArray(raw.resources) ? raw.resources.join("\n") : "",
    directory,
    question,
    questions: list(raw.questions).map((q) => ({
      question: String(q.question ?? ""),
      options: list(q.options).map((o) => ({
        label: String(o.label),
        description: String(o.description ?? ""),
      })),
      multiple: q.multiple === true,
      custom: q.custom !== false,
    })),
  };
}

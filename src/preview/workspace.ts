import { API, Json } from "../domain/types";
const sessions = [
  {
    id: "ses_checkout",
    title: "Fix checkout validation",
    location: { directory: "/projects/storefront" },
    time: { updated: Date.now() },
  },
  {
    id: "ses_auth",
    title: "Review authentication middleware",
    location: { directory: "/projects/api" },
    time: { updated: Date.now() - 3600000 },
  },
  {
    id: "ses_theme",
    title: "Add dark mode",
    location: { directory: "/projects/mobile-app" },
    time: { updated: Date.now() - 7200000 },
  },
];
const assistant =
  'I found the issue. Empty apartment fields were being treated as invalid.\n\nThe validation was checking for a non-empty string instead of allowing an optional apartment field. I’ve updated the logic to only validate when a value is provided.\n\n```typescript\n// address.ts\nconst apartment = address.apartment?.trim();\nif (apartment && apartment.length > 100) {\n  return invalid("Apartment is too long");\n}\n```';
export function previewAPI(): API {
  const messages: Record<string, Json[]> = {};
  let permission = true,
    question = true,
    running = true;
  return {
    async request<T>(
      method: string,
      path: string,
      options?: { body?: unknown },
    ) {
      const body = options?.body as Json | undefined;
      let result: unknown = { data: [] };
      const sid = /\/session\/([^/]+)/.exec(path)?.[1] ?? "ses_checkout";
      if (path.endsWith("/health"))
        result = { capabilities: { replay: false } };
      else if (path === "/api/session" && method === "POST") {
        const item = {
          ...sessions[0]!,
          id: `ses_sample_${Date.now()}`,
          title: "New chat",
        };
        sessions.unshift(item);
        messages[item.id] = [];
        result = { data: item };
      } else if (path === "/api/session") result = { data: sessions };
      else if (path.endsWith("/active"))
        result = { data: running ? { ses_checkout: {} } : {} };
      else if (path.endsWith("/interrupt")) {
        running = false;
        result = {};
      } else if (path.endsWith("/prompt")) {
        messages[sid] ??= [];
        messages[sid].push(
          { id: body?.id, type: "user", text: (body?.prompt as Json)?.text },
          {
            id: `reply_${Date.now()}`,
            type: "assistant",
            text: "This is a sample workspace. Pair your computer to run this task in your real project.",
          },
        );
        result = {};
      } else if (path.endsWith("/message")) {
        messages[sid] ??= [
          {
            id: "msg_sample_user",
            type: "user",
            text: "Fix the address validation and add a regression test.",
          },
          {
            id: "msg_sample_assistant",
            type: "assistant",
            content: [
              { type: "text", text: assistant },
              {
                id: "tool_sample",
                type: "tool",
                name: "Read 3 files",
                state: {
                  status: "completed",
                  input: "address.ts, checkout.ts, address.test.ts",
                  content: "Located address validation and its tests.",
                },
              },
            ],
          },
        ];
        result = { data: [...messages[sid]].reverse() };
      } else if (path === "/api/model")
        result = {
          data: [
            {
              id: "sample",
              name: "Desktop model",
              providerID: "preview",
              enabled: true,
            },
          ],
        };
      else if (path === "/api/agent")
        result = {
          data: [
            { id: "build", name: "Build" },
            { id: "plan", name: "Plan" },
          ],
        };
      else if (path.endsWith("/reply")) {
        if (path.includes("/permission/")) permission = false;
        else question = false;
        result = {};
      } else if (
        path.endsWith("/permission") ||
        path === "/api/permission/request"
      )
        result = {
          data:
            permission &&
            (path === "/api/permission/request" || sid === "ses_auth")
              ? [
                  {
                    id: "per_sample",
                    sessionID: "ses_auth",
                    action: "run the regression tests",
                    resources: ["npm test -- auth.test.ts"],
                  },
                ]
              : [],
        };
      else if (path.endsWith("/question") || path === "/api/question/request")
        result = {
          data:
            question && (path === "/api/question/request" || sid === "ses_auth")
              ? [
                  {
                    id: "que_sample",
                    sessionID: "ses_auth",
                    questions: [
                      {
                        question: "Which validation should I prioritize?",
                        options: [
                          {
                            label: "Address validation",
                            description: "Cover optional apartment fields",
                          },
                          {
                            label: "Authentication",
                            description: "Review the sign-in flow",
                          },
                        ],
                        custom: true,
                      },
                    ],
                  },
                ]
              : [],
        };
      else if (path.endsWith("/changes"))
        result = {
          data: [
            {
              file: "address.ts",
              patch:
                '@@ -1,3 +1,3 @@\n const apartment = address.apartment?.trim();\n-if (!apartment) return invalid("Required");\n+if (apartment && apartment.length > 100) return invalid("Too long");',
            },
          ],
        };
      else if (path.endsWith("/files")) {
        const file =
          (options as { query?: { path?: string } })?.query?.path ?? "";
        result = {
          data: file
            ? {
                type: "file",
                path: file,
                text: "// Project files stay on your computer.\nexport const apartmentIsOptional = true;",
              }
            : {
                type: "directory",
                path: "",
                entries: [
                  { name: "src", directory: true },
                  { name: "README.md", directory: false },
                ],
              },
        };
      }
      return result as T;
    },
    async *events() {},
    async *liveEvents(_s, _signal) {
      await new Promise<void>((resolve) => {
        _signal.addEventListener("abort", () => resolve(), { once: true });
      });
    },
    close() {},
  };
}

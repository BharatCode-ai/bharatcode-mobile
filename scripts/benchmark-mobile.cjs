// Source CPU benchmark, not a native frame-rate or network measurement.
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const ts = require("typescript");
require.extensions[".ts"] = (mod, filename) => {
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    }).outputText,
    filename,
  );
};
const {
  ConversationProjection,
} = require("../src/state/conversation-projection.ts");
const results = [];
for (const count of [50, 500, 2000]) {
  const times = [];
  let stable = 0;
  for (let run = 0; run < 7; run++) {
    const p = new ConversationProjection();
    p.page(
      Array.from({ length: count }, (_, i) => ({
        id: `m${count - i - 1}`,
        type: "assistant",
        content: [
          { id: "text", type: "text", text: "A completed reply. ".repeat(100) },
          {
            id: "tool",
            type: "tool",
            name: "Read",
            state: {
              status: "completed",
              input: { path: "fixture.ts" },
              content: { result: "fixture output ".repeat(100) },
            },
          },
        ],
      })),
      undefined,
    );
    let previous = p.messages();
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      p.apply(
        {
          type: "session.next.text.delta",
          data: {
            sessionID: "s",
            assistantMessageID: `m${count - 1}`,
            textID: "text",
            delta: " streamed",
          },
        },
        "s",
      );
      const next = p.messages();
      if (previous[0] === next[0]) stable++;
      previous = next;
    }
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  results.push({
    messages: count,
    deltas: 200,
    runs: 7,
    medianMs: +times[3].toFixed(2),
    minMs: +times[0].toFixed(2),
    maxMs: +times[6].toFixed(2),
    unchangedHeadIdentityReused: stable === 1400,
  });
}
console.log(
  JSON.stringify(
    { node: process.version, benchmark: "projection CPU (synthetic)", results },
    null,
    2,
  ),
);

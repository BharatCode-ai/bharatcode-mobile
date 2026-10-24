// Actual storage code over MemoryDatabase; excludes native SQLite/flash latency.
const fs = require("node:fs");
const path = require("node:path");
const { Buffer } = require("node:buffer");
const { execFileSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const ts = require("typescript");
const baseline = process.argv.includes("--baseline");
// Pin the pre-fix implementation so committing this script cannot move it.
const baselineRef = "b3a481f8adda120ec0be747fb43893d1df6b7055";
const root = path.dirname(require.resolve("../package.json"));
require.extensions[".ts"] = (mod, filename) => {
  const source =
    baseline &&
    filename === path.join(root, "src/storage/conversation-store.ts")
      ? execFileSync(
          "git",
          ["show", `${baselineRef}:src/storage/conversation-store.ts`],
          { cwd: root, encoding: "utf8" },
        )
      : fs.readFileSync(filename, "utf8");
  mod._compile(
    ts.transpileModule(source, {
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
  ConversationStore,
  MemoryDatabase,
} = require("../src/storage/conversation-store.ts");
async function main() {
  const samples = [];
  for (let run = 0; run < 5; run++) {
    const db = new MemoryDatabase();
    const store = new ConversationStore(db);
    await store.saveCache(
      "pc",
      "ses",
      [{ id: "reply", text: "x".repeat(1_000_000) }],
      42,
    );
    let writtenBytes = 0;
    const set = db.set.bind(db);
    db.set = async (key, value) => {
      writtenBytes += Buffer.byteLength(value);
      return set(key, value);
    };
    const start = performance.now();
    for (let i = 1; i <= 100; i++)
      await store.saveDraft("pc", "ses", "a".repeat(i));
    samples.push({ ms: performance.now() - start, writtenBytes });
    const restored = await new ConversationStore(db).read("pc", "ses");
    if (
      restored.draft.length !== 100 ||
      restored.messages[0].text.length !== 1_000_000 ||
      restored.sequence !== 42
    )
      throw new Error("Persisted draft/history mismatch");
  }
  samples.sort((a, b) => a.ms - b.ms);
  console.log(
    JSON.stringify(
      {
        node: process.version,
        source: baseline ? baselineRef : "working tree",
        benchmark: "100 durable draft edits with 1 MB history (MemoryDatabase)",
        runs: 5,
        medianMs: +samples[2].ms.toFixed(2),
        writtenBytes: samples[2].writtenBytes,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { WireEvent } from "../domain/types";
export async function* decodeSse(
  chunks: AsyncIterable<Uint8Array>,
): AsyncIterable<WireEvent> {
  const decoder = new TextDecoder();
  let buffer = "",
    size = 0;
  let data: string[] = [];
  for await (const chunk of chunks) {
    buffer += decoder.decode(chunk, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, "");
      buffer = buffer.slice(end + 1);
      size += line.length;
      if (size > 1_048_576) throw new Error("Event exceeds supported size");
      if (!line) {
        if (data.length) {
          const value: unknown = JSON.parse(data.join("\n"));
          if (value && typeof value === "object" && !Array.isArray(value))
            yield value as WireEvent;
        }
        data = [];
        size = 0;
      } else if (line.startsWith("data:"))
        data.push(line.slice(5).replace(/^ /, ""));
    }
    if (size + buffer.length > 1_048_576)
      throw new Error("Event exceeds supported size");
  }
}

/**
 * Reads an SSE stream and invokes `onEvent` with the raw payload of each
 * `data: ` line (skipping blanks and the terminal `data: [DONE]`). Shared by
 * both SSE producers/consumers in this codebase so the buffer/line-split
 * parsing loop exists in exactly one place.
 */
export async function parseSseLines(upstream: ReadableStream, onEvent: (raw: string) => void): Promise<void> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;
        onEvent(trimmed.slice(6));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Extracts plain text deltas from an OpenAI-shaped SSE stream and re-emits them
 * as raw bytes. This preserves the legacy `/chat` contract byte-for-byte: it has
 * never framed real SSE despite the `text/event-stream` header, and at least one
 * external consumer (smashly-app) depends on that exact shape.
 */
export function openAiSseToPlainText(upstream: ReadableStream): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        await parseSseLines(upstream, (raw) => {
          try {
            const json = JSON.parse(raw);
            const content = json?.choices?.[0]?.delta?.content ?? "";
            if (content) controller.enqueue(encoder.encode(content));
          } catch {
            // Malformed line from upstream — skip it, matching the original behaviour.
          }
        });
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

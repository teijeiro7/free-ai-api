/**
 * Extracts plain text deltas from an OpenAI-shaped SSE stream and re-emits them
 * as raw bytes. This preserves the legacy `/chat` contract byte-for-byte: it has
 * never framed real SSE despite the `text/event-stream` header, and at least one
 * external consumer (smashly-app) depends on that exact shape.
 */
export function openAiSseToPlainText(upstream: ReadableStream): ReadableStream {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
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

            try {
              const json = JSON.parse(trimmed.slice(6));
              const content = json?.choices?.[0]?.delta?.content ?? "";
              if (content) controller.enqueue(encoder.encode(content));
            } catch {
              // Malformed line from upstream — skip it, matching the original behaviour.
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

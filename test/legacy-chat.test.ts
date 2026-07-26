import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GATEWAY_KEY = "test-gateway-key";

describe("legacy /chat endpoint", () => {
  beforeEach(async () => {
    env.GATEWAY_API_KEY = GATEWAY_KEY;
    env.GROQ_API_KEY = "groq-key";
    await env.CATALOG.put(
      "catalog:v1",
      JSON.stringify({ updatedAt: Date.now(), models: { groq: ["llama-3.1-8b-instant"] } })
    );
  });

  afterEach(() => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    delete mutableEnv.GATEWAY_API_KEY;
    delete mutableEnv.GROQ_API_KEY;
    vi.unstubAllGlobals();
  });

  it("streams plain text deltas under text/event-stream, matching the pre-rewrite contract", async () => {
    const sse =
      ['data: {"choices":[{"delta":{"content":"Ho"}}]}', 'data: {"choices":[{"delta":{"content":"la"}}]}'].join(
        "\n\n"
      ) + "\n\ndata: [DONE]\n\n";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } }))
    );

    const res = await exports.default.fetch(
      new Request("http://example.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GATEWAY_KEY}` },
        body: JSON.stringify({ model: "fast", messages: [{ role: "user", content: "hi" }] }),
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(await res.text()).toBe("Hola");
  });

  it("still requires auth, unlike the pre-rewrite open proxy", async () => {
    const res = await exports.default.fetch(
      new Request("http://example.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      })
    );
    expect(res.status).toBe(401);
  });
});

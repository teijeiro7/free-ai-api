import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readJson } from "./helpers";

const GATEWAY_KEY = "test-gateway-key";

async function seedCatalog(models: Record<string, string[]>) {
  await env.CATALOG.put("catalog:v1", JSON.stringify({ updatedAt: Date.now(), models }));
}

function authedRequest(body: unknown) {
  return new Request("http://example.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GATEWAY_KEY}` },
    body: JSON.stringify(body),
  });
}

function mockOpenAiCompletion(content: string, usage?: Record<string, number>) {
  return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content } }], usage }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("chat completions routing", () => {
  beforeEach(async () => {
    env.GATEWAY_API_KEY = GATEWAY_KEY;
    env.GROQ_API_KEY = "groq-key";
    env.CEREBRAS_API_KEY = "cerebras-key";

    // Bindings are shared across tests within this file (only test files get
    // isolated), so a cooldown written by one test (e.g. via a deliberate 500)
    // would otherwise leak into the next one.
    const { keys } = await env.CATALOG.list({ prefix: "cooldown:" });
    await Promise.all(keys.map((key) => env.CATALOG.delete(key.name)));
  });

  afterEach(() => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    delete mutableEnv.GATEWAY_API_KEY;
    delete mutableEnv.GROQ_API_KEY;
    delete mutableEnv.CEREBRAS_API_KEY;
    delete mutableEnv.OPENROUTER_API_KEY;
    vi.unstubAllGlobals();
  });

  it("uses the first live candidate for an alias, in preference order", async () => {
    await seedCatalog({ cerebras: ["llama3.1-8b"], groq: ["llama-3.1-8b-instant"] });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => mockOpenAiCompletion("hola"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await exports.default.fetch(
      authedRequest({ model: "fast", messages: [{ role: "user", content: "hi" }] })
    );

    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.cerebras.ai");
  });

  it("skips a preferred model that isn't in the live catalog", async () => {
    await seedCatalog({ groq: ["llama-3.1-8b-instant"] });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => mockOpenAiCompletion("hola"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await exports.default.fetch(
      authedRequest({ model: "fast", messages: [{ role: "user", content: "hi" }] })
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.groq.com");
  });

  it("puts a provider in cooldown after a 429 and skips it on the next request", async () => {
    await seedCatalog({ cerebras: ["llama3.1-8b"], groq: ["llama-3.1-8b-instant"] });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.cerebras.ai")) {
        return new Response(JSON.stringify({ error: "rate limited" }), {
          status: 429,
          headers: { "Retry-After": "120" },
        });
      }
      return mockOpenAiCompletion("hola");
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await exports.default.fetch(
      authedRequest({ model: "fast", messages: [{ role: "user", content: "hi" }] })
    );
    expect(first.status).toBe(200);

    fetchMock.mockClear();
    const second = await exports.default.fetch(
      authedRequest({ model: "fast", messages: [{ role: "user", content: "hi" }] })
    );
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.groq.com");
  });

  it("returns a structured 503 without leaking upstream error text when every candidate fails", async () => {
    await seedCatalog({ groq: ["llama-3.1-8b-instant"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Internal Server Error, trace id abc123</html>", { status: 500 }))
    );

    const res = await exports.default.fetch(
      authedRequest({ model: "fast", messages: [{ role: "user", content: "hi" }] })
    );

    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.error.message).not.toContain("abc123");
    expect(body.error.message).not.toContain("<html>");
  });

  it("forwards response_format to the upstream provider", async () => {
    await seedCatalog({ groq: ["llama-3.1-8b-instant"] });
    const captured: { body: Record<string, unknown> | null } = { body: null };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        captured.body = JSON.parse(String(init?.body));
        return mockOpenAiCompletion('{"ok":true}');
      })
    );

    await exports.default.fetch(
      authedRequest({
        model: "fast",
        messages: [{ role: "user", content: "hi" }],
        response_format: { type: "json_object" },
      })
    );

    expect(captured.body?.response_format).toEqual({ type: "json_object" });
  });

  it("returns a full OpenAI-shaped response", async () => {
    await seedCatalog({ groq: ["llama-3.1-8b-instant"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockOpenAiCompletion("hola", { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }))
    );

    const res = await exports.default.fetch(
      authedRequest({ model: "fast", messages: [{ role: "user", content: "hi" }] })
    );
    const body = await readJson(res);

    expect(body.id).toMatch(/^chatcmpl-/);
    expect(body.object).toBe("chat.completion");
    expect(typeof body.created).toBe("number");
    expect(body.model).toBe("llama-3.1-8b-instant");
    expect(body.choices[0].message).toEqual({ role: "assistant", content: "hola" });
    expect(body.choices[0].finish_reason).toBe("stop");
    expect(body.usage).toEqual({ prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 });
  });

  it("treats an unknown, non-alias model as auto instead of hard-failing", async () => {
    await seedCatalog({ groq: ["llama-3.1-8b-instant"] });
    vi.stubGlobal("fetch", vi.fn(async () => mockOpenAiCompletion("hola")));

    const res = await exports.default.fetch(
      authedRequest({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(200);
  });

  it("falls back to any live catalog model when nothing matches known preferences", async () => {
    env.OPENROUTER_API_KEY = "openrouter-key";
    await seedCatalog({ openrouter: ["some/new-model:free"] });
    vi.stubGlobal("fetch", vi.fn(async () => mockOpenAiCompletion("hola")));

    const res = await exports.default.fetch(
      authedRequest({ model: "totally-unknown", messages: [{ role: "user", content: "hi" }] })
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.model).toBe("some/new-model:free");
  });

  it("returns 503 when no provider is configured or has a live model at all", async () => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    delete mutableEnv.GROQ_API_KEY;
    delete mutableEnv.CEREBRAS_API_KEY;
    await seedCatalog({});

    const res = await exports.default.fetch(
      authedRequest({ model: "fast", messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(503);
  });
});

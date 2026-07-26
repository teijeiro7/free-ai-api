import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJson } from "./helpers";

describe("GET /v1/models", () => {
  beforeEach(async () => {
    env.GATEWAY_API_KEY = "test-gateway-key";
    await env.CATALOG.put(
      "catalog:v1",
      JSON.stringify({
        updatedAt: Date.now(),
        models: { groq: ["llama-3.1-8b-instant"], cerebras: ["llama3.1-8b"] },
      })
    );
  });

  afterEach(() => {
    delete (env as unknown as Record<string, unknown>).GATEWAY_API_KEY;
  });

  it("lists the discovered catalog in an OpenAI-shaped list", async () => {
    const res = await exports.default.fetch(
      new Request("http://example.com/v1/models", { headers: { Authorization: "Bearer test-gateway-key" } })
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.object).toBe("list");
    expect(body.data).toEqual(
      expect.arrayContaining([
        { id: "llama-3.1-8b-instant", object: "model", owned_by: "groq" },
        { id: "llama3.1-8b", object: "model", owned_by: "cerebras" },
      ])
    );
  });
});

import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { readJson } from "./helpers";

describe("infra routes", () => {
  afterEach(() => {
    delete (env as unknown as Record<string, unknown>).GATEWAY_API_KEY;
  });

  it("responds ok on /health without auth, even with a key configured", async () => {
    env.GATEWAY_API_KEY = "some-key";
    const res = await exports.default.fetch("http://example.com/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("answers CORS preflight without requiring auth", async () => {
    const res = await exports.default.fetch(
      new Request("http://example.com/v1/chat/completions", { method: "OPTIONS" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("returns a structured 404 for unknown routes once authenticated", async () => {
    env.GATEWAY_API_KEY = "some-key";
    const res = await exports.default.fetch(
      new Request("http://example.com/nope", { headers: { Authorization: "Bearer some-key" } })
    );
    expect(res.status).toBe(404);
    const body = await readJson(res);
    expect(body.error.code).toBe(404);
  });
});

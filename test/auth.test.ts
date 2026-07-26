import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { readJson } from "./helpers";

describe("auth", () => {
  afterEach(() => {
    delete (env as unknown as Record<string, unknown>).GATEWAY_API_KEY;
  });

  it("fails closed with 500 when GATEWAY_API_KEY isn't configured, instead of reopening the proxy", async () => {
    const res = await exports.default.fetch(
      new Request("http://example.com/v1/chat/completions", { method: "POST" })
    );
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error.message).toMatch(/GATEWAY_API_KEY/);
  });

  it("returns 401 without a valid bearer token", async () => {
    env.GATEWAY_API_KEY = "secret-token";
    const res = await exports.default.fetch(
      new Request("http://example.com/v1/chat/completions", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("rejects a wrong token with 401", async () => {
    env.GATEWAY_API_KEY = "secret-token";
    const res = await exports.default.fetch(
      new Request("http://example.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-token" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("accepts a request carrying the correct bearer token", async () => {
    env.GATEWAY_API_KEY = "secret-token";
    const res = await exports.default.fetch(
      new Request("http://example.com/v1/models", {
        headers: { Authorization: "Bearer secret-token" },
      })
    );
    expect(res.status).toBe(200);
  });
});

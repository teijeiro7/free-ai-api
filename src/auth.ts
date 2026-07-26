import type { Env } from "./types";

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const requestOrigin = request.headers.get("Origin");
  const allowOrigin =
    allowed.length === 0
      ? "*"
      : requestOrigin && allowed.includes(requestOrigin)
        ? requestOrigin
        : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export type AuthResult = "ok" | "unauthorized" | "unconfigured";

/**
 * Fails CLOSED: a missing GATEWAY_API_KEY denies every request rather than
 * silently reopening the proxy the way the previous worker shipped.
 */
export function checkAuth(request: Request, env: Env): AuthResult {
  if (!env.GATEWAY_API_KEY) return "unconfigured";

  const header = request.headers.get("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token === env.GATEWAY_API_KEY) return "ok";
  return "unauthorized";
}

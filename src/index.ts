import type { ChatMessage, Env } from "./types";
import { checkAuth, corsHeaders } from "./auth";
import { getCatalog, refreshCatalog } from "./catalog";
import { markCooldown } from "./cooldown";
import { buildChatCompletionResponse, buildErrorResponse } from "./openai";
import { resolveCandidates } from "./router";
import { openAiSseToPlainText } from "./sse";
import { callUpstream, UpstreamFailure } from "./upstream";

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  model?: unknown;
  stream?: unknown;
  max_tokens?: unknown;
  temperature?: unknown;
  response_format?: unknown;
}

async function handleChatRequest(
  request: Request,
  env: Env,
  cors: Record<string, string>,
  legacy: boolean
): Promise<Response> {
  let payload: ChatRequestBody;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(buildErrorResponse(400, "Invalid JSON body"), 400, cors);
  }

  const messages = payload.messages;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(buildErrorResponse(400, "`messages` must be a non-empty array"), 400, cors);
  }

  const requestedModel = typeof payload.model === "string" && payload.model.trim() ? payload.model.trim() : "auto";
  const wantsStream = legacy || Boolean(payload.stream);

  const { candidates, resolvedTier } = await resolveCandidates(env, requestedModel);
  if (resolvedTier === "auto" && requestedModel !== "auto") {
    console.warn(`Unknown model "${requestedModel}" requested — falling back to the auto tier`);
  }

  if (candidates.length === 0) {
    return jsonResponse(buildErrorResponse(503, "No AI providers are currently configured or available"), 503, cors);
  }

  let lastFailure: UpstreamFailure | null = null;

  for (const candidate of candidates) {
    try {
      const result = await callUpstream(env, candidate, {
        messages,
        max_tokens: payload.max_tokens,
        temperature: payload.temperature,
        response_format: payload.response_format,
        stream: wantsStream,
      });

      if (wantsStream && result.stream) {
        const stream = legacy ? openAiSseToPlainText(result.stream) : result.stream;
        return new Response(stream, {
          headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }

      return jsonResponse(
        buildChatCompletionResponse(candidate.model, result.content ?? "", result.usage, result.finishReason),
        200,
        cors
      );
    } catch (err) {
      if (err instanceof UpstreamFailure) {
        lastFailure = err;
        if (err.status === 429 || err.status >= 500) {
          await markCooldown(env, candidate.providerId, candidate.model, err.status, err.retryAfter);
        }
        console.error(`${candidate.providerId} (${candidate.model}) failed: ${err.status} ${err.message}`);
        continue;
      }
      throw err;
    }
  }

  return jsonResponse(
    buildErrorResponse(503, lastFailure ? `All providers failed. Last error: ${lastFailure.message}` : "All providers failed"),
    503,
    cors
  );
}

const worker = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/health") {
      return jsonResponse({ status: "ok" }, 200, cors);
    }

    const auth = checkAuth(request, env);
    if (auth === "unconfigured") {
      return jsonResponse(buildErrorResponse(500, "GATEWAY_API_KEY is not configured on this Worker"), 500, cors);
    }
    if (auth === "unauthorized") {
      return jsonResponse(buildErrorResponse(401, "Missing or invalid Authorization header"), 401, cors);
    }

    if (request.method === "GET" && url.pathname === "/v1/models") {
      const catalog = await getCatalog(env);
      const data = Object.entries(catalog.models).flatMap(([providerId, models]) =>
        (models ?? []).map((id) => ({ id, object: "model", owned_by: providerId }))
      );
      return jsonResponse({ object: "list", data }, 200, cors);
    }

    if (request.method === "POST" && url.pathname === "/chat") {
      return handleChatRequest(request, env, cors, true);
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      return handleChatRequest(request, env, cors, false);
    }

    return jsonResponse(buildErrorResponse(404, "Not Found"), 404, cors);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshCatalog(env));
  },
} satisfies ExportedHandler<Env>;

export default worker;

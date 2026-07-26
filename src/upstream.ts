import type { ChatMessage, Env } from "./types";
import type { Candidate } from "./router";
import { findProvider, getApiKey } from "./providers";

const UPSTREAM_TIMEOUT_MS = 30_000;

export interface UpstreamRequest {
  messages: ChatMessage[];
  max_tokens?: unknown;
  temperature?: unknown;
  response_format?: unknown;
  stream: boolean;
}

export interface UpstreamResult {
  content?: string;
  stream?: ReadableStream;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class UpstreamFailure extends Error {
  status: number;
  retryAfter: string | null;

  constructor(status: number, retryAfter: string | null, message: string) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function workersAiStreamToOpenAiSse(input: ReadableStream, model: string): ReadableStream {
  const reader = input.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

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
              const delta = json?.response ?? "";
              if (!delta) continue;
              const chunk = {
                id,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            } catch {
              // Malformed line from Workers AI — skip it.
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

async function callWorkersAi(env: Env, candidate: Candidate, req: UpstreamRequest): Promise<UpstreamResult> {
  if (!env.AI) {
    throw new UpstreamFailure(503, null, "Workers AI binding not configured");
  }

  // The Workers AI binding's return shape depends on the requested model, so this
  // stays loosely typed rather than fighting the SDK's per-model overloads.
  const result = (await env.AI.run(candidate.model as never, {
    messages: req.messages,
    max_tokens: req.max_tokens,
    stream: req.stream,
    // biome-ignore lint: Workers AI accepts an open-ended options bag per model.
  } as never)) as any;

  if (req.stream) {
    return { stream: workersAiStreamToOpenAiSse(result as ReadableStream, candidate.model) };
  }

  const content = result?.response;
  if (!content) {
    throw new UpstreamFailure(502, null, "Empty response from Workers AI");
  }
  return { content };
}

async function callOpenAiCompatible(env: Env, candidate: Candidate, req: UpstreamRequest): Promise<UpstreamResult> {
  const provider = findProvider(candidate.providerId);
  if (!provider || provider.kind !== "openai-compatible") {
    throw new Error(`Unknown OpenAI-compatible provider ${candidate.providerId}`);
  }

  const apiKey = getApiKey(env, provider);
  if (!apiKey) {
    throw new UpstreamFailure(503, null, `No API key configured for ${provider.name}`);
  }

  const body: Record<string, unknown> = {
    model: candidate.model,
    messages: req.messages,
    stream: req.stream,
  };
  if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.response_format !== undefined) body.response_format = req.response_format;

  let response: Response;
  try {
    response = await fetch(`${provider.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    throw new UpstreamFailure(504, null, `Network error calling ${provider.name}: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    console.error(`${provider.name} (${candidate.model}) failed: ${response.status} ${text}`);
    throw new UpstreamFailure(response.status, response.headers.get("retry-after"), `${provider.name} error ${response.status}`);
  }

  if (req.stream) {
    if (!response.body) {
      throw new UpstreamFailure(502, null, `No response body streaming from ${provider.name}`);
    }
    return { stream: response.body };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new UpstreamFailure(502, null, `Empty response from ${provider.name}`);
  }
  return { content, usage: data.usage };
}

/** Calls one candidate. Always returns stream output already framed as OpenAI SSE chunks. */
export async function callUpstream(env: Env, candidate: Candidate, req: UpstreamRequest): Promise<UpstreamResult> {
  if (candidate.providerId === "workers-ai") {
    return callWorkersAi(env, candidate, req);
  }
  return callOpenAiCompatible(env, candidate, req);
}

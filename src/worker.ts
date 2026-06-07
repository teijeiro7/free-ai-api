import { streamChatCompletion, chatCompletion } from "./services";
import type { ChatMessage, Env, AIServiceConfig } from "./types";

const PROVIDERS: AIServiceConfig[] = [
  {
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    models: [
      "openai/gpt-oss-120b",
      "llama-3.3-70b-versatile",
      "qwen-2.5-coder-32b",
    ],
  },
  {
    name: "Cerebras",
    baseURL: "https://api.cerebras.ai/v1",
    models: [
      "llama-3.3-70b",
      "llama3.1-8b",
      "llama3.2-3b",
    ],
  },
  {
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    models: [
      "openai/gpt-oss-120b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-coder:free",
    ],
  },
];

function getApiKey(env: Env, providerName: string): string | undefined {
  const keyName = `${providerName.toUpperCase()}_API_KEY` as keyof Env;
  // @ts-ignore
  return env[keyName] || (typeof process !== "undefined" ? process.env[keyName] : undefined);
}

async function callProvider(
  provider: AIServiceConfig,
  messages: ChatMessage[],
  options?: { max_tokens?: number; temperature?: number }
): Promise<string> {
  const apiKey = getApiKey({}, provider.name);
  if (!apiKey) throw new Error(`No API key for ${provider.name}`);

  for (const model of provider.models) {
    try {
      console.log(`Trying ${provider.name} with model ${model}`);
      return await chatCompletion(
        provider.baseURL,
        apiKey,
        model,
        messages,
        options?.max_tokens,
        options?.temperature
      );
    } catch (err) {
      console.error(`${provider.name} (${model}) failed:`, err);
    }
  }
  throw new Error(`All models failed for ${provider.name}`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.method === "POST" && url.pathname === "/chat") {
      try {
        const { messages } = (await request.json()) as { messages: ChatMessage[] };

        if (!messages || !Array.isArray(messages)) {
          return new Response(JSON.stringify({ error: "Invalid messages" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const startIndex = Math.floor(Math.random() * PROVIDERS.length);
        let lastError: any = null;

        for (let i = 0; i < PROVIDERS.length; i++) {
          const provider = PROVIDERS[(startIndex + i) % PROVIDERS.length];
          const apiKey = getApiKey(env, provider.name);

          if (!apiKey) {
            console.warn(`Skipping ${provider.name}: No API key found`);
            continue;
          }

          for (const model of provider.models) {
            try {
              console.log(`Trying ${provider.name} with model ${model}`);
              const stream = await streamChatCompletion(
                provider.baseURL,
                apiKey,
                model,
                messages
              );

              return new Response(stream, {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "text/event-stream",
                  "Cache-Control": "no-cache",
                },
              });
            } catch (err) {
              console.error(`${provider.name} (${model}) failed:`, err);
              lastError = err;
            }
          }
        }

        throw lastError || new Error("All AI providers failed");
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      try {
        const body = await request.json();
        const messages = body.messages as ChatMessage[];
        const maxTokens = body.max_tokens;
        const temperature = body.temperature;

        if (!messages || !Array.isArray(messages)) {
          return new Response(JSON.stringify({ error: "Invalid messages" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const startIndex = Math.floor(Math.random() * PROVIDERS.length);
        let lastError: any = null;

        for (let i = 0; i < PROVIDERS.length; i++) {
          const provider = PROVIDERS[(startIndex + i) % PROVIDERS.length];
          const apiKey = getApiKey(env, provider.name);

          if (!apiKey) {
            console.warn(`Skipping ${provider.name}: No API key found`);
            continue;
          }

          for (const model of provider.models) {
            try {
              console.log(`[Non-stream] Trying ${provider.name} with model ${model}`);
              const content = await chatCompletion(
                provider.baseURL,
                apiKey,
                model,
                messages,
                maxTokens,
                temperature
              );

              return new Response(JSON.stringify({
                choices: [{
                  message: {
                    role: "assistant",
                    content
                  }
                }]
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            } catch (err) {
              console.error(`${provider.name} (${model}) failed:`, err);
              lastError = err;
            }
          }
        }

        throw lastError || new Error("All AI providers failed");
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

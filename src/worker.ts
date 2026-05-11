import { streamChatCompletion } from "./services";
import type { ChatMessage, Env, AIServiceConfig } from "./types";

const PROVIDERS: AIServiceConfig[] = [
  {
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    models: ["qwen-2.5-coder-32b", "llama-3.3-70b-versatile"],
  },
  {
    name: "Cerebras",
    baseURL: "https://api.cerebras.ai/v1",
    models: ["llama3.1-8b", "llama3.1-70b"],
  },
  {
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    models: [
      "minimax/minimax-m2.5:free",
      "openai/gpt-oss-120b:free",
      "google/gemini-2.0-flash-exp:free",
    ],
  },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
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

        // Determinar API keys (Workers env vs Bun process.env)
        const getApiKey = (providerName: string) => {
          const keyName = `${providerName.toUpperCase()}_API_KEY` as keyof Env;
          // @ts-ignore
          return env[keyName] || (typeof process !== "undefined" ? process.env[keyName] : undefined);
        };

        // Algoritmo Round-Robin para elegir servicio inicial
        const startIndex = Math.floor(Math.random() * PROVIDERS.length);
        let lastError: any = null;

        for (let i = 0; i < PROVIDERS.length; i++) {
          const provider = PROVIDERS[(startIndex + i) % PROVIDERS.length];
          const apiKey = getApiKey(provider.name);

          if (!apiKey) {
            console.warn(`Skipping ${provider.name}: No API key found`);
            continue;
          }

          // Intentar con los modelos del proveedor
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

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

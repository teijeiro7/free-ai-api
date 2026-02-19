import { groqService } from "./services/groq";
import { cerebrasService } from "./services/cerebras";
import { openRouterService } from "./services/openrouter";
import type { AIService, ChatMessage } from "./types";

const services: AIService[] = [groqService, cerebrasService, openRouterService];

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Health check endpoint
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Ruta de chat para recibir mensajes por POST
    if (req.method === "POST" && url.pathname === "/chat") {
      try {
        const body = await req.json();
        const { messages } = body as { messages: ChatMessage[] };

        if (!messages || !Array.isArray(messages)) {
          return new Response(
            JSON.stringify({
              error: "Invalid request. 'messages' array is required.",
            }),
            { status: 400, headers: corsHeaders },
          );
        }

        let lastError: any = null;
        const startIndex = Math.floor(Math.random() * services.length);

        for (let i = 0; i < services.length; i++) {
          const serviceIndex = (startIndex + i) % services.length;
          const service = services[serviceIndex];
          console.log(
            `[${new Date().toISOString()}] Trying service: ${service.name}`,
          );

          try {
            const responseStream = await service.chat(messages);

            const stream = new ReadableStream({
              async start(controller) {
                let closed = false;
                try {
                  for await (const chunk of responseStream) {
                    if (closed) break;
                    try {
                      controller.enqueue(chunk);
                    } catch (enqueueError) {
                      closed = true;
                      break;
                    }
                  }
                  if (!closed) {
                    try {
                      controller.close();
                    } catch (e) {}
                  }
                } catch (streamError) {
                  console.error(
                    `Stream error for ${service.name}:`,
                    streamError,
                  );
                  if (!closed) {
                    try {
                      controller.error(streamError);
                    } catch (e) {}
                  }
                }
              },
            });

            return new Response(stream, {
              headers: {
                ...corsHeaders,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              },
            });
          } catch (err) {
            console.error(`Service ${service.name} failed:`, err);
            lastError = err;
            // Continue loop to try next service
          }
        }

        // If we exit the loop, all services failed
        throw lastError || new Error("All AI services failed");
      } catch (error) {
        console.error("Error processing request:", error);
        return new Response(
          JSON.stringify({
            error: "Internal Server Error",
            details: String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

console.log(`Servidor funcionando en ${server.url}`);

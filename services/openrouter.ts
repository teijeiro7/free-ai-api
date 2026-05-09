import OpenAI from "openai";
import type { AIService, ChatMessage } from "../types";

export const openRouterService: AIService = {
  name: "OpenRouter",
  chat: async function (messages: ChatMessage[]) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set in environment variables");
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const models = [
      "minimax/minimax-m2.5:free",
      "openai/gpt-oss-120b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ];

    let lastError: any = null;
    for (const model of models) {
      try {
        console.log(`[OpenRouter] Trying model: ${model}`);
        const stream = await openai.chat.completions.create({
          messages,
          model,
          stream: true,
        });

        return (async function* () {
          for await (const chunk of stream) {
            yield chunk.choices[0]?.delta?.content || "";
          }
        })();
      } catch (error: any) {
        lastError = error;
        console.error(`[OpenRouter] Model ${model} failed:`, error.message);

        // Retry for model-related issues
        if (error.status !== 400 && error.status !== 404) {
          break;
        }
      }
    }

    throw lastError || new Error("All OpenRouter models failed");
  },
};

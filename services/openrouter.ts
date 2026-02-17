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
      "qwen/qwen3-235b-a22b-thinking-2507",
      "z-ai/glm-4.5-air:free",
      "deepseek/deepseek-r1-0528:free",
    ];

    let lastError: Error | null = null;
    for (const model of models) {
      try {
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
      } catch (error) {
        lastError = error as Error;
        console.error(`Failed with model ${model}:`, error);
      }
    }

    throw lastError || new Error("All OpenRouter models failed");
  },
};

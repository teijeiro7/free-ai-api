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
      "meta-llama/llama-4-maverick:free",
      "meta-llama/llama-4-scout:free",
      "google/gemini-2.5-pro-exp-03-25:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
      "nvidia/llama-3.1-nemotron-nano-8b-v1:free",
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

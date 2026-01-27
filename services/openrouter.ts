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

    const stream = await openai.chat.completions.create({
      messages,
      model: "google/gemini-2.0-flash-exp:free", // Model optimized for free tier or as requested
      stream: true,
    });

    return (async function* () {
      for await (const chunk of stream) {
        yield chunk.choices[0]?.delta?.content || "";
      }
    })();
  },
};

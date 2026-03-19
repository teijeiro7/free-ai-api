import Groq from "groq-sdk";
import type { AIService, ChatMessage } from "../types";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const groqService: AIService = {
  name: "Groq",
  chat: async function (messages: ChatMessage[]) {
    const models = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
      "mixtral-8x7b-32768",
    ];

    let lastError: Error | null = null;
    for (const model of models) {
      try {
        const stream = await groq.chat.completions.create({
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

    throw lastError || new Error("All Groq models failed");
  },
};

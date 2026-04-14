import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { AIService, ChatMessage } from "../types";

const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });

export const cerebrasService: AIService = {
  name: "Cerebras",
  chat: async function (messages: ChatMessage[]) {
    const models = [
      "llama3.3-70b",
      "llama3.1-70b",
      "llama3.1-8b",
    ];

    let lastError: any = null;
    for (const model of models) {
      try {
        console.log(`[Cerebras] Trying model: ${model}`);
        const stream = await client.chat.completions.create({
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
        console.error(`[Cerebras] Model ${model} failed:`, error.message);
        
        // Retry only if it's a model-related error
        if (error.status !== 400 && error.status !== 404) {
          break;
        }
      }
    }

    throw lastError || new Error("All Cerebras models failed");
  },
};

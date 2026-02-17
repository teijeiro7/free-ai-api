import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { AIService, ChatMessage } from "../types";

const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });

type CerebrasMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const cerebrasService: AIService = {
  name: "Cerebras",
  chat: async function (messages: ChatMessage[]) {
    const models = [
      "llama-3.3-70b-versatile",
      "qwen-3-32b-instruct",
      "llama-3.1-8b-instruct",
    ];

    const cerebrasMessages: CerebrasMessage[] = messages as CerebrasMessage[];

    let lastError: Error | null = null;
    for (const model of models) {
      try {
        const stream = await client.chat.completions.create({
          messages: cerebrasMessages,
          model,
          stream: true,
        });

        const iterator = stream[Symbol.asyncIterator]() as AsyncIterator<{ choices: Array<{ delta: { content?: string } }> }>;

        return (async function* () {
          let result = await iterator.next();
          while (!result.done) {
            yield result.value.choices[0]?.delta?.content || "";
            result = await iterator.next();
          }
        })();
      } catch (error) {
        lastError = error as Error;
        console.error(`Failed with model ${model}:`, error);
      }
    }

    throw lastError || new Error("All Cerebras models failed");
  },
};

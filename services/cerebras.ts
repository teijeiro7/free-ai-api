import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { AIService, ChatMessage } from "../types";

const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });

export const cerebrasService: AIService = {
  name: "Cerebras",
  chat: async function (messages: ChatMessage[]) {
    const stream = await client.chat.completions.create({
      messages,
      model: "llama3.1-70b",
      stream: true,
    });

    return (async function* () {
      for await (const chunk of stream) {
        yield chunk.choices[0]?.delta?.content || "";
      }
    })();
  },
};

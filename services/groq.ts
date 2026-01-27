import Groq from "groq-sdk";
import type { AIService, ChatMessage } from "../types";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const groqService: AIService = {
  name: "Groq",
  chat: async function (messages: ChatMessage[]) {
    const stream = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile", // O el modelo disponible en la capa gratuita
      stream: true,
    });

    return (async function* () {
      for await (const chunk of stream) {
        yield chunk.choices[0]?.delta?.content || "";
      }
    })();
  },
};

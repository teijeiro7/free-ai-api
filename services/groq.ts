import Groq from "groq-sdk";
import type { AIService, ChatMessage } from "../types";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Lista de modelos ordenados por preferencia.
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama3.3-70b-specdec",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
];

export const groqService: AIService = {
  name: "Groq",
  chat: async function (messages: ChatMessage[]) {
    let lastError: any = null;

    for (const model of GROQ_MODELS) {
      try {
        console.log(`[Groq] Trying model: ${model}`);
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
      } catch (err: any) {
        console.error(`[Groq] Model ${model} failed:`, err.message);
        lastError = err;
        
        // Si no es un error de "modelo no encontrado" o similar (400),
        // quizás no valga la pena reintentar con otro modelo.
        // Pero para ser robustos ante depreciaciones, seguimos al siguiente.
        if (err.status !== 400 && err.status !== 404) {
          break; 
        }
      }
    }

    throw lastError || new Error("All Groq models failed");
  },
};

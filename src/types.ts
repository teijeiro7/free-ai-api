export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface AIServiceConfig {
  name: string;
  baseURL: string;
  models: string[];
}

export interface Env {
  GROQ_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ENVIRONMENT?: string;
}

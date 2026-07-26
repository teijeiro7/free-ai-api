export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export type ProviderId = "groq" | "cerebras" | "openrouter" | "gemini" | "workers-ai";

export type ApiKeyName = "GROQ_API_KEY" | "CEREBRAS_API_KEY" | "OPENROUTER_API_KEY" | "GEMINI_API_KEY";

export interface OpenAICompatProvider {
  id: Exclude<ProviderId, "workers-ai">;
  name: string;
  kind: "openai-compatible";
  baseURL: string;
  keyName: ApiKeyName;
  modelsPath: string;
  /** Keep a model from the provider's /models listing only if this returns true. */
  filterModel?: (raw: Record<string, unknown>) => boolean;
  /** Maps a discovered id to the id actually accepted in a chat/completions `model` field. */
  normalizeModelId?: (id: string) => string;
}

export interface WorkersAiProvider {
  id: "workers-ai";
  name: string;
  kind: "workers-ai";
  /** Cloudflare's curated free catalog barely rotates, so it's hand-maintained rather than discovered. */
  staticModels: string[];
}

export type ProviderDef = OpenAICompatProvider | WorkersAiProvider;

export interface Env {
  GATEWAY_API_KEY?: string;
  GROQ_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
  CATALOG: KVNamespace;
  AI?: Ai;
}

export interface OpenAIChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
  };
}

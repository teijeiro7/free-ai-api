import type { Env, OpenAICompatProvider, ProviderDef } from "./types";

export const PROVIDERS: ProviderDef[] = [
  {
    id: "groq",
    name: "Groq",
    kind: "openai-compatible",
    baseURL: "https://api.groq.com/openai/v1",
    keyName: "GROQ_API_KEY",
    modelsPath: "/models",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    kind: "openai-compatible",
    baseURL: "https://api.cerebras.ai/v1",
    keyName: "CEREBRAS_API_KEY",
    modelsPath: "/models",
  },
  {
    id: "gemini",
    name: "Gemini",
    kind: "openai-compatible",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyName: "GEMINI_API_KEY",
    modelsPath: "/models",
    // Gemini's /models listing returns fully-qualified names ("models/gemini-2.5-flash"),
    // but its OpenAI-compat chat/completions endpoint expects the bare id.
    normalizeModelId: (id) => id.replace(/^models\//, ""),
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai-compatible",
    baseURL: "https://openrouter.ai/api/v1",
    keyName: "OPENROUTER_API_KEY",
    modelsPath: "/models",
    filterModel: (raw) => {
      const pricing = raw.pricing as Record<string, unknown> | undefined;
      const prompt = Number(pricing?.prompt ?? -1);
      const completion = Number(pricing?.completion ?? -1);
      return prompt === 0 && completion === 0;
    },
  },
  {
    id: "mistral",
    name: "Mistral",
    kind: "openai-compatible",
    baseURL: "https://api.mistral.ai/v1",
    keyName: "MISTRAL_API_KEY",
    modelsPath: "/models",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    kind: "openai-compatible",
    baseURL: "https://integrate.api.nvidia.com/v1",
    keyName: "NVIDIA_API_KEY",
    modelsPath: "/models",
  },
  {
    id: "workers-ai",
    name: "Workers AI",
    kind: "workers-ai",
    staticModels: [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/qwen/qwen1.5-14b-chat-awq",
    ],
  },
];

export function getApiKey(env: Env, provider: OpenAICompatProvider): string | undefined {
  return env[provider.keyName];
}

/** Providers whose credentials (or, for Workers AI, binding) are actually present on this Env. */
export function getConfiguredProviders(env: Env): ProviderDef[] {
  return PROVIDERS.filter((provider) => {
    if (provider.kind === "workers-ai") return Boolean(env.AI);
    return Boolean(getApiKey(env, provider));
  });
}

export function findProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

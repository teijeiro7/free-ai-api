import type { ProviderId } from "./types";

export interface PreferredModel {
  provider: ProviderId;
  model: string;
}

/**
 * These are PREFERENCES, not guarantees — router.ts intersects them against the
 * live discovered catalog (see catalog.ts), so a stale or wrong id here just gets
 * skipped instead of breaking the gateway the way the old hardcoded list did.
 */
const FAST: PreferredModel[] = [
  { provider: "cerebras", model: "llama3.1-8b" },
  { provider: "groq", model: "llama-3.1-8b-instant" },
  { provider: "gemini", model: "gemini-2.5-flash-lite" },
  { provider: "workers-ai", model: "@cf/meta/llama-3.1-8b-instruct" },
];

const SMART: PreferredModel[] = [
  { provider: "cerebras", model: "qwen-3-235b-a22b-instruct-2507" },
  { provider: "groq", model: "moonshotai/kimi-k2-instruct" },
  { provider: "groq", model: "meta-llama/llama-4-maverick-17b-128e-instruct" },
  { provider: "gemini", model: "gemini-2.5-flash" },
  { provider: "openrouter", model: "deepseek/deepseek-r1:free" },
  { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
];

const JSON_TIER: PreferredModel[] = [
  { provider: "gemini", model: "gemini-2.5-flash" },
  { provider: "groq", model: "llama-3.3-70b-versatile" },
  { provider: "cerebras", model: "llama-3.3-70b" },
  { provider: "openrouter", model: "qwen/qwen3-235b-a22b:free" },
];

const LONG: PreferredModel[] = [
  { provider: "gemini", model: "gemini-2.5-flash" },
  { provider: "groq", model: "llama-3.3-70b-versatile" },
  { provider: "cerebras", model: "llama-3.3-70b" },
];

function dedupe(list: PreferredModel[]): PreferredModel[] {
  const seen = new Set<string>();
  return list.filter((entry) => {
    const key = `${entry.provider}:${entry.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const ALIASES: Record<string, PreferredModel[]> = {
  fast: FAST,
  smart: SMART,
  json: JSON_TIER,
  long: LONG,
  auto: dedupe([...SMART, ...FAST, ...JSON_TIER, ...LONG]),
};

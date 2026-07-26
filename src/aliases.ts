import type { ProviderId } from "./types";

export interface PreferredModel {
  providerId: ProviderId;
  model: string;
}

/**
 * These are PREFERENCES, not guarantees — router.ts intersects them against the
 * live discovered catalog (see catalog.ts), so a stale or wrong id here just gets
 * skipped instead of breaking the gateway the way the old hardcoded list did.
 */
const FAST: PreferredModel[] = [
  { providerId: "groq", model: "llama-3.1-8b-instant" },
  { providerId: "gemini", model: "gemini-2.5-flash-lite" },
  { providerId: "workers-ai", model: "@cf/meta/llama-3.1-8b-instruct" },
];

const SMART: PreferredModel[] = [
  { providerId: "gemini", model: "gemini-2.5-pro" },
  { providerId: "cerebras", model: "gpt-oss-120b" },
  { providerId: "groq", model: "openai/gpt-oss-120b" },
  { providerId: "openrouter", model: "nvidia/nemotron-3-ultra-550b-a55b:free" },
  { providerId: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
];

const JSON_TIER: PreferredModel[] = [
  { providerId: "gemini", model: "gemini-2.5-flash" },
  { providerId: "groq", model: "llama-3.3-70b-versatile" },
  { providerId: "cerebras", model: "gpt-oss-120b" },
  { providerId: "openrouter", model: "google/gemma-4-31b-it:free" },
];

const LONG: PreferredModel[] = [
  { providerId: "gemini", model: "gemini-2.5-pro" },
  { providerId: "gemini", model: "gemini-2.5-flash" },
  { providerId: "groq", model: "llama-3.3-70b-versatile" },
];

function dedupe(list: PreferredModel[]): PreferredModel[] {
  const seen = new Set<string>();
  return list.filter((entry) => {
    const key = `${entry.providerId}:${entry.model}`;
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

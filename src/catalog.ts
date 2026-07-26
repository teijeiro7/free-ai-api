import type { Env, ProviderDef, ProviderId } from "./types";
import { getApiKey, getConfiguredProviders } from "./providers";

const CATALOG_KEY = "catalog:v1";
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const DISCOVERY_TIMEOUT_MS = 8000;

export interface Catalog {
  updatedAt: number;
  models: Partial<Record<ProviderId, string[]>>;
}

async function fetchProviderModels(provider: ProviderDef, env: Env): Promise<string[]> {
  if (provider.kind === "workers-ai") return provider.staticModels;

  const apiKey = getApiKey(env, provider);
  if (!apiKey) return [];

  try {
    const response = await fetch(`${provider.baseURL}${provider.modelsPath}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`Model discovery failed for ${provider.name}: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as { data?: Array<Record<string, unknown>> };
    const list = Array.isArray(data?.data) ? data.data : [];
    return list
      .filter((entry) => (provider.filterModel ? provider.filterModel(entry) : true))
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map((id) => (provider.normalizeModelId ? provider.normalizeModelId(id) : id));
  } catch (err) {
    console.warn(`Model discovery errored for ${provider.name}:`, err);
    return [];
  }
}

export async function refreshCatalog(env: Env): Promise<Catalog> {
  const providers = getConfiguredProviders(env);
  const entries = await Promise.all(
    providers.map(async (provider) => [provider.id, await fetchProviderModels(provider, env)] as const)
  );

  const models: Partial<Record<ProviderId, string[]>> = {};
  for (const [id, list] of entries) models[id] = list;

  const catalog: Catalog = { updatedAt: Date.now(), models };
  await env.CATALOG.put(CATALOG_KEY, JSON.stringify(catalog));
  return catalog;
}

export async function getCatalog(env: Env): Promise<Catalog> {
  const raw = await env.CATALOG.get(CATALOG_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as Catalog;
    if (Date.now() - parsed.updatedAt < CATALOG_TTL_MS) return parsed;
  }
  return refreshCatalog(env);
}

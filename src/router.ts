import type { Env, ProviderId } from "./types";
import { ALIASES, type PreferredModel } from "./aliases";
import { getCatalog, type Catalog } from "./catalog";
import { isInCooldown } from "./cooldown";
import { getConfiguredProviders } from "./providers";

export interface Candidate {
  providerId: ProviderId;
  model: string;
}

export interface ResolvedRoute {
  candidates: Candidate[];
  resolvedTier: string;
}

function catalogHas(catalog: Catalog, providerId: ProviderId, model: string): boolean {
  return Boolean(catalog.models[providerId]?.includes(model));
}

/**
 * Resolves a requested `model` (alias, literal id, or unknown string) into an
 * ordered list of live candidates. Preferences are intersected against the
 * discovered catalog and the current cooldown set, so a provider rotating its
 * lineup just drops out here instead of producing a 500 — see catalog.ts and
 * cooldown.ts.
 */
export async function resolveCandidates(env: Env, requestedModel: string): Promise<ResolvedRoute> {
  const catalog = await getCatalog(env);
  const configured = new Set(getConfiguredProviders(env).map((p) => p.id));

  let preferences: PreferredModel[];
  let resolvedTier: string;

  if (ALIASES[requestedModel]) {
    preferences = ALIASES[requestedModel];
    resolvedTier = requestedModel;
  } else {
    const providerIds = Object.keys(catalog.models) as ProviderId[];
    const exactProvider = providerIds.find((id) => catalogHas(catalog, id, requestedModel));
    if (exactProvider) {
      preferences = [{ providerId: exactProvider, model: requestedModel }, ...ALIASES.auto];
      resolvedTier = "exact";
    } else {
      preferences = ALIASES.auto;
      resolvedTier = "auto";
    }
  }

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const pref of preferences) {
    if (!configured.has(pref.providerId)) continue;
    if (!catalogHas(catalog, pref.providerId, pref.model)) continue;

    const key = `${pref.providerId}:${pref.model}`;
    if (seen.has(key)) continue;
    if (await isInCooldown(env, pref.providerId, pref.model)) continue;

    seen.add(key);
    candidates.push({ providerId: pref.providerId, model: pref.model });
  }

  // Safety net: every preferred id was stale, cooled down, or unconfigured —
  // fall back to the first live, healthy model of each configured provider.
  if (candidates.length === 0) {
    for (const providerId of configured) {
      const models = catalog.models[providerId] ?? [];
      for (const model of models) {
        const key = `${providerId}:${model}`;
        if (seen.has(key)) continue;
        if (await isInCooldown(env, providerId, model)) continue;
        seen.add(key);
        candidates.push({ providerId, model });
        break;
      }
    }
  }

  return { candidates, resolvedTier };
}

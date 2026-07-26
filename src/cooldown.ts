import type { Env, ProviderId } from "./types";

const MIN_TTL_SECONDS = 60; // Workers KV rejects expirationTtl below 60s.
const MAX_TTL_SECONDS = 3600;
const DEFAULT_RATE_LIMIT_TTL = 60;
const DEFAULT_SERVER_ERROR_TTL = 60;

function cooldownKey(providerId: ProviderId, model: string): string {
  return `cooldown:${providerId}:${model}`;
}

export async function isInCooldown(env: Env, providerId: ProviderId, model: string): Promise<boolean> {
  const value = await env.CATALOG.get(cooldownKey(providerId, model));
  return value !== null;
}

export async function markCooldown(
  env: Env,
  providerId: ProviderId,
  model: string,
  status: number,
  retryAfterHeader: string | null
): Promise<void> {
  let ttl = status === 429 ? DEFAULT_RATE_LIMIT_TTL : DEFAULT_SERVER_ERROR_TTL;

  const retryAfter = Number(retryAfterHeader);
  if (retryAfterHeader && Number.isFinite(retryAfter) && retryAfter > 0) {
    ttl = retryAfter;
  }

  const clampedTtl = Math.max(MIN_TTL_SECONDS, Math.min(ttl, MAX_TTL_SECONDS));
  await env.CATALOG.put(cooldownKey(providerId, model), "1", { expirationTtl: clampedTtl });
}

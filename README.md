# free-ai-api

Personal AI gateway on Cloudflare Workers. Unifies Groq, Cerebras, Gemini,
OpenRouter (`:free` models) and Workers AI behind a single OpenAI-compatible
API, with automatic model discovery so a provider deprecating or renaming a
model doesn't break the gateway — it just stops being offered.

## Why it's built this way

The previous version hardcoded a model id per provider. Every few weeks one of
those ids got deprecated or renamed upstream and every request started
failing with a 500, because the fallback chain only knew about hand-typed
model names. This version discovers each provider's live model catalog via
its `/models` endpoint, caches it in KV, and only ever calls into models that
are confirmed to exist right now.

## Endpoints

- `GET /health` — liveness check, no auth required.
- `GET /v1/models` — the currently discovered catalog, OpenAI list-shaped.
- `POST /v1/chat/completions` — OpenAI-compatible. Supports `stream`,
  `response_format`, `max_tokens`, `temperature`.
- `POST /chat` — legacy endpoint kept for existing consumers (currently
  `smashly-app`). Always streams plain text deltas under
  `text/event-stream`, same as before.

Both `/chat` and `/v1/chat/completions` require
`Authorization: Bearer <GATEWAY_API_KEY>`. The previous version had no auth
at all — anyone who found the URL could spend the account's free-tier quota.

## Model selection

Send an alias instead of a specific model id and the router picks the best
live candidate for you:

| Alias   | Use for |
|---------|---------|
| `fast`  | low-latency, short answers |
| `smart` | harder reasoning |
| `json`  | structured output (pairs with `response_format`) |
| `long`  | large context windows |
| `auto`  | anything else — also the fallback for unrecognized model names |

A literal model id also works — it's tried first, then the router falls back
to `auto` if that exact id isn't currently available anywhere. If a model
disappears from a provider's catalog (or a provider is rate-limited), the
router silently moves to the next candidate; it never needs a code change or
redeploy to route around that.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create the KV namespace used for the model catalog cache and per-model
   cooldowns, then paste the id it prints into `wrangler.toml`:
   ```bash
   npx wrangler login
   npx wrangler kv namespace create CATALOG
   ```

3. Set secrets. `GATEWAY_API_KEY` is required — without it the Worker fails
   closed (500) on every request rather than running as an open proxy.
   Provider keys are optional; a provider without a key is simply skipped.
   ```bash
   npx wrangler secret put GATEWAY_API_KEY
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put CEREBRAS_API_KEY
   npx wrangler secret put OPENROUTER_API_KEY
   npx wrangler secret put GEMINI_API_KEY
   ```
   Workers AI needs no key — it's wired via the `[ai]` binding in
   `wrangler.toml` and used as a last-resort provider.

4. Deploy:
   ```bash
   npm run deploy
   ```

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in a GATEWAY_API_KEY and whichever provider keys you have
npm run dev
```

## Testing

```bash
npm run typecheck
npm test
```

Tests run against `wrangler.test.toml`, a config without the `[ai]` binding —
Workers AI requires a real remote session even for local simulation, which
would otherwise force `npm test` to need a `CLOUDFLARE_API_TOKEN`. Its
absence there also serves as the "Workers AI not configured" test fixture.

## Structure

- `src/index.ts` — routing, auth, request/response shaping.
- `src/providers.ts` — provider registry (base URLs, key names, static
  Workers AI model list).
- `src/catalog.ts` — live `/models` discovery, cached in KV for 24h.
- `src/aliases.ts` — alias → preferred-model-chain definitions.
- `src/router.ts` — resolves a requested model into an ordered list of live,
  non-cooling-down candidates.
- `src/cooldown.ts` — KV-backed per-model cooldown after 429/5xx.
- `src/upstream.ts` — calls a single candidate (OpenAI-compatible fetch or
  the Workers AI binding), normalizes streaming to OpenAI SSE chunks.
- `src/openai.ts` / `src/sse.ts` — response shaping for the two endpoints.
- `wrangler.toml` — production config (KV, Workers AI binding, daily catalog
  refresh cron). `wrangler.test.toml` — test-only variant without `[ai]`.

## Known consumers

- `durit-prospector` (frontend + backend) — migrated to this gateway.
- `smashly-app` (`api/_lib/ai.ts`) — uses the legacy `/chat` endpoint and
  needs an `Authorization: Bearer <GATEWAY_API_KEY>` header added once auth
  is enforced; not migrated as part of this change.

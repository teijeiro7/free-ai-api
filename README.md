# Bun AI API Gateway (Cloudflare Workers Ready)

Un proxy/gateway API ultra-ligero y rápido que unifica múltiples proveedores de IA (Groq, Cerebras, OpenRouter) en una única interfaz compatible con OpenAI. Optimizado para **Cloudflare Workers** y compatible con **Bun**.

## 🚀 Características

- **Máximo Rendimiento**: Sin SDKs pesados. Usa `fetch` nativo para cold starts instantáneos.
- **Multi-proveedor**: Groq, Cerebras y OpenRouter.
- **Failover Inteligente**: Round-robin entre proveedores y reintento automático entre modelos.
- **Dual Runtime**: Despliégalo en Cloudflare Workers o ejecútalo localmente con Bun.
- **Streaming SSE**: Soporte completo para respuestas en tiempo real.

## ⚙️ Configuración (Cloudflare Workers)

1. **Instala las dependencias**:
   ```bash
   npm install
   ```

2. **Configura tus API Keys como Secrets**:
   ```bash
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put CEREBRAS_API_KEY
   npx wrangler secret put OPENROUTER_API_KEY
   ```

3. **Despliega**:
   ```bash
   npm run deploy
   ```

## ⚙️ Configuración (Local con Bun)

1. **Archivo .env**:
   Crea un `.env` con tus claves:
   ```env
   GROQ_API_KEY=...
   CEREBRAS_API_KEY=...
   OPENROUTER_API_KEY=...
   ```

2. **Ejecuta**:
   ```bash
   npm start
   ```

## 🛠️ Desarrollo

- **Simular Workers localmente**: `npm run dev`
- **Test de API**: `bun run test_api.ts`

## 🏗️ Estructura

- `src/worker.ts`: Entry point (Fetch handler).
- `src/services.ts`: Lógica de streaming nativa.
- `src/types.ts`: Definiciones de tipos.
- `wrangler.toml`: Configuración de Cloudflare.

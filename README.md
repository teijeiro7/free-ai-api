# Bun AI API Gateway

Un proxy/gateway API ligero y rápido construido con [Bun](https://bun.sh) que unifica múltiples proveedores de IA (Groq, Cerebras, OpenRouter) en una única interfaz compatible con OpenAI.

## 🚀 Características

- **Multi-proveedor**: Soporte integrado para Groq (Llama 3.3), Cerebras (Llama 3.1) y OpenRouter (Gemini 2.0 Flash Exp).
- **Failover Automático (Round-Robin)**: Si un servicio falla, automáticamente intenta con el siguiente en la lista.
- **Streaming**: Soporte completo para Server-Sent Events (SSE) para respuestas en tiempo real.
- **Ligero y Rápido**: Construido sobre el runtime de Bun para máximo rendimiento.
- **CORS Habilitado**: Configurado para aceptar peticiones desde cualquier origen, ideal para consumir desde el frontend.

## 📋 Requisitos Previos

- [Bun](https://bun.sh) instalado en tu sistema.

## 🛠️ Instalación

1.  Clona el repositorio:

    ```bash
    git clone <tu-repositorio>
    cd <tu-carpeta-del-proyecto>
    ```

2.  Instala las dependencias:
    ```bash
    bun install
    ```

## ⚙️ Configuración

Crea un archivo `.env` en la raíz del proyecto y añade tus claves de API:

```env
GROQ_API_KEY=tu_clave_de_groq
CEREBRAS_API_KEY=tu_clave_de_cerebras
OPENROUTER_API_KEY=tu_clave_de_openrouter
PORT=3000 # Opcional, por defecto 3000
```

## ▶️ Uso

### Iniciar el servidor

Modo desarrollo (con recarga automática):

```bash
bun dev
```

Modo producción:

```bash
bun start
```

### Endpoint de Chat

**POST** `/chat`

El servidor espera un cuerpo JSON con una lista de mensajes compatibles con el formato de chat completions de OpenAI.

**Ejemplo de solicitud (cURL):**

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Hola, ¿quién eres?" }
    ]
  }'
```

**Respuesta:**

El servidor devolverá un stream de eventos (Server-Sent Events) con el contenido de la respuesta.

## 🧪 Testing

El proyecto incluye un script de prueba para verificar rápidamente que todo funciona correctamente:

```bash
bun run test_api.ts
```

## 🏗️ Estructura del Proyecto

- `index.ts`: Punto de entrada de la aplicación y servidor HTTP.
- `services/`: Implementaciones específicas de cada proveedor de IA.
- `types.ts`: Definiciones de tipos TypeScript compartidos.
- `nixpacks.toml`: Configuración para despliegue automatizado (ej. en Railway/Render).

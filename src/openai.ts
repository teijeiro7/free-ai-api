import type { ChatMessage, OpenAIChatCompletionResponse, OpenAIErrorResponse, OpenAIUsage } from "./types";

const ERROR_TYPES: Record<number, string> = {
  400: "invalid_request_error",
  401: "authentication_error",
  404: "not_found_error",
  500: "configuration_error",
  502: "bad_gateway_error",
  503: "unavailable_error",
};

export function buildChatCompletionResponse(
  model: string,
  content: string,
  usage?: Partial<OpenAIUsage>,
  finishReason = "stop"
): OpenAIChatCompletionResponse {
  const message: ChatMessage = { role: "assistant", content };
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: {
      prompt_tokens: usage?.prompt_tokens ?? 0,
      completion_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
    },
  };
}

export function buildErrorResponse(status: number, message: string): OpenAIErrorResponse {
  return {
    error: {
      message,
      type: ERROR_TYPES[status] ?? "upstream_error",
      code: status,
    },
  };
}

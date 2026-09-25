import type { LlmConfig, LlmProvider, LlmRequest, LlmResponse } from "@/lib/ai/llm-types";

// Genel amaçlı HTTP sohbet-tamamlama (chat-completions biçimli) sağlayıcı.
// "openai-compatible" yalnızca istek/yanıt şeklinin adıdır; tüm değerler LlmConfig'ten gelir.

function buildUrl(config: LlmConfig): string {
  const url = new URL(config.endpoint);
  if (config.apiVersion !== "") {
    url.searchParams.set(config.apiVersionParam, config.apiVersion);
  }
  return url.toString();
}

function buildHeaders(config: LlmConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey !== "") {
    headers[config.authHeader] = config.authScheme === "" ? config.apiKey : `${config.authScheme} ${config.apiKey}`;
  }
  return { ...headers, ...config.extraHeaders };
}

function buildSignal(config: LlmConfig, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(config.timeoutMs);
  if (!external) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeout, external]);
  }
  return timeout;
}

function extractText(payload: unknown): string | null {
  const choice = (payload as { choices?: unknown[] } | null)?.choices?.[0] as
    | { message?: { content?: unknown }; text?: unknown }
    | undefined;
  const content = choice?.message?.content;
  if (typeof content === "string" && content.trim() !== "") return content;
  if (typeof choice?.text === "string" && choice.text.trim() !== "") return choice.text;
  return null;
}

export function createOpenAiCompatibleProvider(config: LlmConfig): LlmProvider {
  return {
    name: "openai-compatible",
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const body = {
        model: config.model,
        messages: request.messages,
        temperature: request.temperature ?? 0,
        ...(request.json && config.jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...config.providerOptions,
      };

      const response = await fetch(buildUrl(config), {
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify(body),
        signal: buildSignal(config, request.signal),
      });

      // Yanıt gövdesi asla hata mesajına eklenmez (gizli veri sızıntısını önlemek için).
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = extractText(await response.json());
      if (text === null) {
        throw new Error("LLM yanıtında içerik yok");
      }
      return { text };
    },
  };
}

// Sağlayıcıdan bağımsız LLM servis arayüzü. Hiçbir sağlayıcıya özgü değer içermez.

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export interface LlmRequest {
  messages: LlmMessage[];
  json?: boolean;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LlmResponse {
  text: string;
}

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export interface LlmConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
  apiVersion: string;
  apiVersionParam: string;
  authHeader: string;
  authScheme: string;
  extraHeaders: Record<string, string>;
  providerOptions: Record<string, unknown>;
  jsonMode: boolean;
  timeoutMs: number;
}

export type LlmProviderFactory = (config: LlmConfig) => LlmProvider;

import type { LlmConfig, LlmProvider, LlmProviderFactory } from "@/lib/ai/llm-types";
import { loadLlmConfig } from "@/lib/ai/llm-config";
import { createOpenAiCompatibleProvider } from "@/lib/ai/providers/openai-compatible";

// Yeni sağlayıcı eklemek: yeni bir dosya + aşağıya tek bir registerLlmProvider çağrısı.
const registry = new Map<string, LlmProviderFactory>();

export function registerLlmProvider(name: string, factory: LlmProviderFactory): void {
  registry.set(name, factory);
}

registerLlmProvider("openai-compatible", createOpenAiCompatibleProvider);

/** Yapılandırma yoksa veya sağlayıcı adı bilinmiyorsa null döner. */
export function getLlmProvider(config: LlmConfig | null = loadLlmConfig()): LlmProvider | null {
  if (!config) return null;

  const factory = registry.get(config.provider);
  if (!factory) {
    console.warn(`Bilinmeyen AI sağlayıcısı: ${config.provider}`);
    return null;
  }
  return factory(config);
}

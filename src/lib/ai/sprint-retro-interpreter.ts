import {
  SprintRetroSchema,
  buildSprintRetroPrompt,
  formatSprintRetroMarkdown,
  renderSprintRetroSections,
  type SprintRetroAggregateInput,
} from "@/lib/sprint-assistant-logic";
import { extractJsonObject } from "@/lib/ai-proposal-logic";
import { getLlmProvider } from "@/lib/ai/providers";

/**
 * Aynı sprint özet verisinden daha zengin bir 3 bölümlü retrospektif taslağı üretir. Bir LLM
 * sağlayıcısı yapılandırılmışsa onu kullanır; yoksa veya herhangi bir hata olursa deterministik
 * taslağa (`formatSprintRetroMarkdown`) düşer. Bu fonksiyon ASLA hata fırlatmaz.
 *
 * Bilinçli olarak "use server" dosyasında DEĞİLDİR (istemciden çağrılabilir endpoint olmamalı).
 */
export async function analyzeSprintRetro(input: SprintRetroAggregateInput): Promise<string> {
  const fallback = () => formatSprintRetroMarkdown(input);

  let providerName = "unknown";
  try {
    const provider = getLlmProvider();
    if (!provider) {
      return fallback();
    }
    providerName = provider.name;

    const { system, user } = buildSprintRetroPrompt(input);
    const { text } = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      temperature: 0,
    });

    const sections = SprintRetroSchema.parse(JSON.parse(extractJsonObject(text)));
    return renderSprintRetroSections(sections);
  } catch (err) {
    // Anahtar, yanıt gövdesi veya kullanıcı metni loglanmaz; yalnızca sağlayıcı adı ve hata adı/durumu.
    const reason = err instanceof Error ? (err.message.startsWith("HTTP ") ? err.message : err.name) : "UnknownError";
    console.warn(`AI sprint retro yorumlayıcı: LLM çağrısı başarısız (${providerName}: ${reason}); deterministik taslak kullanılıyor.`);
    return fallback();
  }
}

import {
  WeeklyDigestSchema,
  buildWeeklyDigestPrompt,
  type WeeklyDigest,
  type WeeklyMetrics,
} from "@/lib/weekly-digest-logic";
import { extractJsonObject } from "@/lib/ai-proposal-logic";
import { getLlmProvider } from "@/lib/ai/providers";

const EMPTY_DIGEST: WeeklyDigest = { highlights: [], nextWeekPriorities: [] };

/**
 * Haftalık sprint metriklerinden öne çıkan başarılar / önümüzdeki hafta öncelikleri üretir.
 * Bir LLM sağlayıcısı yapılandırılmışsa onu kullanır; yoksa veya herhangi bir hata olursa
 * boş listeler döner (`formatWeeklyDigestMarkdown` boş diziler için varsayılan metin üretir).
 * Bu fonksiyon ASLA hata fırlatmaz.
 *
 * Bilinçli olarak "use server" dosyasında DEĞİLDİR (istemciden çağrılabilir endpoint olmamalı).
 */
export async function analyzeWeeklyDigest(params: {
  metrics: WeeklyMetrics;
  projectName: string;
  weekNumber: number;
  healthStatus: string;
}): Promise<WeeklyDigest> {
  let providerName = "unknown";
  try {
    const provider = getLlmProvider();
    if (!provider) {
      return EMPTY_DIGEST;
    }
    providerName = provider.name;

    const { system, user } = buildWeeklyDigestPrompt(params);
    const { text } = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      temperature: 0,
    });

    return WeeklyDigestSchema.parse(JSON.parse(extractJsonObject(text)));
  } catch (err) {
    // Anahtar, yanıt gövdesi veya kullanıcı metni loglanmaz; yalnızca sağlayıcı adı ve hata adı/durumu.
    const reason = err instanceof Error ? (err.message.startsWith("HTTP ") ? err.message : err.name) : "UnknownError";
    console.warn(`AI haftalık özet yorumlayıcı: LLM çağrısı başarısız (${providerName}: ${reason}); boş özet kullanılıyor.`);
    return EMPTY_DIGEST;
  }
}

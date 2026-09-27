import {
  StandupSynthesisSchema,
  buildStandupSynthesisPrompt,
  summarizeStandupHeuristic,
  type StandupEntryInput,
  type StandupSynthesis,
} from "@/lib/standup-logic";
import { extractJsonObject } from "@/lib/ai-proposal-logic";
import { getLlmProvider } from "@/lib/ai/providers";

/**
 * Ekip standup yanıtlarını (dün/bugün/engel) sentezler. Bir LLM sağlayıcısı yapılandırılmışsa
 * (bkz. llm-config.ts) onu kullanır; yoksa veya herhangi bir hata olursa deterministik
 * heuristic'e (`summarizeStandupHeuristic`) düşer. Bu fonksiyon ASLA hata fırlatmaz.
 *
 * Bilinçli olarak "use server" dosyasında DEĞİLDİR (istemciden çağrılabilir endpoint olmamalı).
 */
export async function analyzeStandupText(params: {
  entries: StandupEntryInput[];
  projectName: string;
}): Promise<StandupSynthesis> {
  const fallback = () => summarizeStandupHeuristic(params.entries);

  let providerName = "unknown";
  try {
    const provider = getLlmProvider();
    if (!provider) {
      return fallback();
    }
    providerName = provider.name;

    const { system, user } = buildStandupSynthesisPrompt(params);
    const { text } = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      temperature: 0,
    });

    return StandupSynthesisSchema.parse(JSON.parse(extractJsonObject(text)));
  } catch (err) {
    // Anahtar, yanıt gövdesi veya kullanıcı metni loglanmaz; yalnızca sağlayıcı adı ve hata adı/durumu.
    const reason = err instanceof Error ? (err.message.startsWith("HTTP ") ? err.message : err.name) : "UnknownError";
    console.warn(`AI standup yorumlayıcı: LLM çağrısı başarısız (${providerName}: ${reason}); heuristic kullanılıyor.`);
    return fallback();
  }
}

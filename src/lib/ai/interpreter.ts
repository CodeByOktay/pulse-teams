import {
  ProgressInterpretationSchema,
  buildInterpretationPrompt,
  extractJsonObject,
  interpretProgressHeuristic,
  type ProgressInterpretation,
} from "@/lib/ai-proposal-logic";
import { getLlmProvider } from "@/lib/ai/providers";

/**
 * İlerleme metnini yorumlar. Bir LLM sağlayıcısı yapılandırılmışsa (bkz. llm-config.ts) onu kullanır;
 * yoksa veya herhangi bir hata olursa deterministik heuristic'e düşer. Bu fonksiyon ASLA hata fırlatmaz.
 *
 * Bilinçli olarak "use server" dosyasında DEĞİLDİR (istemciden çağrılabilir endpoint olmamalı).
 */
export async function analyzeProgressText(params: {
  content: string;
  currentTaskTitle: string;
  currentStateName: string;
  currentStateGroup: string;
  availableStates: Array<{ id: string; name: string; group: string }>;
}): Promise<ProgressInterpretation> {
  const fallback = () => interpretProgressHeuristic(params.content, params.currentStateGroup);

  let providerName = "unknown";
  try {
    const provider = getLlmProvider();
    if (!provider) {
      return fallback();
    }
    providerName = provider.name;

    const { system, user } = buildInterpretationPrompt(params);
    const { text } = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      temperature: 0,
    });

    return ProgressInterpretationSchema.parse(JSON.parse(extractJsonObject(text)));
  } catch (err) {
    // Anahtar, yanıt gövdesi veya kullanıcı metni loglanmaz; yalnızca sağlayıcı adı ve hata adı/durumu.
    const reason = err instanceof Error ? (err.message.startsWith("HTTP ") ? err.message : err.name) : "UnknownError";
    console.warn(`AI yorumlayıcı: LLM çağrısı başarısız (${providerName}: ${reason}); heuristic kullanılıyor.`);
    return fallback();
  }
}

import {
  WorkloadReassignmentSchema,
  buildWorkloadReassignmentPrompt,
  formatWorkloadProposalSummary,
  WORKLOAD_PROPOSAL_CONFIDENCE,
  type WorkloadReassignmentCandidateInput,
  type WorkloadReassignmentSuggestion,
} from "@/lib/workload-logic";
import { extractJsonObject } from "@/lib/ai-proposal-logic";
import { getLlmProvider } from "@/lib/ai/providers";

/**
 * Aşırı yüklü bir üyenin devredilecek görevi için, etiket/uzmanlık örtüşmesine göre en
 * uygun boşta üyeyi önerir. Bir LLM sağlayıcısı yapılandırılmışsa onu kullanır; yoksa,
 * hata olursa veya LLM tanımadığımız bir aday id'si döndürürse (`candidates` dışında),
 * deterministik ilk adaya (`candidates[0]`) düşer. Bu fonksiyon ASLA hata fırlatmaz —
 * yalnızca `candidates` boş verilirse (çağıranın sözleşme ihlali) senkron olarak fırlatır.
 *
 * Bilinçli olarak "use server" dosyasında DEĞİLDİR (istemciden çağrılabilir endpoint olmamalı).
 */
export async function analyzeWorkloadReassignment(params: {
  pmName: string | null;
  overloadedMemberName: string;
  overloadedActiveCount: number;
  task: { title: string; labels: string[] };
  candidates: WorkloadReassignmentCandidateInput[];
}): Promise<WorkloadReassignmentSuggestion> {
  if (params.candidates.length === 0) {
    throw new Error("analyzeWorkloadReassignment: candidates must not be empty");
  }

  const fallback = (): WorkloadReassignmentSuggestion => {
    const fallbackCandidate = params.candidates[0];
    return {
      suggestedAssigneeId: fallbackCandidate.userId,
      summary: formatWorkloadProposalSummary({
        pmName: params.pmName,
        overloadedMemberName: params.overloadedMemberName,
        overloadedActiveCount: params.overloadedActiveCount,
        taskTitle: params.task.title,
        underutilizedMemberName: fallbackCandidate.userName,
      }),
      confidence: WORKLOAD_PROPOSAL_CONFIDENCE,
    };
  };

  let providerName = "unknown";
  try {
    const provider = getLlmProvider();
    if (!provider) {
      return fallback();
    }
    providerName = provider.name;

    const { system, user } = buildWorkloadReassignmentPrompt(params);
    const { text } = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      temperature: 0,
    });

    const parsed = WorkloadReassignmentSchema.parse(JSON.parse(extractJsonObject(text)));

    // Never trust an LLM-picked id blindly — it must be one of the candidates we offered it.
    const validCandidateIds = new Set(params.candidates.map((candidate) => candidate.userId));
    if (!validCandidateIds.has(parsed.suggestedAssigneeId)) {
      return fallback();
    }

    return parsed;
  } catch (err) {
    // Anahtar, yanıt gövdesi veya kullanıcı metni loglanmaz; yalnızca sağlayıcı adı ve hata adı/durumu.
    const reason = err instanceof Error ? (err.message.startsWith("HTTP ") ? err.message : err.name) : "UnknownError";
    console.warn(`AI iş yükü yorumlayıcı: LLM çağrısı başarısız (${providerName}: ${reason}); deterministik öneri kullanılıyor.`);
    return fallback();
  }
}

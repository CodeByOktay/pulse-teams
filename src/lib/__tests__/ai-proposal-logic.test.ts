import { describe, it, expect } from "vitest";
import {
  interpretProgressHeuristic,
  matchSuggestedStateId,
  isProposalStale,
  buildInterpretationPrompt,
  extractJsonObject,
  ProgressInterpretationSchema,
} from "../ai-proposal-logic";
import { resolveLlmConfig } from "../ai/llm-config";

describe("ai-proposal-logic — interpretProgressHeuristic", () => {
  it("tamamlanma anahtar kelimeleri geçtiğinde DONE durumu önerir ve yüksek güven döner", () => {
    const result = interpretProgressHeuristic(
      "Görevi tamamladım, testler geçti ve ana dala merge ettik.",
      "IN_PROGRESS",
    );

    expect(result.suggestedGroup).toBe("DONE");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.blockerDetected).toBe(false);
    expect(result.summary).toContain("Görevi tamamladım");
  });

  it("bitti kelimesi büyük harfle (BİTTİ) yazıldığında Türkçe karakter uyumuyla DONE algılar", () => {
    const result = interpretProgressHeuristic("HER ŞEY BİTTİ.", "IN_PROGRESS");
    expect(result.suggestedGroup).toBe("DONE");
  });

  it("engel ve hata kelimeleri geçtiğinde engel tespit eder ve takip gerektiğini belirtir", () => {
    const result = interpretProgressHeuristic(
      "CORS hatası alıyorum ve servisten yanıt bekliyorum, bloke oldum.",
      "IN_PROGRESS",
    );

    expect(result.blockerDetected).toBe(true);
    expect(result.blockerDetails).toBeDefined();
    expect(result.followUpNeeded).toBe(true);
  });

  it("çalışma devam ediyorsa IN_PROGRESS önerir ve takip ihtiyacını işaretler", () => {
    const result = interpretProgressHeuristic(
      "Bileşenleri kodluyorum, API entegrasyonu yarına kaldı.",
      "TODO",
    );

    expect(result.suggestedGroup).toBe("IN_PROGRESS");
    expect(result.followUpNeeded).toBe(true);
  });

  it("hem engel hem devam ifadesi olduğunda engeli de takip ihtiyacını da yakalar", () => {
    const result = interpretProgressHeuristic(
      "Çalışıyorum ama veritabanı bağlantısında problem var.",
      "IN_PROGRESS",
    );

    expect(result.blockerDetected).toBe(true);
    expect(result.followUpNeeded).toBe(true);
  });

  it("belirgin anahtar kelime içermeyen nötr metinlerde durum önerisi null döner", () => {
    const result = interpretProgressHeuristic(
      "Dokümantasyonu okudum ve mimariyi inceledim.",
      "IN_PROGRESS",
    );

    expect(result.suggestedGroup).toBeNull();
    expect(result.blockerDetected).toBe(false);
  });

  it("çok kısa veya anlamsız metinlerde varsayılan özet üretir", () => {
    const result = interpretProgressHeuristic("..", "TODO");
    expect(result.summary).toBe("İlerleme güncellemesi paylaşıldı.");
  });

  it("çıktının Zod ProgressInterpretationSchema şemasına uyduğunu doğrular", () => {
    const result = interpretProgressHeuristic("Her şey tamamlandı.", "IN_PROGRESS");
    const parsed = ProgressInterpretationSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});

describe("ai-proposal-logic — matchSuggestedStateId", () => {
  const availableStates = [
    { id: "st-backlog", group: "BACKLOG" },
    { id: "st-todo", group: "TODO" },
    { id: "st-prog", group: "IN_PROGRESS" },
    { id: "st-done", group: "DONE" },
  ];

  it("önerilen grup mevcut durumdan farklıysa hedef durum id'sini döner", () => {
    const matched = matchSuggestedStateId("DONE", availableStates, "st-prog");
    expect(matched).toBe("st-done");
  });

  it("önerilen grup null ise null döner", () => {
    const matched = matchSuggestedStateId(null, availableStates, "st-prog");
    expect(matched).toBeNull();
  });

  it("önerilen grup zaten görevin mevcut durumu ile aynı gruptaysa null döner (gereksiz değişim yok)", () => {
    const matched = matchSuggestedStateId("IN_PROGRESS", availableStates, "st-prog");
    expect(matched).toBeNull();
  });

  it("önerilen grup listede bulunamazsa null döner", () => {
    const matched = matchSuggestedStateId("CANCELLED", availableStates, "st-prog");
    expect(matched).toBeNull();
  });
});

describe("ai-proposal-logic — isProposalStale", () => {
  it("görev zaten önerilen hedef duruma ulaşmışsa stale (eskimiş) döner", () => {
    expect(isProposalStale("st-done", "st-done")).toBe(true);
  });

  it("görev önerilen durumdan farklı bir durumdaysa false döner", () => {
    expect(isProposalStale("st-prog", "st-done")).toBe(false);
  });

  it("hedef durum null ise false döner", () => {
    expect(isProposalStale("st-prog", null)).toBe(false);
  });
});

describe("ai-proposal-logic — extractJsonObject", () => {
  it("saf JSON metnini olduğu gibi ayıklar", () => {
    const raw = '{"summary": "Test", "confidence": 0.9}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("markdown çitleri içindeki (```json ... ```) JSON nesnesini ayıklar", () => {
    const wrapped = '```json\n{"summary": "Test", "confidence": 0.9}\n```';
    expect(extractJsonObject(wrapped)).toBe('{"summary": "Test", "confidence": 0.9}');
  });

  it("öncesinde ve sonrasında serbest açıklama olan JSON nesnesini başarıyla izole eder", () => {
    const mixed = 'Açıklama: {"summary": "Bitirildi", "confidence": 0.95} teşekkürler.';
    expect(extractJsonObject(mixed)).toBe('{"summary": "Bitirildi", "confidence": 0.95}');
  });

  it("süslü parantez içermeyen metin verildiğinde kırpılmış metni döner", () => {
    expect(extractJsonObject("düz metin")).toBe("düz metin");
  });
});

describe("ai-proposal-logic — buildInterpretationPrompt", () => {
  it("sistem ve kullanıcı istemlerini güvenlik etiketleriyle yapılandırır", () => {
    const prompt = buildInterpretationPrompt({
      content: "Component testleri bitti.",
      currentTaskTitle: "Dashboard UI",
      currentStateName: "Geliştirmede",
      currentStateGroup: "IN_PROGRESS",
      availableStates: [
        { id: "1", name: "Yapılacak", group: "TODO" },
        { id: "2", name: "Tamamlandı", group: "DONE" },
      ],
    });

    expect(prompt.system).toContain("<progress_update>");
    expect(prompt.user).toContain("Task title: Dashboard UI");
    expect(prompt.user).toContain("<progress_update>");
    expect(prompt.user).toContain("Component testleri bitti.");
    expect(prompt.user).toContain("</progress_update>");
  });
});

describe("llm-config — resolveLlmConfig", () => {
  it("endpoint veya model eksik olduğunda null döner (AI devre dışı)", () => {
    const config = resolveLlmConfig({});
    expect(config).toBeNull();
  });

  it("yer tutucu (placeholder) değerler verildiğinde null döner", () => {
    const config = resolveLlmConfig({
      AI_ENDPOINT: "<your-endpoint>",
      AI_MODEL: "your-model-name",
    });
    expect(config).toBeNull();
  });

  it("geçersiz URL verildiğinde null döner", () => {
    const config = resolveLlmConfig({
      AI_ENDPOINT: "not-a-valid-url",
      AI_MODEL: "gpt-4o-mini",
    });
    expect(config).toBeNull();
  });

  it("geçerli env değişkenleri ile LlmConfig nesnesini tam olarak çözer", () => {
    const config = resolveLlmConfig({
      AI_ENDPOINT: "https://api.openai.com/v1",
      AI_MODEL: "gpt-4o-mini",
      AI_API_KEY: "sk-test-key",
      AI_TIMEOUT_MS: "12000",
      AI_AUTH_SCHEME: "Bearer",
    });

    expect(config).not.toBeNull();
    expect(config?.endpoint).toBe("https://api.openai.com/v1");
    expect(config?.model).toBe("gpt-4o-mini");
    expect(config?.apiKey).toBe("sk-test-key");
    expect(config?.timeoutMs).toBe(12000);
    expect(config?.authScheme).toBe("Bearer");
  });

  it("AI_AUTH_SCHEME 'none' olarak ayarlandığında boş şema döner", () => {
    const config = resolveLlmConfig({
      AI_ENDPOINT: "https://api.internal.org",
      AI_MODEL: "llama-3",
      AI_AUTH_SCHEME: "none",
    });

    expect(config?.authScheme).toBe("");
  });

  it("env değişkenleri dosya yapılandırmasını (fileConfig) ezer", () => {
    const config = resolveLlmConfig(
      {
        AI_MODEL: "env-model",
      },
      {
        endpoint: "https://api.internal.org",
        model: "file-model",
      },
    );

    expect(config?.model).toBe("env-model");
    expect(config?.endpoint).toBe("https://api.internal.org");
  });
});

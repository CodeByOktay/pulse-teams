import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SIMILARITY_THRESHOLD,
  buildTaskEmbeddingText,
  computeContentHash,
  shouldRegenerateEmbedding,
  cosineSimilarity,
  toVectorLiteral,
  clampSimilarity,
  filterBySimilarityThreshold,
  mergeHybridResults,
} from "../semantic-search";
import {
  EMBEDDING_DIMENSIONS,
  resolveEmbeddingConfig,
  getEmbedding,
} from "../ai/embeddings";

describe("semantic-search pure logic", () => {
  describe("SIMILARITY_THRESHOLD sabiti", () => {
    it("varsayılan benzerlik eşiği 0.7 olarak tanımlanmıştır", () => {
      expect(SIMILARITY_THRESHOLD).toBe(0.7);
    });
  });

  describe("buildTaskEmbeddingText", () => {
    it("başlık ve açıklama mevcutken standart başlık+açıklama formatı oluşturur", () => {
      const result = buildTaskEmbeddingText({
        projectIdentifier: "PRJ",
        sequenceId: 12,
        title: "Ödeme Entegrasyonu",
        description: "Stripe webhook bildirimleri işlenmeli ve DB'ye kaydedilmeli.",
      });

      expect(result).toBe(
        "[PRJ-12] Ödeme Entegrasyonu\n\nStripe webhook bildirimleri işlenmeli ve DB'ye kaydedilmeli."
      );
    });

    it("açıklama null iken sadece başlık ve identifier formatı oluşturur (sonda boşluk bırakmaz)", () => {
      const result = buildTaskEmbeddingText({
        projectIdentifier: "PRJ",
        sequenceId: 42,
        title: "Login ekranı düzenleme",
        description: null,
      });

      expect(result).toBe("[PRJ-42] Login ekranı düzenleme");
    });

    it("açıklama undefined iken sadece başlık ve identifier formatı oluşturur", () => {
      const result = buildTaskEmbeddingText({
        projectIdentifier: "DEV",
        sequenceId: 1,
        title: "Veritabanı indeksi ekleme",
        description: undefined,
      });

      expect(result).toBe("[DEV-1] Veritabanı indeksi ekleme");
    });

    it("açıklama sadece boşluklardan (whitespace) oluşuyorsa açıklama atlanır", () => {
      const result = buildTaskEmbeddingText({
        projectIdentifier: "APP",
        sequenceId: 5,
        title: "UI Buton Rengi",
        description: "   \n\t   ",
      });

      expect(result).toBe("[APP-5] UI Buton Rengi");
    });

    it("açıklamanın başındaki ve sonundaki gereksiz boşlukları kırpar", () => {
      const result = buildTaskEmbeddingText({
        projectIdentifier: "PLN",
        sequenceId: 100,
        title: "Sprint Raporu",
        description: "   Detaylar burada yer alır.   \n",
      });

      expect(result).toBe("[PLN-100] Sprint Raporu\n\nDetaylar burada yer alır.");
    });

    it("özel karakterler ve Türkçe harfleri eksiksiz korur", () => {
      const result = buildTaskEmbeddingText({
        projectIdentifier: "İŞL",
        sequenceId: 7,
        title: "Çağrı merkezi & şifre sıfırlama akışı",
        description: "Öğrenci işleri modülü güncellenecektir.",
      });

      expect(result).toBe("[İŞL-7] Çağrı merkezi & şifre sıfırlama akışı\n\nÖğrenci işleri modülü güncellenecektir.");
    });
  });

  describe("computeContentHash", () => {
    it("SHA-256 algoritmasıyla 64 karakterli onaltılık (hex) özet üretir", () => {
      const hash = computeContentHash("Örnek görev metni");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("aynı girdi için her zaman deterministik olarak aynı hash değerini üretir", () => {
      const text = "[PRJ-1] Test Görevi";
      expect(computeContentHash(text)).toBe(computeContentHash(text));
    });

    it("metindeki tek bir karakter değiştiğinde farklı hash üretir", () => {
      const hash1 = computeContentHash("Görev 1");
      const hash2 = computeContentHash("Görev 2");
      expect(hash1).not.toBe(hash2);
    });

    it("boş metin için de geçerli SHA-256 hash üretir", () => {
      const emptyHash = computeContentHash("");
      // SHA-256 of empty string is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      expect(emptyHash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });
  });

  describe("shouldRegenerateEmbedding", () => {
    it("mevcut hash null ise yeniden üretim gerekir (true)", () => {
      expect(shouldRegenerateEmbedding(null, "Yeni metin")).toBe(true);
    });

    it("mevcut hash undefined ise yeniden üretim gerekir (true)", () => {
      expect(shouldRegenerateEmbedding(undefined, "Yeni metin")).toBe(true);
    });

    it("mevcut hash yeni metnin hash'i ile aynı ise yeniden üretim gerekmez (false)", () => {
      const text = "[PRJ-10] Değişmeyen görev";
      const hash = computeContentHash(text);
      expect(shouldRegenerateEmbedding(hash, text)).toBe(false);
    });

    it("mevcut hash farklı ise yeniden üretim gerekir (true)", () => {
      const oldHash = computeContentHash("[PRJ-10] Eski başlık");
      const newText = "[PRJ-10] Güncellenmiş başlık";
      expect(shouldRegenerateEmbedding(oldHash, newText)).toBe(true);
    });
  });

  describe("cosineSimilarity", () => {
    it("özdeş vektörler için benzerlik 1.0 olmalıdır", () => {
      const v = [0.2, 0.4, 0.6, 0.8];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it("aynı yöndeki ancak farklı büyüklükteki vektörler için benzerlik 1.0 olmalıdır", () => {
      const v1 = [1, 2, 3];
      const v2 = [2, 4, 6];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0, 5);
    });

    it("birbirine dik (orthogonal) vektörler için benzerlik 0.0 olmalıdır", () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0, 5);
    });

    it("tam zıt yöndeki vektörler için benzerlik -1.0 olmalıdır", () => {
      const v1 = [1, 0];
      const v2 = [-1, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0, 5);
    });

    it("45 derece açılı iki vektör için benzerlik cos(45°) ≈ 0.7071 olmalıdır", () => {
      const v1 = [1, 0];
      const v2 = [1, 1];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(Math.SQRT1_2, 4);
    });

    it("vektör boyutları (uzunlukları) farklı ise 0 döner", () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2];
      expect(cosineSimilarity(v1, v2)).toBe(0);
    });

    it("boş vektörler verildiğinde 0 döner", () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it("sıfır büyüklükte (sıfır normu olan) vektör verildiğinde sıfıra bölmeyi önler ve 0 döner", () => {
      const zeroVec = [0, 0, 0];
      const normalVec = [1, 2, 3];
      expect(cosineSimilarity(zeroVec, normalVec)).toBe(0);
      expect(cosineSimilarity(normalVec, zeroVec)).toBe(0);
      expect(cosineSimilarity(zeroVec, zeroVec)).toBe(0);
    });
  });

  describe("toVectorLiteral", () => {
    it("sayı dizisini pgvector sözdizimine uygun köşeli parantezli dizi dizesine çevirir", () => {
      expect(toVectorLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
    });

    it("boş dizi için '[]' döner", () => {
      expect(toVectorLiteral([])).toBe("[]");
    });

    it("negatif ve ondalıklı değerleri doğru şekilde formatlar", () => {
      expect(toVectorLiteral([-0.015, 0.9876, 0])).toBe("[-0.015,0.9876,0]");
    });
  });

  describe("clampSimilarity", () => {
    it("0 ile 1 arasındaki değerleri değiştirmeden korur", () => {
      expect(clampSimilarity(0.75)).toBe(0.75);
      expect(clampSimilarity(0)).toBe(0);
      expect(clampSimilarity(1)).toBe(1);
    });

    it("0'dan küçük değerleri 0'a eşitler", () => {
      expect(clampSimilarity(-0.0001)).toBe(0);
      expect(clampSimilarity(-0.8)).toBe(0);
    });

    it("1'den büyük değerleri 1'e eşitler", () => {
      expect(clampSimilarity(1.0001)).toBe(1);
      expect(clampSimilarity(1.5)).toBe(1);
    });
  });

  describe("filterBySimilarityThreshold", () => {
    const items = [
      { id: "1", similarity: 0.95 },
      { id: "2", similarity: 0.7 },
      { id: "3", similarity: 0.69 },
      { id: "4", similarity: 0.82 },
      { id: "5", similarity: 0.3 },
    ];

    it("varsayılan 0.7 eşiği ve üzerindeki öğeleri girdi sırasını koruyarak filtreler", () => {
      const filtered = filterBySimilarityThreshold(items);
      expect(filtered).toEqual([
        { id: "1", similarity: 0.95 },
        { id: "2", similarity: 0.7 },
        { id: "4", similarity: 0.82 },
      ]);
    });

    it("özel eşik değeri verildiğinde o eşiği uygular", () => {
      const filtered = filterBySimilarityThreshold(items, 0.8);
      expect(filtered).toEqual([
        { id: "1", similarity: 0.95 },
        { id: "4", similarity: 0.82 },
      ]);
    });

    it("hiçbir öğe eşiği aşmıyorsa boş dizi döner", () => {
      const filtered = filterBySimilarityThreshold(items, 0.99);
      expect(filtered).toEqual([]);
    });

    it("boş girdi için boş dizi döner", () => {
      expect(filterBySimilarityThreshold([])).toEqual([]);
    });
  });

  describe("mergeHybridResults", () => {
    it("vektör sonuçlarını azalan benzerliğe göre sıralayıp başa koyar, ardından metin sonuçlarını ekler", () => {
      const textResults = [
        { id: "t1", title: "Metin 1" },
        { id: "t2", title: "Metin 2" },
      ];
      const vectorResults = [
        { id: "v1", title: "Vektör 1", similarity: 0.75 },
        { id: "v2", title: "Vektör 2", similarity: 0.92 },
      ];

      const merged = mergeHybridResults(textResults, vectorResults);

      expect(merged.map((m) => m.id)).toEqual(["v2", "v1", "t1", "t2"]);
    });

    it("aynı kimliğe (id) sahip öğelerde vektör sonucunu önceliklendirir ve tekilleştirir", () => {
      const textResults = [
        { id: "task-1", title: "Ödeme Entegrasyonu" },
        { id: "task-2", title: "Fatura İptali" },
      ];
      const vectorResults = [
        { id: "task-1", title: "Ödeme Entegrasyonu", similarity: 0.88 },
        { id: "task-3", title: "Stripe Webhook", similarity: 0.72 },
      ];

      const merged = mergeHybridResults(textResults, vectorResults);

      expect(merged.map((m) => m.id)).toEqual(["task-1", "task-3", "task-2"]);
      expect((merged[0] as { similarity?: number }).similarity).toBe(0.88);
    });

    it("eşiğin altındaki vektör sonuçlarını vektör bloğuna almaz ancak metin sonuçlarında varsa korur", () => {
      const textResults = [
        { id: "task-low", title: "Düşük benzerlikli görev" },
        { id: "task-other", title: "Diğer görev" },
      ];
      const vectorResults = [
        { id: "task-high", title: "Yüksek benzerlik", similarity: 0.85 },
        { id: "task-low", title: "Düşük benzerlikli görev", similarity: 0.45 }, // < 0.7
      ];

      const merged = mergeHybridResults(textResults, vectorResults);

      expect(merged.map((m) => m.id)).toEqual(["task-high", "task-low", "task-other"]);
    });

    it("girdi dizilerini mutasyona uğratmaz (saf fonksiyon prensibi)", () => {
      const textResults = Object.freeze([{ id: "t1" }, { id: "t2" }]);
      const vectorResults = Object.freeze([
        { id: "v1", similarity: 0.8 },
        { id: "v2", similarity: 0.9 },
      ]);

      const merged = mergeHybridResults(textResults as any, vectorResults as any);

      expect(merged.length).toBe(4);
      expect(textResults[0].id).toBe("t1");
      expect(vectorResults[0].id).toBe("v1");
    });

    it("vektör sonuçları boş olduğunda orijinal metin sonuçlarını sırasıyla döner", () => {
      const textResults = [{ id: "t1" }, { id: "t2" }];
      const merged = mergeHybridResults(textResults, []);
      expect(merged).toEqual(textResults);
    });

    it("metin sonuçları boş olduğunda sadece nitelikli vektör sonuçlarını döner", () => {
      const vectorResults = [
        { id: "v1", similarity: 0.72 },
        { id: "v2", similarity: 0.95 },
      ];
      const emptyTextResults: Array<{ id: string }> = [];
      const merged = mergeHybridResults(emptyTextResults, vectorResults);
      expect(merged.map((m) => m.id)).toEqual(["v2", "v1"]);
    });
  });
});

describe("ai/embeddings module", () => {
  describe("EMBEDDING_DIMENSIONS sabiti", () => {
    it("vektör boyutu OpenAI uyumlu 1536 olarak tanımlanmıştır", () => {
      expect(EMBEDDING_DIMENSIONS).toBe(1536);
    });
  });

  describe("resolveEmbeddingConfig", () => {
    it("geçerli ortam değişkenleriyle yapılandırmayı eksiksiz çözer", () => {
      const env = {
        AI_EMBEDDING_ENDPOINT: "https://api.openai.com/v1/embeddings",
        AI_EMBEDDING_MODEL: "text-embedding-3-small",
        AI_API_KEY: "sk-test-key",
        AI_AUTH_HEADER: "Authorization",
        AI_AUTH_SCHEME: "Bearer",
        AI_TIMEOUT_MS: "12000",
      };

      const config = resolveEmbeddingConfig(env);

      expect(config).toEqual({
        endpoint: "https://api.openai.com/v1/embeddings",
        model: "text-embedding-3-small",
        apiKey: "sk-test-key",
        authHeader: "Authorization",
        authScheme: "Bearer",
        timeoutMs: 12000,
      });
    });

    it("isteğe bağlı parametreler eksik olduğunda varsayılan değerleri atar", () => {
      const env = {
        AI_EMBEDDING_ENDPOINT: "https://api.together.xyz/v1/embeddings",
        AI_EMBEDDING_MODEL: "baai/bge-large-en-v1.5",
      };

      const config = resolveEmbeddingConfig(env);

      expect(config).not.toBeNull();
      expect(config?.authHeader).toBe("Authorization");
      expect(config?.authScheme).toBe("Bearer");
      expect(config?.timeoutMs).toBe(8000);
      expect(config?.apiKey).toBe("");
    });

    it("AI_AUTH_SCHEME 'none' olarak belirtildiğinde boş dizeye dönüştürür", () => {
      const env = {
        AI_EMBEDDING_ENDPOINT: "http://localhost:11434/v1/embeddings",
        AI_EMBEDDING_MODEL: "nomic-embed-text",
        AI_AUTH_SCHEME: "none",
      };

      const config = resolveEmbeddingConfig(env);
      expect(config?.authScheme).toBe("");
    });

    it("AI_TIMEOUT_MS sınırlarını korur: 1000ms altı 1000ms'e, 60000ms üstü 60000ms'e sınırlandırılır", () => {
      const lowTimeoutConfig = resolveEmbeddingConfig({
        AI_EMBEDDING_ENDPOINT: "https://api.example.com/embed",
        AI_EMBEDDING_MODEL: "test-model",
        AI_TIMEOUT_MS: "250",
      });
      expect(lowTimeoutConfig?.timeoutMs).toBe(1000);

      const highTimeoutConfig = resolveEmbeddingConfig({
        AI_EMBEDDING_ENDPOINT: "https://api.example.com/embed",
        AI_EMBEDDING_MODEL: "test-model",
        AI_TIMEOUT_MS: "999999",
      });
      expect(highTimeoutConfig?.timeoutMs).toBe(60000);
    });

    it("AI_EMBEDDING_ENDPOINT tanımlı değilse null döner", () => {
      const config = resolveEmbeddingConfig({
        AI_EMBEDDING_MODEL: "text-embedding-ada-002",
      });
      expect(config).toBeNull();
    });

    it("AI_EMBEDDING_MODEL tanımlı değilse null döner", () => {
      const config = resolveEmbeddingConfig({
        AI_EMBEDDING_ENDPOINT: "https://api.openai.com/v1/embeddings",
      });
      expect(config).toBeNull();
    });

    it("yer tutucu (placeholder) değerler verildiğinde null döner", () => {
      expect(
        resolveEmbeddingConfig({
          AI_EMBEDDING_ENDPOINT: "https://api.openai.com/v1/embeddings",
          AI_EMBEDDING_MODEL: "<insert-model-here>",
        })
      ).toBeNull();

      expect(
        resolveEmbeddingConfig({
          AI_EMBEDDING_ENDPOINT: "https://api.openai.com/v1/embeddings",
          AI_EMBEDDING_MODEL: "your-model-name",
        })
      ).toBeNull();

      expect(
        resolveEmbeddingConfig({
          AI_EMBEDDING_ENDPOINT: "CHANGE_ME",
          AI_EMBEDDING_MODEL: "text-embedding-3-small",
        })
      ).toBeNull();
    });

    it("geçersiz URL formatında null döner", () => {
      const config = resolveEmbeddingConfig({
        AI_EMBEDDING_ENDPOINT: "not-a-valid-http-url",
        AI_EMBEDDING_MODEL: "text-embedding-3-small",
      });
      expect(config).toBeNull();
    });
  });

  describe("getEmbedding", () => {
    const validConfig = {
      endpoint: "https://api.openai.com/v1/embeddings",
      model: "text-embedding-3-small",
      apiKey: "sk-test",
      authHeader: "Authorization",
      authScheme: "Bearer",
      timeoutMs: 5000,
    };

    const mockVector = Array.from({ length: 1536 }, (_, i) => i * 0.001);

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("yapılandırma null olduğunda API çağrısı yapmadan null döner", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const result = await getEmbedding("test metin", null);

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("başarılı API yanıtında 1536 boyutlu sayı dizisi döner", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockVector }],
        }),
      } as Response);

      const result = await getEmbedding("Giriş ekranı tasarımı", validConfig);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(1536);
      expect(result?.[0]).toBe(0);
      expect(result?.[1]).toBe(0.001);
    });

    it("API çağrısı doğru başlıkları ve gövdeyi iletir", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockVector }],
        }),
      } as Response);

      await getEmbedding("Arama terimi", validConfig);

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.openai.com/v1/embeddings",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sk-test",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: "Arama terimi",
          }),
        })
      );
    });

    it("HTTP hata durumunda (401, 500 vb.) hata fırlatmaz, sessizce null döner", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await getEmbedding("test", validConfig);
      expect(result).toBeNull();
    });

    it("ağ veya zaman aşımı hatası durumunda hata fırlatmaz, sessizce null döner", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network timeout"));

      const result = await getEmbedding("test", validConfig);
      expect(result).toBeNull();
    });

    it("yanıt gövdesindeki embedding boyutu 1536 değilse geçersiz sayıp null döner", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }], // 3 boyutlu
        }),
      } as Response);

      const result = await getEmbedding("test", validConfig);
      expect(result).toBeNull();
    });

    it("yanıt gövdesindeki embedding sayısal olmayan değerler içeriyorsa null döner", async () => {
      const invalidVector = Array.from({ length: 1536 }, () => "not-a-number");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: invalidVector }],
        }),
      } as Response);

      const result = await getEmbedding("test", validConfig);
      expect(result).toBeNull();
    });
  });
});

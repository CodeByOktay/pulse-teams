# ADR-032: AI Destekli İlerleme Yorumlama ve Onaylı Güncelleme Mimarisi (AgentProposal)

- **Durum:** Kabul Edildi (Accepted)
- **Tarih:** 2026-09-25
- **Karar Vericiler:** Antigravity (Lead Architect & QA Authority), Claude Code (Builder)
- **Sürüm:** v0.5.4 (Phase 5 MVP Tamamlandı — Step 5.04)
- **İlgili ADR:** [ADR-013-Aktivite Geçmişi & Denetim Günlüğü](./ADR-013-aktivite-gecmisi-ve-denetim-gunlugu.md), [ADR-028-AI Destekli Proaktif Proje Koordinasyon Mimarisi](./ADR-028-ai-destekli-proaktif-proje-koordinasyonu.md), [ADR-029-Domain Event Temeli ve Aktivite Genişletmesi](./ADR-029-domain-event-temeli-ve-aktivite-genisletmesi.md), [ADR-031-İlerleme Talebi ve Yanıtı Yaşam Döngüsü](./ADR-031-ilerleme-talebi-ve-yaniti-yasam-dongusu.md)

---

## 1. Bağlam ve Problem Tanımı (Context)

Pulse v0.5.3 ile birlikte ekip üyelerinden görev durumu talep edilebiliyor ve doğal dilde ilerleme yanıtları (`ProgressResponse`) toplanabiliyordu. Ancak bu metinlerin proje yönetimsel bir anlam ifade edebilmesi, görev durumunun güncellenmesi ve panonun senkronize kalabilmesi için insanın her yanıtı tek tek okuyup manuel olarak sütun değiştirmesi gerekiyordu.

Hedeflenen Proaktif AI Deneyimi:
Kullanıcı serbest metin olarak *"API testleri bitti, ana dala merge ettik"* yazdığında, sistemin bu metni doğal dil işleme ile anlamlandırması, hedef durumun `DONE` olduğunu tespit etmesi, varsa engelleri süzmesi ve bunu bir **öneri (proposal)** olarak insan onayına sunması gerekiyordu.

Teknik gereksinimler ve güvenlik kısıtları:
1. **Sağlayıcıdan Bağımsız (Provider-Agnostic) LLM Entegrasyonu:** Kod tabanına hiçbir sağlayıcı (OpenAI, Anthropic vb.) bağımlılığı sabit kodlanmamalı (hardcoded olmamalı); endpoint, model, yetkilendirme şeması ve başlıklar tamamen `.env` veya `ai.config.json` üzerinden yapılandırılabilmelidir.
2. **Dayanıklı Deterministik Fallback (Zero-failure AI Fallback):** API anahtarı girilmemişse, harici yapay zeka servisi çökerse veya yanıt gecikirse sistem kesinlikle hata fırlatmamalıdır. Akıllı bir kural tabanlı (heuristic) anahtar kelime eşleyici devreye girerek güvenilir çıkarım üretmelidir.
3. **Human-in-the-Loop & Kesin İnsan Onayı:** AI hiçbir zaman doğrudan veritabanında görev durumunu değiştirmez. Her zaman bir `AgentProposal` üretir; yetkili kullanıcı `approveProposal` dediğinde değişiklik uygulanır.
4. **Eskime Koruması (Stale Proposal Guard):** Öneri oluşturulduktan sonra başka bir kullanıcı görevi taşımışsa veya görev zaten önerilen duruma gelmişse öneri geçersiz (`STALE`) sayılmalıdır.
5. **Denetim Ayrımı (`isAiGenerated: true`):** Kabul edilen öneriler `AI_SUGGESTION_APPLIED` tipi ve `isAiGenerated: true` bayrağı ile aktivite akışında `🤖` rozetiyle şeffafça işaretlenmelidir.

---

## 2. Alınan Mimari Kararlar (Decisions)

### A. Veritabanı Modelleri & Migration (`prisma/schema.prisma`)
Migration: `20260925194439_add_agent_proposal_model`
- **`enum ProposalStatus`:** `PENDING`, `APPROVED`, `REJECTED`, `STALE`
- **`model AgentProposal`:**
  - `taskId`, `projectId`, `progressResponseId`, `summary`, `suggestedStateId`, `suggestedGroup`, `blockerDetected`, `blockerDetails`, `followUpNeeded`, `confidence`, `status`, `reviewedById`, `reviewedAt`.
  - `Project`, `Task`, `ProgressResponse`, `State (suggestedState)` ve `User (reviewedBy)` ilişkileri.
- Veritabanı model sayısı **18'den 19'a**, enum sayısı **8'den 9'a** yükseldi.

### B. Sağlayıcıdan Bağımsız LLM Mimarisi (`src/lib/ai/`)
- `llm-types.ts`: `LlmProvider` arayüzü ve `complete(request)` sözleşmesi.
- `llm-config.ts`:
  - `resolveLlmConfig(env, fileConfig)`: Hiçbir dosya/süreç bağımlılığı olmayan saf yapılandırma motoru.
  - Yer tutucu (`<...>`, `CHANGE_ME`, `your-...`) değerleri otomatik olarak "yapılandırılmamış" kabul eder.
  - `none` şeması ile ham anahtar, boş anahtar ile şirket içi auth gerektirmeyen gateway desteği.
- `providers/index.ts` ve `providers/openai-compatible.ts`: Genel OpenAI uyumlu HTTP chat completion sağlayıcısı.
- `interpreter.ts`: Registry üzerinden çalışır; yapılandırma yoksa veya çağrı başarısız olursa anında `interpretProgressHeuristic` fonksiyonuna düşer (asla exception fırlatmaz).

### C. Saf Çıkarım & Heuristic Mantık (`src/lib/ai-proposal-logic.ts`)
- `ProgressInterpretationSchema`: Zod şeması ile katı tip doğrulama.
- `interpretProgressHeuristic`: Türkçe büyük/küçük harf duyarlı (`BİTTİ`, `TAMAMLANDI`, `kaldı`, `engel`, `bloke` vb.) akıllı anahtar kelime analizi.
- `matchSuggestedStateId`: Önerilen durum grubu mevcut duruma eşitse `null` döner; aksi halde projedeki uygun durumun id'sini eşler.
- `extractJsonObject`: Model JSON çıktısını markdown çitleri (````json ... ````) veya serbest açıklama metinleri arasına sarsa bile ilk `{` ve son `}` arasını güvenle ayıklar.
- `buildInterpretationPrompt`: Kullanıcı metnini `<progress_update>` etiketleri içine alarak prompt injection açıklarını önler.

### D. Onay Eylemleri (`src/actions/agent-proposal.ts`)
- `generateProposalForResponse`: Yanıt verildiği anda arka planda tetiklenir, `AgentProposal` kaydeder.
- `approveProposal`:
  - Yetki ve `PENDING` durumu denetlenir.
  - İsteğe bağlı `overrideStateId` desteğiyle kullanıcının AI önerisini düzenlemesine izin verir.
  - Görev durumu güncellenir, `sortOrder` float aritmetiğiyle hesaplanır.
  - `AI_SUGGESTION_APPLIED` (`isAiGenerated: true`) loglanır.
  - Görev `DONE` olduysa `triggerUnblockedDependencies` post-transaction olarak tetiklenir.
- `rejectProposal`: Öneri `REJECTED` yapılır, `AI_SUGGESTION_REJECTED` aktivitesi loglanır.

### E. Kullanıcı Arayüzü: AI Öneri Kartı (`AgentProposalCard`)
- [`src/components/task-detail/agent-proposal-card.tsx`](../../src/components/task-detail/agent-proposal-card.tsx) bileşeni:
  - İndigo/mor ışıltılı kurumsal kart, `Sparkles` ikonu ve güven skoru rozeti (`%92 Güven`).
  - Özet metin ve renkli durum hapları: `[Mevcut Durum] ➔ [Önerilen Durum]`.
  - Engel tespit edildiyse kehribar uyarı rozeti.
  - **[✅ Kabul Et ve Uygula]**, **[❌ Reddet]**, **[✏️ Farklı Durum Seç]** butonları.

---

## 3. Sonuçlar (Consequences)

### Olumlu Sonuçlar (Pros)
- **Phase 5 MVP Çekirdeği Tamamlandı:** Özlem'in işini bitirmesinden Uygar'ın bildirim almasına, ilerleme yanıtından AI analizine ve tek tıkla Kanban güncellemesine kadar olan uçtan uca akış eksiksiz çalışmaktadır.
- **Sıfır Dış Bağımlılık Riski:** API anahtarı olmadan yerel ortamda heuristic motorla tam fonksiyonel çalışır; üretimde istenen LLM gateway'ine saniyeler içinde bağlanabilir.
- **Yüksek Test Kalitesi:** 26 yeni test ile toplam test sayısı **514'e** ulaştı (%100 yeşil).

---

## 4. Doğrulama ve İmzalar
- `npm test`: **514 test, 26 suite, %100 başarılı**
- `npx tsc --noEmit`: **0 derleme hatası**
- Git Commit: `v0.5.4`
- Git Tag: `v0.5.4`

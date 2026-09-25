# ADR-028: AI Destekli Proaktif Proje Koordinasyon Mimarisi

**Durum:** Kabul Edildi  
**Tarih:** 2026-09-25  
**Faz:** Phase 5 (AI Coordination System — Faz 0: Mimari Kararlar)  
**Bağımlılıklar:** ADR-023 (Görev İlişkileri), ADR-025 (Bildirimler), ADR-026 (Bildirim Tercihleri), ADR-027 (E-posta Servisi)

---

## 1. Bağlam ve Problem

Pulse v0.4.4 itibariyle:
- 16 veritabanı modeli, 7 enum, 416 test
- Task relation sistemi (BLOCKS, RELATES_TO, DUPLICATES) ve döngü koruması (`wouldCreateBlockCycle`)
- In-App notification sistemi (5 tip, polling, tercihler, mention detection)
- E-posta servisi (Welcome, Invite)
- Activity audit trail (17 tip)

**Eksik olan:** Proje içindeki task, sprint ve dependency değişikliklerini proaktif biçimde takip eden, gerektiğinde ekip üyelerine ulaşan ve bir proje yöneticisinin rutin koordinasyon işlerini güvenli şekilde otomasyona dönüştüren bir AI coordination sistemi.

**Hedef:** Pulse'a "pasif chatbot" değil, "proaktif proje koordinatörü" eklemek.

---

## 2. Karar: Üç Katmanlı Otomasyon Mimarisi

Tüm otomasyon yetenekleri üç kesin katmana ayrılacaktır:

### Katman A — Deterministic Domain Automation (LLM gerektirmez)
Kesin iş kuralları ve event'lerle güvenilir biçimde çalışan işlemler:
- Task DONE olduğunda dependency graph kontrolü
- Blocker kalktığında dependent task sahibine notification
- Task atandığında bildirim
- Due date yaklaştığında hatırlatma
- Sprint lifecycle event'leri

**Kural:** Bu işlemler LangGraph veya LLM içine taşınmaz. Domain service, rule engine ve notification sistemi ile çözülür.

### Katman B — AI-Assisted Coordination (LLM gerektirir)
Doğal dil yorumlama veya bağlamsal değerlendirme gerektiren işlemler:
- Kullanıcıya progress sorusu hazırlama
- Serbest metin yanıtından structured update çıkarma
- Blocker tespiti
- Follow-up sorusu üretme
- Sprint risk özeti
- Status değişikliği önerme

**Kural:** AI çıktısı doğrudan database komutu olarak kabul edilmez. Structured schema, deterministik validation, authorization ve approval policy uygulanır.

### Katman C — Human Decision Required
Yüksek etkili veya belirsiz işlemler varsayılan olarak insan onayına bağlıdır:
- Task status'unu DONE yapma
- Sprint scope değiştirme
- Assignee / due date değiştirme
- Sprint başlatma / tamamlama
- Toplu task değişikliği
- Düşük confidence AI önerileri

---

## 3. Mimari Kararlar

### Karar 3.1 — Domain Event Stratejisi

**Seçenekler:**
1. Ayrı DomainEvent tablosu + Outbox Pattern
2. Mevcut `logActivity` fonksiyonuna inline post-commit hook
3. Transaction sonrası senkron fonksiyon çağrısı

**Karar:** Seçenek 3 — Senkron post-transaction hook.

**Gerekçe:**
- `logActivity` zaten transaction içinde çalışıyor ve try/catch ile sarmalı (non-blocking).
- MVP'de asenkron event queue gerektiren bir throughput yok.
- `updateTask` transaction bloğunun hemen ardına `onTaskCompleted(taskId, projectId, newStateGroup)` fonksiyonu eklenir.
- Gelecekte (Faz 5-6) throughput artarsa outbox pattern'e evrilebilir.

**Etkilenen Dosya:** `src/actions/task.ts` — `updateTask()` fonksiyonu, satır ~192-199 arası state değişikliği sonrası.

### Karar 3.2 — AI Execution Identity

**Seçenekler:**
1. Bot User (ayrı User kaydı)
2. `isAiGenerated` Boolean flag Activity'de
3. Her ikisi birlikte

**Karar:** Seçenek 3 — Bot User + `isAiGenerated` flag.

**Gerekçe:**
- Bot User (`pulse-ai-bot`): Sabit `actorId` sağlar. Giriş yapamaz (boş hash). Proje üyeliği ile yetkilendirilir.
- `isAiGenerated` flag: Activity timeline'da 🤖 rozeti göstermek için.
- İkisi birlikte kullanılır çünkü bazı AI işlemlerinde actorId kullanıcı olabilir (kullanıcı AI'ı tetikledi ama AI önerisi apply edildi).

**Güvenlik:** AI bot'a global admin verilmez. Effective permission = tetikleyen kullanıcının yetkileri ∩ Agent tool allowlist.

### Karar 3.3 — Autonomy Levels (Özerklik Seviyeleri)

| Seviye | Açıklama | MVP Kapsamı |
|---|---|---|
| **Level 0: Observe** | Yalnızca analiz ve gözlem | — |
| **Level 1: Notify** | Güvenli bildirimleri otomatik gönder, data değiştirme | TASK_UNBLOCKED, PROGRESS_REQUESTED |
| **Level 2: Propose** | Değişiklik öner, kullanıcı onayı bekle | AI progress interpretation → status change proposal |
| **Level 3: Auto-Apply** | Düşük riskli değişiklik, auth+validation sonrası otomatik | MVP'de yok, gelecekte yapılandırılabilir |

**MVP Varsayılan Politika:**
- Deterministic notification → Level 1
- AI yorumlu project update → Level 2
- Destructive / high-impact → Human approval zorunlu
- Global role, project deletion → AI tarafından uygulanamaz

### Karar 3.4 — Notification Channel Abstraction

**Karar:** İlk sürümde yalnızca In-App Notification. Ancak notification oluşturma mantığı, channel-specific delivery'den ayrılır.

```
NotificationIntent (domain logic) → NotificationDelivery (channel adapter)
                                      ├── InApp (mevcut createNotification)
                                      └── Email (Faz 8'de eklenir)
```

**Kural:** İlk sürümde gereksiz abstraction oluşturulmaz. Ancak notification içeriği domain event'ten ayrılır ve gelecekte email renderer eklenmesini engelleyecek sıkı bağımlılık kurulmaz.

### Karar 3.5 — Teknoloji Giriş Zamanlaması

| Teknoloji | Giriş Fazı | Gerekçe |
|---|---|---|
| **LLM API (OpenAI/Anthropic)** | Faz 4 | İlk AI kullanımı: progress response interpretation |
| **LangGraph.js** | Faz 5 | Multi-turn coordination: interrupt + resume |
| **LlamaIndex.TS** | Faz 7 | RAG: proje bağlamı arama (ihtiyaç oluştuğunda) |
| **pgvector** | Faz 7 | Vektör araması (LlamaIndex ile birlikte) |
| **Zod** | Faz 4 | Structured output validation (zaten mevcut, genişletilir) |

**Kritik Kural:** Faz 1-3'te hiçbir AI kütüphanesi projeye eklenmez. npm install yapılmaz.

### Karar 3.6 — Background Job Stratejisi

**MVP'de:** Background job / scheduler kullanılmaz. Tüm otomasyon senkron post-transaction hook ile tetiklenir.

**Faz 6'da değerlendirilecek seçenekler:**
1. Next.js Cron (Vercel deployment)
2. Node-cron / setInterval (self-hosted)
3. BullMQ + Redis (kompleks kuyruk)

Karar Faz 6'ya ertelenmiştir çünkü deployment ortamı (Vercel vs self-hosted Docker) henüz kesinleşmemiştir.

---

## 4. Faz Planı Özeti

| Faz | İçerik | AI | LangGraph | LlamaIndex | MVP |
|:---:|---|:---:|:---:|:---:|:---:|
| 0 | Mimari ADR'ler (bu doküman) | ❌ | ❌ | ❌ | ✅ |
| 1 | Domain event temeli, enum genişletme | ❌ | ❌ | ❌ | ✅ |
| 2 | TASK_UNBLOCKED dependency automation | ❌ | ❌ | ❌ | ✅ |
| 3 | ProgressRequest / ProgressResponse lifecycle | ❌ | ❌ | ❌ | ✅ |
| 4 | AI progress interpretation, AgentProposal, onay UI | ✅ | ❌ | ❌ | ✅ |
| 5 | LangGraph multi-turn coordination | ✅ | ✅ | ❌ | ❌ |
| 6 | Scheduler, proaktif follow-up | Kısmen | ❌ | ❌ | ❌ |
| 7 | RAG, pgvector, proje bağlamı | ✅ | ❌ | ✅ | ❌ |
| 8 | Email channel entegrasyonu | ❌ | ❌ | ❌ | ❌ |
| 9 | Sprint Risk Agent | ✅ | ✅ | ✅ | ❌ |
| 10 | Multi-agent orchestration | ✅ | ✅ | ✅ | ❌ |

---

## 5. Referans Use Case: Özlem-Uygar Dependency Senaryosu

```
Özlem: "Debug sürecini tamamla" (Task A) → BLOCKS → Uygar: "Dashboard geliştir" (Task B)

1. Özlem Task A'yı DONE yapıyor.
2. updateTask() state değişikliğini commit ediyor.
3. Post-transaction hook: yeni state DONE grubunda → onTaskCompleted(A) tetikleniyor.
4. TaskRelation tablosunda A'nın BLOCKS ettiği task'lar aranıyor → Task B bulunuyor.
5. Task B'nin başka aktif blocker'ı var mı? Tüm BLOCKS kaynakları kontrol ediliyor.
6. Başka aktif blocker yok → Task B "unblocked" olarak tespit ediliyor.
7. Task B'nin assignee'si Uygar → TASK_UNBLOCKED In-App Notification oluşturuluyor.
8. Activity kaydı yazılıyor.
9. Uygar notification'dan Task B'ye navigasyon yapıyor.
10. (Faz 3+) Sistem Uygar'dan progress update isteyebiliyor.
11. (Faz 4+) Uygar'ın doğal dil yanıtı AI ile structured update'e dönüşüyor.
```

---

## 6. Schema Değişiklik Takvimi

| Faz | Schema Değişikliği |
|---|---|
| Faz 1 | `NotificationType` → +TASK_UNBLOCKED, +PROGRESS_REQUESTED |
| Faz 1 | `ActivityType` → +TASK_COMPLETED, +TASK_UNBLOCKED, +PROGRESS_REQUESTED, +PROGRESS_RESPONDED, +AI_SUGGESTION_APPLIED, +AI_SUGGESTION_REJECTED |
| Faz 1 | `Activity` → +isAiGenerated Boolean |
| Faz 3 | +ProgressRequest modeli, +ProgressResponse modeli |
| Faz 4 | +AgentProposal modeli |

Her faz kendi migration'ını oluşturur. Tek büyük migration yapılmaz.

---

## 7. Kapsam Dışı (MVP)

- Email entegrasyonu
- Full RAG pipeline / LlamaIndex / pgvector
- Multi-agent orchestration
- Tam otonom sprint planning
- Otomatik assignee / due date değiştirme
- İnsan performansı puanlama
- Onaysız kalıcı Kanban güncellemesi
- AI tarafından global authorization değişikliği

---

## 8. Doğrulama Kuralı

Her faz tamamlandığında:
```bash
npm test          # Tüm testler geçmeli (mevcut 416 + yeni testler)
npx tsc --noEmit  # Sıfır TypeScript hatası
```

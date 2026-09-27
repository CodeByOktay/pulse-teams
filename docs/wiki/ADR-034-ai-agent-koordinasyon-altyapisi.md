# ADR-034: AI Agent Koordinasyon Altyapısı ve Proaktif Agent Sistemi

- **Durum:** Kabul Edildi (Accepted)
- **Tarih:** 2026-09-27
- **Karar Vericiler:** Antigravity (Lead Architect & QA Authority), Claude Code (Builder)
- **Sürüm:** v0.6.0 (Phase 6 — AI Agent Coordination System)
- **İlgili ADR:** [ADR-028-AI Destekli Proaktif Proje Koordinasyon Mimarisi](./ADR-028-ai-destekli-proaktif-proje-koordinasyonu.md), [ADR-029-Domain Event Temeli ve Aktivite Genişletmesi](./ADR-029-domain-event-temeli-ve-aktivite-genisletmesi.md), [ADR-032-AI Destekli İlerleme Yorumlama ve Onaylı Güncelleme Mimarisi](./ADR-032-ai-destekli-ilerleme-yorumlama-ve-onayli-guncelleme.md)

---

## 1. Bağlam ve Problem Tanımı (Context)

Pulse v0.5.4 itibariyle:
- 19 veritabanı modeli, 9 enum, 528 test (100% geçiyor)
- Üç katmanlı otomasyon mimarisi (ADR-028): Tier A (deterministic), Tier B (AI-assisted), Tier C (human decision)
- Senkron post-transaction hook ile domain event tetikleme
- `ProgressRequest/Response` lifecycle + `AgentProposal` onay akışı
- Provider-agnostic LLM engine (`ai/llm-config.ts` + `ai/providers/openai-compatible.ts`)
- `pulse-ai-bot` identity (`Activity.isAiGenerated`)

**Eksik olan:** Projenin rutin koordinasyon işlerini — deadline takibi, görev hijyeni, durum isteme, engel yönetimi, standup, haftalık rapor — zamanlayıcı ile proaktif biçimde yürüten, LangGraph ile stateful çalışan ve her agent'ın proje başına açılıp kapatılabildiği bir agent sistemi.

**Hedef:** ADR-028'de tanımlanan "proaktif proje koordinatörü" vizyonunu somut bir agent kataloğu, Python container mimarisi ve step-by-step yol haritası ile hayata geçirmek.

---

## 2. Alınan Mimari Kararlar (Decisions)

### A. Runtime: Python LangGraph Docker Container

**Seçenekler:**
1. LangGraph.js — TypeScript, Next.js içinden doğrudan import
2. Python LangGraph — Docker container, API üzerinden iletişim

**Karar:** Seçenek 2 — Python LangGraph.

**Gerekçe:**
- LangGraph'ın Python ekosistemi daha olgun (checkpointer, interrupt/resume, multi-turn desteği).
- Agent iş mantığı Next.js request lifecycle'ına bağlanmaz; bağımsız zamanlayıcı ile çalışır.
- Python container `pulse-agent` olarak docker-compose'a eklenir: `pulse-db` + `pulse-app` + `pulse-agent`.
- PostgreSQL checkpointer ile LangGraph state persistence sağlanır.

**Etkilenen Dosyalar:** `docker-compose.yml`, `agent/Dockerfile`, `agent/requirements.txt`

### B. İletişim Protokolü: DomainEvent Outbox + Internal API

**Seçenekler:**
1. Mevcut senkron post-transaction hook genişletilir
2. DomainEvent outbox tablosu (Next.js yazar, Python okur) + Internal API (Python → Next.js)
3. Message broker (RabbitMQ/Redis Pub-Sub)

**Karar:** Seçenek 2 — DomainEvent Outbox + HMAC-korumalı Internal API.

**Gerekçe:**
- Outbox: Next.js action transaction'ı içinde `DomainEvent` satırı yazar. Python `SELECT ... FOR UPDATE SKIP LOCKED` ile okur. Ek altyapı (message broker) gerektirmez.
- Internal API: Python → Next.js yönünde. Bildirim gönderme ve ProgressRequest açma mevcut TS iş mantığından geçer (authz + logActivity korunur).
- Docker network izolasyonu + HMAC shared secret ile korunur.
- **Kritik kural:** Python doğrudan mutasyon yapmaz. Tüm veri değişiklikleri onay sonrası Next.js Server Action'larıyla yapılır. Python'un yazma yetkisi yalnızca: DomainEvent durum güncelleme, AgentRun kaydı ve AgentProposal oluşturma.

**Etkilenen Dosyalar:** `src/lib/domain-events.ts`, `src/app/api/internal/agent/`, `agent/src/poller.py`, `agent/src/internal_client.py`

### C. Zamanlayıcı: APScheduler (Python Container İçinde)

**Seçenekler:**
1. Next.js Cron (Vercel deployment)
2. Node-cron / setInterval (self-hosted)
3. APScheduler (Python container içinde)

**Karar:** Seçenek 3 — APScheduler.

**Gerekçe:**
- Agent iş mantığı zaten Python container'da; zamanlayıcı aynı process'te kalır.
- Cron tabanlı zamanlamalar: günlük (09:00), haftalık (Cuma 17:00).
- Event-bazlı tetikleme DomainEvent outbox poller ile sağlanır.
- ADR-028'de "Faz 6'ya ertelenmiş" olan scheduler kararı bu seçenekle çözülür.

### D. Telafi Mantığı (Catch-up on Startup)

**Karar:** Container başlangıcında `AgentRun` tablosundan her `(agentKey, projectId)` çifti için son `scheduledFor` kontrol edilir. Kaçırılan zamanlar tek seferlik çalıştırılır.

**Kısıtlar:**
- `@@unique([agentKey, projectId, scheduledFor])` kısıtı aynı işin iki kez çalışmasını engeller.
- Birden fazla gün kaçırıldıysa yalnızca en son kaçırılan zaman telafi edilir (N gün değil).
- Telafi sırası: Agent-002 (hijyen) → Agent-001 (deadline) → Agent-003 (durum) — temiz veri önceliği.

### E. Clock Abstraction (Test Edilebilir Saat)

**Karar:** Hem TypeScript hem Python tarafında `getNow(): Date` fonksiyonu. Test'te override edilebilir.

**Gerekçe:**
- "3 gündür hareketsiz" kuralını test etmek için 3 gün beklenemez.
- Saat dilimi uyumu: Her iki container'da `TZ=Europe/Istanbul` ayarlanır.
- Mevcut `getApproachingDueTasks(tasks, now)` zaten `now` parametresi alıyor — bu pattern genişletilir.

**Etkilenen Dosyalar:** `src/lib/clock.ts`, `agent/src/clock.py`

### F. Eskalasyon Hedefi ve Agent Kimliği

**Karar:**
- Eskalasyon hedefi: `ProjectMember.role === 'ADMIN'` olan tüm üyeler.
- Agent mesaj formatı: `"[PM adı] adına Pulse Asistan"` — yöneticinin yardımcısı hissi.
- PM kullanıcısı: `AgentSettings.pmUserId` — proje ayarlarında ADMIN'ler arasından seçilir. Varsayılan: proje owner'ı.

### G. Agent Kataloğu (10 Agent — Faz 6 Tam Kapsam)

| Agent | Görev | LLM | Tier | Phase |
|---|---|---|---|---|
| Agent-000 | Supervisor: tetikleyici yönlendirme, mesaj limiti, tekrar engeli, loglama | ❌ | — | 6 |
| Agent-001 | Deadline Takipçisi: yaklaşan/gecikmiş deadline hatırlatma + ADMIN eskalasyon | ❌ | A | 6 |
| Agent-002 | Görev Hijyeni: eksik sahip/deadline/açıklama tespiti + tamamlama isteği | ❌ | A | 6 |
| Agent-003 | Durum İsteyici: N gün hareketsiz → buton seçenekli istek, interrupt/resume | ❌ | A | 6 |
| Agent-004 | Engel Yöneticisi: blok zinciri takibi + eskalasyon | ❌ | A | 6 |
| Agent-005 | Asenkron Standup: sabah formu + LLM özet | ✅ | B | 6 |
| Agent-006 | Haftalık Rapor: sprint sağlığı + ekip özeti | ✅ | B | 6 |
| Agent-007 | İş Yükü Dengeleyici: aşırı/boş tespit + yeniden atama önerisi | ✅ | B | 6 |
| Agent-008 | Sprint Asistanı: taşma uyarısı + retro taslağı | ✅ | B | 6 |
| Agent-009 | Kapsam Kayması Tespiti: sprint ortası eklenen iş tespiti | ❌ | A | 6 |

**Kritik mimari karar:** 10 agent'lık kataloğun **tamamı Faz 6 (AI Agent Koordinasyon Sistemi)** kapsamındadır.
- **Deterministik Koruyucular (Tier A — Agent 000, 001, 002, 003, 004, 009):** Sıfır LLM token maliyetiyle kural ve olay bazlı (DomainEvent & APScheduler) koruma ve eskalasyon sağlar.
- **LLM Destekli Koordinatörler (Tier B — Agent 005, 006, 007, 008):** LangGraph stateful akışları ile LLM sentezini birleştirir; insan onaylı `AgentProposal` ve özet bültenleri üretir.
- **Proje Hafızası (RAG & Semantik Arama):** Görevler, yorumlar ve dokümanlar üzerinde pgvector destekli semantik arama Faz 6 Step 6.07 adımında entegre edilir.

### H. Mevcut `checkApproachingDueDates` Geçişi

**Karar:** Mevcut oturuma bağlı action kaldırılır. Yerine oturumdan bağımsız `dispatchDueDateReminders(projectId, now)` lib fonksiyonu yazılır. Python Internal API üzerinden çağırır.

**Gerekçe:** Mevcut fonksiyon hiçbir yerden çağrılmıyor ve oturuma bağlı (sadece çağıran kullanıcıya bildirim yazıyor). Agent-001 bunu zamanlayıcı ile oturumdan bağımsız hale getirir.

**Korunan bileşenler:** `getApproachingDueTasks`, `shouldDeliverWithPreferences`, `formatDueDateNotificationSnippet` ve testleri korunur.

### I. Test Sahipliği

**Karar:**
- TypeScript testleri (`src/lib/__tests__/`): Antigravity yazar, Claude dokunmaz (mevcut kural korunur).
- Python testleri (`agent/tests/`): Antigravity yazar (pytest), Claude dokunmaz.
- Claude her iki tarafta da testleri çalıştırır ve kodunu testlere göre düzeltir.

---

## 3. Veritabanı Schema Değişiklikleri

### 3.1 DomainEvent (Outbox Tablosu)

```prisma
model DomainEvent {
  id          String   @id @default(cuid())
  type        String   // "TASK_STATE_CHANGED", "TASK_SPRINT_ADDED", vb.
  payload     Json     // { taskId, projectId, oldValue, newValue, actorId }
  status      String   @default("PENDING") // PENDING | PROCESSING | DONE | FAILED
  processedAt DateTime?
  createdAt   DateTime @default(now())

  @@index([status, createdAt])
}
```

### 3.2 AgentRun (Çalışma Geçmişi)

```prisma
model AgentRun {
  id           String   @id @default(cuid())
  agentKey     String   // "agent-001", "agent-002", vb.
  projectId    String
  status       String   @default("RUNNING") // RUNNING | SUCCESS | FAILED | SKIPPED
  scheduledFor DateTime
  startedAt    DateTime @default(now())
  completedAt  DateTime?
  result       Json?    // { notificationsSent: 3, tasksFound: 5 }
  error        String?
  tokenCount   Int      @default(0)
  createdAt    DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([agentKey, projectId, scheduledFor])
  @@index([projectId])
  @@index([agentKey, status])
}
```

### 3.3 AgentSettings (Proje Başına Agent Ayarları)

```prisma
model AgentSettings {
  id        String   @id @default(cuid())
  projectId String
  agentKey  String   // "agent-001", "agent-002", vb.
  enabled   Boolean  @default(true)
  config    Json     @default("{}")
  pmUserId  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pmUser   User?   @relation(fields: [pmUserId], references: [id], onDelete: SetNull)

  @@unique([projectId, agentKey])
}
```

**Model sayısı:** 19 → 22 (DomainEvent, AgentRun, AgentSettings)

---

## 4. Yol Haritası (Faz 6 Adımları)

| Step | Versiyon | İçerik | Durum / Test |
|---|---|---|---|
| 6.00 | v0.6.0-pre | Mimari kararlar ve ADR-034 tasarımı | Tamamlandı |
| 6.01 | v0.6.0 | Altyapı: Schema, DomainEvent, Clock, Python container (`pulse-agent`), Supervisor (Agent-000), Internal API, AgentSettings UI | Tamamlandı (574 test) |
| 6.02 | v0.6.1 | Agent-001 (Deadline Takipçisi) + "Agent Activity" dashboard paneli | Tamamlandı (587 test) |
| 6.03 | v0.6.2 | Agent-002 (Görev Hijyeni) + Agent-003 (Durum İsteyici, LangGraph interrupt/resume, eskalasyon) | Tamamlandı (653 test) |
| 6.04 | v0.6.3 | Agent-004 (Engel Yöneticisi) + Agent-009 (Kapsam Kayması Tespiti) — Olay Güdümlü Koruyucular (Tier A) | Sırada |
| 6.05 | v0.6.4 | Agent-005 (Asenkron Standup) + Agent-006 (Haftalık Sprint Özeti) — LLM Destekli İletişim ve Raporlama (Tier B) | Planlandı |
| 6.06 | v0.6.5 | Agent-007 (İş Yükü Dengeleyici) + Agent-008 (Sprint Asistanı) — LLM Destekli Proaktif Optimizasyon & Karar Destek (`AgentProposal`) | Planlandı |
| 6.07 | v0.6.6 | Proje Hafızası, RAG & Semantik Arama: Görevler, Dokümanlar ve Sprintler Üzerinde pgvector Bilgi Sorgulama | Planlandı |
| 6.08 | v0.6.7 | Faz 6 Konsolidasyon, E2E Multi-Agent Koordinasyon Doğrulaması ve Hardening | Planlandı |

---

## 5. Dizin Yapısı

```
Pulse/
├── agent/                      # Python container (pulse-agent)
│   ├── Dockerfile
│   ├── requirements.txt        # langgraph, psycopg, apscheduler, httpx
│   ├── pyproject.toml
│   ├── src/
│   │   ├── supervisor.py       # Agent-000
│   │   ├── agents/
│   │   │   ├── agent_001.py    # Deadline Takipçisi
│   │   │   ├── agent_002.py    # Görev Hijyeni
│   │   │   └── agent_003.py    # Durum İsteyici
│   │   ├── poller.py           # DomainEvent SKIP LOCKED
│   │   ├── scheduler.py        # APScheduler config
│   │   ├── catchup.py          # Startup catch-up
│   │   ├── internal_client.py  # Next.js Internal API client
│   │   ├── clock.py            # Testable clock
│   │   └── db.py               # Postgres connection (kısıtlı rol)
│   └── tests/                  # pytest (Antigravity yazar)
├── src/
│   ├── lib/
│   │   ├── clock.ts            # TS Clock abstraction
│   │   ├── domain-events.ts    # emitDomainEvent(tx, type, payload)
│   │   └── ...
│   └── app/
│       └── api/
│           └── internal/
│               └── agent/      # HMAC-protected internal endpoints
└── docker-compose.yml          # pulse-db + pulse-app + pulse-agent
```

---

## 6. Referans Senaryolar

### Senaryo 1: Agent-003 Interrupt/Resume

```
1. APScheduler 09:00 → Agent-003 tetiklenir.
2. Supervisor: AgentSettings kontrolü (enabled? pmUserId?).
3. Python: Son 3 gündür state değişikliği olmayan görevleri sorgular.
4. Her görev sahibine bildirim: "[PM adı] adına Pulse Asistan: 'API refactoring'
   görevi 3 gündür güncellenmedi. Durumu nedir?"
   [İlerliyor ▶] [Engel var 🚫] [Bitti ✅]
5. LangGraph graph interrupt() ile durur, checkpointer state'i Postgres'e yazar.
6. Kullanıcı "Engel var"a tıklar → Next.js Internal API → Python graph resume.
7. Graph: "Engel var" → ProgressRequest oluştur + ADMIN'e eskalasyon.
8. Cevapsızlık: 2 gün sonra otomatik ADMIN eskalasyonu.
```

### Senaryo 2: Telafi (Catch-up)

```
1. Container 14:00'te restart.
2. Supervisor: AgentRun tablosundan last scheduledFor kontrol.
3. Agent-001 bugün 09:00 kaçırılmış → telafi çalışması.
4. @@unique kısıtı tekrarı engeller.
```

---

## 7. Kapsam Dışı (Faz 6 Sınırları)

- **Onaysız Yıkıcı İşlemler (Level 3 Otonomi):** AI hiçbir koşulda veritabanında doğrudan görev/sprint silme veya insan onayı olmaksızın atama değiştirme yapamaz. Değişiklikler mutlaka Level 2 (`AgentProposal`) onay kapısından geçmelidir.
- **Harici Kimlik Sağlayıcılar (OAuth/SSO):** NextAuth CredentialsProvider tek ve yegane kimlik sağlayıcıdır.
- **Serbest Sohbet / Chatbot Arayüzü:** Pulse bir chat uygulaması değildir; agent etkileşimleri görev kartları, popover'lar, bültenler ve bildirimler üzerinden yapılandırılmıştır.
- **Çoklu Organizasyon (Multi-Tenant SaaS) / Dış Sistem Entegrasyonları (Jira/GitHub sync):** Faz 6 sonrası vizyona aittir.

---

## 8. Doğrulama Kuralı

Her step tamamlandığında:

```bash
npm test          # Tüm Vitest testleri geçmeli
npx tsc --noEmit  # Sıfır TypeScript hatası
cd agent && pytest # Tüm pytest testleri geçmeli
```

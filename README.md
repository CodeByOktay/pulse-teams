# Pulse

> Proaktif yapay zekâ koordinasyonuna sahip, modern ve yüksek performanslı Kanban & Sprint yönetim platformu.

[![CI](https://github.com/CodeByOktay/Pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/CodeByOktay/Pulse/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-v0.6.7-blue.svg)](https://github.com/CodeByOktay/Pulse)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?logo=postgresql)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B%20%C2%B7%20LangGraph-3776AB?logo=python)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/tests-740%20Vitest%20%2B%2098%20Pytest-success?logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Genel Bakış

Pulse, çevik yazılım ekipleri için tasarlanmış, geliştirici odaklı ve tam özellikli bir proje yönetim platformudur. Next.js 16 ve PostgreSQL üzerine kuruludur; akıcı sürükle-bırak iş akışları, iyimser (optimistic) arayüz güncellemeleri ve deterministik iş mantığı sunar.

Klasik proje takibinin ötesinde Pulse, **Proaktif Yapay Zekâ Koordinasyonu** getirir: çözülen görev bağımlılıklarını tespit eden, ekip üyelerinden ilerleme raporu toplayan, doğal dille yazılmış durum güncellemelerini yorumlayan ve Kanban/Sprint değişikliklerini insan onayına sunan, üç katmanlı ve onay kapılı bir otomasyon sistemi. Ayrı bir Python **LangGraph** servisi, PostgreSQL olay kutusu (outbox) ile tetiklenen on koordinasyon ajanından oluşan bir kataloğu çalıştırır (son tarihler, görev hijyeni, engeller, standup'lar, haftalık özetler, iş yükü dengeleme, sprint asistanlığı).

---

## Özellikler

- **Etkileşimli Kanban Panosu:** `@dnd-kit` ile sütun içi ve sütunlar arası akıcı sürükle-bırak, sunucu hatasında otomatik geri alınan iyimser arayüz güncellemeleri ve $O(1)$ float tabanlı orta nokta sıralaması (`sortOrder`).
- **Sprint & Döngü Yaşam Döngüsü:** Taslak $\rightarrow$ Aktif $\rightarrow$ Tamamlandı geçişleri, çift tamamlama yarışlarına karşı atomik eşzamanlılık korumaları ve proje başına tek aktif sprint kısıtı.
- **Alternatif Görünümler:** Daraltılabilir ve sıralanabilir tablo biçiminde Liste Görünümü ile tamamlanmış sprint geçmişini koruyan ayrı bir Backlog Görünümü.
- **Yandan Açılan Görev Paneli:** Satır içi markdown düzenleme, deterministik avatar rengi üretimi ve doğrudan bağlantı verilebilen URL'ler (`?task=`) içeren 720px genişliğinde detay çekmecesi.
- **Görev Bağımlılıkları & Döngü Önleme:** Tek yönlü bağımlılık grafiği (`BLOCKS`, `RELATES_TO`, `DUPLICATES`) ve sonsuz döngüleri engelleyen yinelemeli (iterative) DFS döngü tespiti.
- **Global Arama & Komut Paleti:** Üye olunan projeler genelinde döngüsel klavye gezinmesi ve bağlama duyarlı hızlı aksiyonlar sunan `Ctrl+K` / `Cmd+K` paleti.
- **Dashboard Analitiği:** Harici grafik kütüphanesi kullanmadan, yalnızca CSS ile sprint hız çubukları, tamamlanma oranı hesapları, gecikmiş görev uyarıları ve son aktivite akışı.
- **Uygulama İçi & E-posta Bildirimleri:** Sekme görünürlüğüne duyarlı 30 saniyelik bildirim yoklaması, `@mention` ayrıştırma, takvim günü bazlı son tarih uyarıları (0, 1, 3 gün) ve davet/hoş geldin e-postaları için engellemeyen Nodemailer gönderimi.
- **Proaktif Yapay Zekâ Koordinasyonu:**
  - Engel çözüldüğünde otomatik `TASK_UNBLOCKED` domain event bildirimleri.
  - Etkileşimli `ProgressRequest` / `ProgressResponse` yaşam döngüsü.
  - Doğal dildeki durum bilgisinden yapılandırılmış `AgentProposal` adayları üretme.
  - Denetim izi kaydı (`isAiGenerated`) tutan, insan onaylı arayüz (`AgentProposalCard`).
- **Çok Ajanlı Koordinasyon Servisi (Python + LangGraph):**
  - `FOR UPDATE SKIP LOCKED` kiralamalarıyla tüketilen `DomainEvent` kutusu; başlangıçta kaçan çalışmaları telafi eden APScheduler cron'u.
  - Agent-000 Supervisor (yönlendirme, proje bazında etkinleştirme, idempotent `AgentRun` kaydı) ve 001–009 arası ajanlar: Deadline Tracker, Task Hygiene, Status Requester (LangGraph `interrupt()`/resume), Blocker Manager, Async Standup, Weekly Digest, Workload Balancer, Sprint Assistant, Scope Creep Detection.
  - Ajan servisi ile Next.js arasında HMAC-SHA256 imzalı Internal API.
  - Simüle zaman yolculuğu için Slot Replay destekli, test edilebilir saat soyutlaması (yalnızca geliştirme ortamında).
- **Proje Hafızası & Semantik Arama:** SHA-256 içerik özetlemeli `pgvector` gömmeleri (embedding) ve hibrit vektör/metin sıralaması; gömme sağlayıcısı tanımlı değilse metin aramasına düşer.
- **Proje Ayarları & RBAC:** Yönetici denetimindeki durum (state) hatları, renk kodlu özel etiketler ve rol tabanlı proje üyesi erişim kontrolü.

---

## Ekran Görüntüleri

Seed edilmiş demo veri setinden alınmıştır (`npm run db:seed-rich`).

| Kanban Panosu | Görev Detay Paneli |
| :---: | :---: |
| ![Filtre çipleri ve kayıtlı görünümlerle Kanban panosu](docs/screenshots/board.png) | ![Markdown editörü, ilişkiler ve aktivite içeren görev detay paneli](docs/screenshots/task-detail.png) |

| Dashboard | Sprint Yönetimi |
| :---: | :---: |
| ![İstatistik kartları, atanan görevler ve son aktivitelerle dashboard](docs/screenshots/dashboard.png) | ![Aktif, taslak ve tamamlanmış sprintlerin listesi](docs/screenshots/sprints.png) |

| Liste Görünümü | Komut Paleti (Ctrl+K) |
| :---: | :---: |
| ![Duruma göre gruplanmış, sıralanabilir liste görünümü](docs/screenshots/list.png) | ![Görevleri ve hızlı aksiyonları arayan komut paleti](docs/screenshots/command-palette.png) |

> **Dil notu:** Uygulama arayüzü, bu README, `docs/wiki/` altındaki ADR'ler, `docs/spec/` altındaki spesifikasyonlar ve bazı kod yorumları Türkçedir. Kod içindeki isimlendirmeler ve commit geçmişi İngilizcedir.

---

## Mimari

Pulse, uygulama katmanları arasında sıkı bir sorumluluk ayrımı uygular:

```
[ Next.js 16 App Router (RSC + Client Components) ]
                      │
                      ▼
[ Centralized Authorization Guard (src/lib/authz.ts) ]
                      │
                      ▼
[ Server Actions Layer (src/actions/) - "use server" ]
       │                                     │
       ▼                                     ▼
[ Pure Domain Logic (src/lib/) ]   [ Prisma ORM Transactions ]
(Cycle checks, analytics, filters)           │
                                             ▼
                              [ PostgreSQL 16 + pgvector ]
                                  │ DomainEvent outbox ▲
                                  ▼                    │ HMAC-signed
[ pulse-agent: Python + LangGraph + APScheduler ] ─────┘ Internal API
  (Agent-000 Supervisor → Agents 001–009)           (/api/internal/agent/*)
```

### Mimari İlkeler
- **Saf İş Mantığı İzolasyonu:** Tüm algoritmik işlemler (döngü tespiti, burndown hesabı, filtre derleme, seed üreteçleri) `src/lib/` altındaki saf fonksiyonlarda bulunur.
- **Merkezi Yetkilendirme:** Her Server Action, üyelik ve rol doğrulamasını `src/lib/authz.ts` modülüne devreder.
- **Atomik Eşzamanlılık:** Yarış durumuna açık mutasyonlar (ör. `completeSprint`) atomik Prisma `updateMany` korumaları kullanır.
- **Engellemeyen Yan Etkiler:** Aktivite kaydı ile bildirim/e-posta gönderimleri kendi hata yakalayıcılarında izole edilir; böylece ana transaction geri alınmaz.

---

## Teknoloji Yığını

| Katman | Teknoloji | Amaç |
|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | Server Components, Server Actions, SSR |
| **Dil** | TypeScript 5 (Strict Mode) | Uçtan uca tip güvenliği |
| **Stil** | Tailwind CSS v4, Lucide React | Modern, koyu/açık temalı duyarlı arayüz |
| **Sürükle-Bırak** | @dnd-kit (core, sortable, utilities) | Erişilebilir, 60fps sürükle-bırak etkileşimleri |
| **Veritabanı & ORM** | PostgreSQL 16 + pgvector, Prisma v6.19 | İlişkisel veritabanı, vektör arama, tipli migration'lar |
| **Ajan Servisi** | Python 3.11+, LangGraph, APScheduler, psycopg 3 | Olay tabanlı ve zamanlanmış koordinasyon ajanları |
| **Kimlik Doğrulama** | NextAuth.js v4 + bcryptjs (salt:12) | E-posta/şifre tabanlı JWT kimlik doğrulama |
| **Markdown** | react-markdown + remark-gfm | GitHub tarzı markdown ayrıştırma ve görüntüleme |
| **E-posta Servisi** | Nodemailer | SMTP, Ethereal test ve konsol çıktısı destekli posta motoru |
| **Test** | Vitest v5, Pytest | TypeScript ve Python birim/entegrasyon testleri |

---

## Proje Yapısı

```
Pulse/
├── agent/                       # Python LangGraph ajan servisi (pulse-agent)
│   ├── src/                     # Supervisor, poller, scheduler, Agent 001–009
│   └── tests/                   # 17 Pytest paketi (98 test)
├── prisma/
│   ├── schema.prisma            # 26 Pulse modeli (+4 LangGraph checkpoint tablosu) ve 9 enum
│   ├── migrations/              # Artımlı SQL migration geçmişi
│   └── seed-realistic-data.ts   # Deterministik PRNG seed betiği
├── src/
│   ├── actions/                 # Yetkilendirme korumalı Server Action'lar
│   ├── app/                     # Next.js App Router sayfaları ve API route'ları
│   ├── components/              # Modüler React 19 arayüz bileşenleri
│   │   ├── board/               # Kanban panosu ve sürükle-bırak sütunları
│   │   ├── dashboard/           # Analitik kartları, aktivite akışları, metrikler
│   │   ├── filters/             # Filtre çubukları, hızlı çipler, kayıtlı görünümler
│   │   ├── search/              # Komut paleti (Ctrl+K)
│   │   ├── settings/            # Durum, etiket ve üye yönetimi
│   │   ├── sprints/             # Sprint kartları, modallar, görev seçici
│   │   └── task-detail/         # Yandan açılan panel, ilişkiler, öneriler
│   └── lib/                     # Saf iş mantığı
│       ├── authz.ts             # Merkezi sunucu yetkilendirmesi
│       ├── mail.ts              # Nodemailer e-posta motoru
│       └── __tests__/           # 39 Vitest paketi (740 test)
└── docs/
    ├── screenshots/             # README ekran görüntüleri
    ├── wiki/                    # 36 Mimari Karar Kaydı (ADR)
    ├── spec/                    # Adım adım uygulama spesifikasyonları
    └── ai-context/              # Modüler yapay zekâ mimari özetleri
```

---

## Kurulum

### Ön Koşullar
- **Node.js:** v20 veya üzeri (npm v10+)
- **Docker & Docker Compose:** `pgvector` eklentili PostgreSQL 16 için
- **Python:** v3.11 veya üzeri *(isteğe bağlı — yalnızca `pulse-agent` koordinasyon servisi için)*

### Hızlı Başlangıç

1. **Depoyu klonlayın ve bağımlılıkları kurun:**
   ```bash
   git clone https://github.com/CodeByOktay/Pulse.git
   cd Pulse
   npm install
   ```
   Depodaki `.npmrc` dosyası `legacy-peer-deps=true` ayarını yapar: `next-auth@4`, `nodemailer@^7` için isteğe bağlı bir peer bağımlılığı tanımlar; Pulse ise kendi posta servisi için `nodemailer@^10` kullanır (next-auth e-posta sağlayıcısı kullanılmaz).
   npm 11 ve üzerinde Prisma ile `unrs-resolver` kurulum betikleri `package.json` içindeki `allowScripts` alanıyla önceden onaylanmıştır.

2. **Ortam değişkenlerini yapılandırın:**
   ```bash
   cp .env.example .env
   ```
   `NEXTAUTH_SECRET` değerini rastgele bir değerle değiştirin (`openssl rand -base64 32`).

3. **PostgreSQL veritabanını başlatın:**
   ```bash
   docker compose up -d db
   ```
   Bu komut yalnızca `pgvector/pgvector:pg16` veritabanını başlatır. Düz bir `postgres` imajı çalışmaz: migration'lar `vector` eklentisini gerektirir.
   *(Bağımsız alternatif: `docker run --name pulse-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pulse -p 5432:5432 -d pgvector/pgvector:pg16`)*

4. **Veritabanı migration'larını uygulayın:**
   ```bash
   npx prisma migrate dev
   ```

5. **(İsteğe bağlı) Zengin demo veri setini yükleyin:**
   ```bash
   npm run db:seed-rich
   ```
   *10 kullanıcı (şifre: `password123`), 5 proje, sprintler, görevler, yorumlar ve aktivite geçmişi oluşturur. Örnek giriş: `admin@pulse.local`.*

6. **Geliştirme sunucusunu başlatın:**
   ```bash
   npm run dev
   ```
   Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın.

7. **(İsteğe bağlı) Ajan servisini yerelde çalıştırın:**
   ```bash
   cd agent
   python -m venv .venv
   .venv/Scripts/activate          # Windows (Linux/macOS: source .venv/bin/activate)
   pip install -r requirements.txt
   python -m src.main
   ```
   Ajan, `DATABASE_URL` ve `INTERNAL_API_SECRET` değerlerini depo kökündeki `.env` dosyasından okur. Tüm ayarlar için [`agent/README.md`](agent/README.md) dosyasına bakın.

---

## Ortam Değişkenleri

Aşağıdaki değişkenleri `.env` dosyanızda tanımlayın (açıklamalı tam liste için [`.env.example`](.env.example) dosyasına bakın):

| Değişken | Açıklama | Örnek / Varsayılan |
|---|---|---|
| `DATABASE_URL` | PostgreSQL bağlantı dizesi | `postgresql://postgres:password@localhost:5432/pulse?schema=public` |
| `NEXTAUTH_SECRET` | JWT oturum şifrelemesi için gizli anahtar | `openssl rand -base64 32` ile üretin |
| `NEXTAUTH_URL` / `APP_URL` | Uygulamanın kanonik URL'si | `http://localhost:3000` |
| `INTERNAL_API_SECRET` | Next.js ile `pulse-agent` arasındaki ortak HMAC anahtarı | Yalnızca geliştirme için varsayılan; **production'da mutlaka değiştirilmeli** |
| `EMAIL_FROM` | Giden e-posta gönderici adresi | `Pulse <noreply@pulse.local>` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP gönderimi (Ethereal/konsol için host'u boş bırakın) | `smtp.example.com`, `587` |
| `AI_ENDPOINT` / `AI_MODEL` / `AI_API_KEY` | Yapay zekâ özellikleri için sağlayıcıdan bağımsız (OpenAI uyumlu) sohbet uç noktası | Boş = deterministik sezgisel yorumlayıcı |
| `AI_EMBEDDING_ENDPOINT` / `AI_EMBEDDING_MODEL` | Semantik arama için gömme uç noktası (1536 boyutlu vektörler) | Boş = yalnızca metin araması |

Gizli olmayan yapay zekâ ayarları alternatif olarak `ai.config.json` dosyasında tutulabilir ([`ai.config.example.json`](ai.config.example.json) dosyasından kopyalayın); API anahtarları yalnızca ortam değişkenlerinde bulunmalıdır.

---

## Veritabanı

Pulse, **Prisma ORM v6.19** ile yönetilen, **pgvector** eklentili **PostgreSQL 16** kullanır. Şema **26 Pulse modeli** (ayrıca ajan servisine ait 4 LangGraph checkpoint tablosu) ve **9 enum** içerir. Aşağıdaki diyagram çekirdek alan modelini gösterir.

```mermaid
erDiagram
    User ||--o{ Project : "owns"
    User ||--o{ ProjectMember : "belongs to"
    User ||--o{ TaskAssignee : "assigned to"
    User ||--o{ Comment : "writes"
    User ||--o{ Activity : "performs"
    User ||--o{ ProjectInvite : "sends"
    User ||--o{ Notification : "receives"
    User ||--o| UserNotificationPreference : "configures"
    User ||--o{ ProgressRequest : "creates"
    User ||--o{ ProgressResponse : "submits"
    User ||--o{ AgentProposal : "reviews"

    Project ||--o{ ProjectMember : "contains"
    Project ||--o{ State : "defines"
    Project ||--o{ Task : "manages"
    Project ||--o{ Label : "categorizes"
    Project ||--o{ Sprint : "schedules"
    Project ||--o{ ProjectInvite : "invites"

    State ||--o{ Task : "groups"

    Task ||--o{ TaskLabel : "tagged with"
    Task ||--o{ TaskAssignee : "worked on by"
    Task ||--o{ Comment : "discussed in"
    Task ||--o{ SprintTask : "planned in"
    Task ||--o{ Activity : "logged by"
    Task ||--o{ TaskRelation : "source relation"
    Task ||--o{ TaskRelation : "target relation"
    Task ||--o{ ProgressRequest : "tracks"
    Task ||--o{ AgentProposal : "receives"

    ProgressRequest ||--o| ProgressResponse : "fulfills"
    ProgressResponse ||--o| AgentProposal : "interpreted as"
    Sprint ||--o{ SprintTask : "includes"
```

### Temel Modeller & Enum'lar
- **Çekirdek Varlıklar:** `User`, `Project`, `ProjectMember`, `State`, `Task`, `Label`, `TaskAssignee`, `TaskLabel`, `Comment`.
- **Sprint Yönetimi:** `Sprint`, `SprintTask` (`SprintStatus`: `DRAFT`, `ACTIVE`, `COMPLETED`).
- **Denetim & İlişkiler:** `Activity` (24 tür, `isAiGenerated`), `TaskRelation` (`BLOCKS`, `RELATES_TO`, `DUPLICATES`).
- **Bildirimler & Tercihler:** `Notification` (12 tür), `UserNotificationPreference`, `ProjectInvite`.
- **Yapay Zekâ Koordinasyonu:** `ProgressRequest`, `ProgressResponse`, `AgentProposal` (`PENDING`, `APPROVED`, `REJECTED`, `STALE`).
- **Ajan Altyapısı:** `DomainEvent` (outbox), `AgentRun` (idempotent çalışma kaydı), `AgentSettings`, `SystemClock`, `DailyStandup`, `StandupEntry`.
- **Proje Hafızası:** `TaskEmbedding` (ivfflat kosinüs indeksli `vector(1536)`).

---

## Geliştirme İş Akışı

Pulse, **yapay zekâ destekli eşli programlama ve çift ajanlı bir protokol** ile geliştirilmiştir:

- **Antigravity (Baş Mimar & Kalite Otoritesi):** Mimari tasarım, ödünleşim analizi, ADR yazımı (`docs/wiki/`), yapay zekâ bağlam yönetimi (`docs/ai-context/`) ve tüm test paketlerinin (`src/lib/__tests__/`) sahipliğinden sorumludur.
- **Claude Code (Uygulayıcı):** Özellikleri veritabanı, server action ve arayüz katmanlarında uygular. Altın Kural'a uyar: *Test dosyaları asla değiştirilmez veya zayıflatılmaz; testler geçene kadar uygulama kodu düzeltilir.*

### Komutlar
```bash
npm run dev        # Yerel Next.js Turbopack geliştirme sunucusunu başlatır
npm test           # 740 Vitest birim ve entegrasyon testini çalıştırır
npx tsc --noEmit   # TypeScript tiplerini doğrular (sıfır hata)
npm run build      # Production derlemesini doğrular
cd agent && pytest # Ajan servisi için 98 Pytest testini çalıştırır
```

---

## Test

Pulse sıkı kalite güvence kurallarına uyar:
- **Saf Alan Mantığı Testi:** Server Action'lar ince tutulur; karmaşık algoritmalar, yan etkisiz ve deterministik biçimde test edilen izole saf fonksiyonlarda bulunur.
- **Kapsam:** **838 test** — 39 pakette 740 Vitest testi ve 17 pakette 98 Pytest testi — %100 geçme oranıyla.
- **Test Dokunulmazlığı:** Uygulama düzeltmeleri test doğrulamalarını (assertion) asla değiştirmemelidir.

```bash
# Tüm test paketini çalıştır
npm test

# Testleri izleme (watch) modunda çalıştır
npx vitest

# Belirli bir paketi çalıştır
npx vitest src/lib/__tests__/task-relations.test.ts
```

---

## RBAC Modeli

Pulse, proje bazında kapsamlandırılmış ayrıntılı Rol Tabanlı Erişim Kontrolü uygular:

| Yetki | OWNER | ADMIN | MEMBER |
|---|:---:|:---:|:---:|
| Pano, Liste ve Backlog görüntüleme | ✅ | ✅ | ✅ |
| Görev oluşturma, düzenleme ve taşıma | ✅ | ✅ | ✅ |
| Yorum ve ilişki ekleme | ✅ | ✅ | ✅ |
| Kişisel bildirim tercihlerini yönetme | ✅ | ✅ | ✅ |
| Sprint yönetimi (oluşturma, başlatma, tamamlama) | ✅ | ✅ | ❌ |
| Proje durumlarını ve etiketlerini yönetme | ✅ | ✅ | ❌ |
| Üye davet etme ve çıkarma | ✅ | ✅ | ❌ |
| Üye rollerini değiştirme | ✅ | ✅ | ❌ |
| Projeyi silme / sahipliği devretme | ✅ | ❌ | ❌ |

Tüm mutasyonlar merkezi sunucu korumalarından geçer: `requireSession`, `requireMembership`, `requireAdmin` ve `assertNotProjectOwner`.

---

## API Dokümantasyonu

Pulse, birincil mutasyon arayüzü olarak Next.js **Server Action**'larını (`"use server"`) kullanır; bunlara NextAuth route handler'ları eşlik eder:

### Server Action'lara Genel Bakış
- **`src/actions/task.ts`:** Görev CRUD, float konum hesabı, projeler arası ID doğrulaması, durum ataması.
- **`src/actions/sprint.ts`:** Sprint yaşam döngüsü geçişleri, atomik tamamlama koruması, görev–sprint ataması.
- **`src/actions/member.ts`:** Üye davetleri (7 günlük token'lar), rol yönetimi, üye çıkarma.
- **`src/actions/relation.ts`:** Yinelemeli DFS döngü kontrolü ve bakış açısı tersine çevirme ile bağımlılık oluşturma.
- **`src/actions/notification.ts`:** Uygulama içi bildirimleri getirme, toplu okundu işaretleme, yaklaşan son tarih kontrolleri.
- **`src/actions/progress.ts`:** İlerleme talebi oluşturma ve ekip üyesi yanıtı gönderme.
- **`src/actions/agent-proposal.ts`:** Yapay zekâ önerisi üretme, insan onayı ve reddetme işlemleri.
- **`src/actions/search.ts`:** Görevler ve proje adları üzerinde kapsamı sınırlı global arama.
- **`src/actions/semantic-search.ts`:** Proje hafızası üzerinde hibrit vektör/metin araması.
- **`src/actions/agent-settings.ts`, `standup.ts`, `clock.ts`:** Proje bazında ajan yapılandırması, standup gönderimi ve yalnızca geliştirme ortamına özel zaman simülasyonu.

### HTTP Uç Noktaları
- `GET/POST /api/auth/[...nextauth]` — NextAuth.js oturum ve kimlik doğrulama uç noktaları.
- `POST /api/auth/register` — Otomatik hoş geldin e-postası gönderimiyle yeni kullanıcı kaydı.
- `POST /api/internal/agent/*` — Yalnızca `pulse-agent` servisinin kullandığı, HMAC-SHA256 imzalı 17 uç nokta (kullanıcıya açık değildir).

---

## Dağıtım

Pulse, standart Docker ortamları ve bulut sağlayıcıları (Vercel, Railway, AWS ECS) için konteynerleştirilmiştir.

### Production Docker Derlemesi
Compose yığını üç servis çalıştırır: `db` (PostgreSQL + pgvector), `app` (Next.js production derlemesi) ve `agent` (Python koordinasyon servisi).
```bash
# 1. app konteyneri için ortam dosyası
cp .env.docker.example .env.docker   # ardından tüm yer tutucuları değiştirin

# 2. agent ve veritabanı, POSTGRES_PASSWORD / INTERNAL_API_SECRET değerlerini kök .env dosyasından okur;
#    INTERNAL_API_SECRET, .env.docker içindeki değerle aynı olmalıdır

# 3. Derle ve çalıştır
docker compose up --build -d
```

### Bağımsız Production Derlemesi
```bash
npm run build
npm run start
```

### Production Kontrol Listesi
- [ ] Güçlü ve rastgele bir `NEXTAUTH_SECRET` tanımlayın.
- [ ] Hem uygulama hem ajan için benzersiz bir `INTERNAL_API_SECRET` belirleyin — herkese açık varsayılan değer kullanılırken production derlemesi tüm ajan isteklerini reddeder.
- [ ] `POSTGRES_PASSWORD` değerini (ve buna karşılık gelen `DATABASE_URL`'yi) geliştirme varsayılanı olan `password`'den değiştirin.
- [ ] `NEXTAUTH_URL` / `APP_URL` değerlerini production alan adınıza göre ayarlayın.
- [ ] İşlemsel e-postalar için geçerli SMTP bilgilerini yapılandırın.
- [ ] Production veritabanında `npx prisma migrate deploy` çalıştırın.
- [ ] `ENABLE_TIME_TRAVEL` değişkenini tanımsız bırakın (zaman simülasyonu production'da varsayılan olarak kapalıdır).

---

## Yol Haritası

- [x] **Faz 1 (v0.1.0):** Çekirdek Kanban, kimlik doğrulama, görev CRUD, yandan açılan panel, float sıralama.
- [x] **Faz 2 (v0.2.0):** Sprintler/Döngüler, tablo biçiminde Liste Görünümü, denetim kaydı, toplu işlemler, markdown editörü, proje ayarları.
- [x] **Faz 3 (v0.3.0):** Üye davetleri, görev detay UX'i, Backlog Görünümü, global arama (Ctrl+K), analitik dashboard, gelişmiş filtreler, görev ilişkileri (bağımlılık grafiği & döngü önleme).
- [x] **Faz 4 (v0.4.0):** Yoklamalı uygulama içi bildirimler, kullanıcı bildirim tercihleri, `@mention` tespiti, son tarih uyarıları, Nodemailer servisi, zengin PRNG analitik veri seti.
- [x] **Faz 5 MVP & Sağlamlaştırma (v0.5.4):**
  - Domain Event temeli ve `TASK_UNBLOCKED` bağımlılık otomasyonu.
  - Etkileşimli `ProgressRequest` ve `ProgressResponse` yaşam döngüsü.
  - Yapay zekâ ilerleme yorumlama motoru ve insan onaylı `AgentProposal` arayüzü.
  - 4 dalgalı full-stack refaktör ve 3 hedefli sağlamlaştırma paketi (yetkilendirme birleştirme, modal UX, eşzamanlılık korumaları).
- [x] **Faz 6 (v0.6.0 – v0.6.7): Yapay Zekâ Ajan Koordinasyon Sistemi**
  - Python LangGraph servisi, `DomainEvent` kutusu, APScheduler, HMAC Internal API, test edilebilir saat (Agent-000 Supervisor).
  - Agent-001 Deadline Tracker, Agent-002 Task Hygiene, Agent-003 Status Requester (interrupt/resume).
  - Agent-004 Blocker Manager, Agent-009 Scope Creep Detection.
  - Agent-005 Async Standup, Agent-006 Weekly Sprint Digest.
  - Agent-007 Workload Balancer, Agent-008 Sprint Assistant.
  - Proje Hafızası & RAG semantik arama (pgvector), Slot Replay & zaman yolculuğu güvenliği, çok ajanlı konsolidasyon.

---

## Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen şu adımları izleyin:

1. **Depoyu fork'layın** ve açıklayıcı bir özellik dalı oluşturun:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Kod standartlarına uyun:**
   - İş mantığını `src/lib/` altında saf ve test edilebilir fonksiyonlarda tutun.
   - `src/lib/__tests__/` altındaki mevcut test paketlerini asla zayıflatmayın veya değiştirmeyin.
   - Göndermeden önce tüm kontrollerin geçtiğinden emin olun:
     ```bash
     npm test
     npx tsc --noEmit
     npm run build
     ```
3. Değişiklikleri ve gerekçelerini ayrıntılı biçimde özetleyen bir **Pull Request gönderin**.

---

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

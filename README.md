# Pulse Project Manager — Modern Proje Yönetim Sistemi

> Next.js 16 (App Router), PostgreSQL, Prisma ORM, NextAuth ve @dnd-kit kullanılarak geliştirilmiş modern, hızlı ve kurumsal seviyede proje yönetim platformu.

![Sürüm](https://img.shields.io/badge/s%C3%BCr%C3%BCm-v0.5.4-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Testler](https://img.shields.io/badge/Vitest-528%20passed-success?logo=vitest)

---

## 📌 Proje Hakkında

Pulse, popüler açık kaynak proje yönetim sistemlerinin (özellikle **Plane** ve kısmen **Vikunja**, **Focalboard**) mimari desenlerinden kavramsal ilham alınarak inşa edilmiştir.

Küçük ve orta ölçekli yazılım ekipleri için gereksiz karmaşıklıktan arındırılmış, milisaniyelik tepki hızına sahip ve klavye/fare ergonomisini ön planda tutan bir kullanıcı deneyimi sunar.

---

## ✨ Temel Özellikler (Faz 1 — MVP)

- 🔐 **Güvenli Kimlik Doğrulama:** NextAuth.js ile e-posta/şifre tabanlı kayıt/giriş, bcryptjs (salt 12) şifreleme ve rota koruma middleware'i.
- 📁 **Çalışma Alanı & Proje Yönetimi:** Çoklu proje desteği, proje bazlı kısa tanımlayıcı kod (`PRJ`, `MOB`), otomatik tohumlanan 5 varsayılan durum (`Backlog`, `Todo`, `In Progress`, `Done`, `Cancelled`).
- 🔢 **Proje Kapsamlı Sequence ID:** Görevlerin global sayaç yerine projenin koduna göre artan numaralar alması (`PRJ-1`, `PRJ-2`).
- 📋 **Sürükle-Bırak Kanban Panosu:** `@dnd-kit` ile kolon içi dikey sıralama, kolonlar arası kart geçişleri, boş kolonlara kart bırakabilme ve kullanıcıyı bekletmeyen İyimser UI Güncellemeleri (Optimistic Updates).
- ⚡ **Kayan Noktalı (Float) Sıralama:** Kart konumlarının $O(1)$ sürede `(üst + alt) / 2` float aritmetiği ile hesaplanması; tüm listeyi yeniden indekslememe avantajı.
- 🏷️ **Etiketler & Atamalar:** Görevlere çoklu etiket bağlama, proje üyelerini görevlendirme, deterministik avatar renk motoru ve 10'lu kontrast renk paleti.
- 📑 **Slide-Over Görev Detay Çekmecesi:** Kart tıklamasıyla sağdan açılan 720px'lik panel, anlık tıkla-düzenle başlık, odak kalkınca (`onBlur`) otomatik kaydeden açıklama textarea'sı.
- 💬 **Yorum Sistemi:** Görev içi kronolojik tartışma akışı; kullanıcıların yalnızca kendi yorumlarını silebilmesini sağlayan çift katmanlı (UI + Server Action) güvenlik duvarı.
- 🔍 **URL Tabanlı Filtreleme & Sıralama:** Yer imlerine eklenebilir ve paylaşılabilir filtreler (`?priority=...&label=...&sort=...`), dinamik sayaç, tek tıkla filtre temizleme.
- 🧭 **Navigasyon & Boş Durumlar:** Breadcrumb ekmek kırıntısı, 256px koyu tema Sidebar, kullanıcı avatar açılır menüsü ve 3 farklı senaryoya özel Empty State kartları.

## 🚀 Faz 2 Özellikleri (v0.2.0)

- 🏃 **Sprint / Cycle Yönetimi:** Taslak → Aktif → Tamamlandı durum akışı, tek seferde tek aktif sprint kısıtı, sprint bazlı ilerleme çubuğu ve gecikme (overdue) rozeti.
- 📊 **Liste Görünümü:** Kanban'a alternatif, sıralanabilir sütun başlıklı, state'e göre gruplanan ve gruplar açılıp kapanabilen (collapsible) tablo görünümü; `ViewSwitcher` ile Board ↔ Liste geçişi.
- 📜 **Aktivite / Audit Log:** 15 farklı `ActivityType` ile her görev mutasyonunun (durum, öncelik, atama, etiket, sprint, yorum) otomatik olarak kaydedilmesi ve Türkçe okunabilir mesajlara çevrilmesi.
- ☑️ **Toplu İşlemler (Bulk Actions):** Liste görünümünde çoklu görev seçimi (tümünü seç / indeterminate durum), toplu durum-öncelik değiştirme, toplu sprint'e ekleme ve onay dialoglu toplu silme.
- ✍️ **Markdown Desteği:** Görev açıklamalarında Yaz/Önizle sekmeli editör, seçili metni saran araç çubuğu (kalın/italik/kod/liste/link), Kanban kartında düz metin önizleme.
- ⚙️ **Proje Ayarları:** Yalnızca `ADMIN` rolüne açık durum (state) ve etiket yönetim paneli; sürükle-bırakla durum sıralama, renk seçici, kullanım sayısı gösterimi ve güvenli silme kısıtları.

## 🎯 Faz 3 Özellikleri (v0.3.0)

- 👥 **Üye Yönetimi & Davet Sistemi:** `ADMIN` yetkisiyle e-posta daveti (32 byte token, 7 gün geçerli), davet linki kopyalama, rol değiştirme ve üye çıkarma; proje sahibi çıkarılamaz ve rolü değiştirilemez.
- 🎛️ **Görev Detayı Premium UX:** Satır içi durum/öncelik seçicileri (klavye ile gezinilebilir, iyimser güncelleme + geri alma), breadcrumb, tıkla-düzenle tarih alanları ve paylaşılabilir görev bağlantısı (`?task=`).
- 📥 **Backlog Görünümü:** Hiçbir aktif/taslak sprint'e bağlı olmayan görevlerin listesi, sprint ilerleme kartları ve tek tıkla "Sprint'e Taşı"; tamamlanmış sprint geçmişi asla silinmez.
- 🔎 **Global Arama & Komut Paleti:** `Ctrl+K` / `Cmd+K` ile açılan, görev başlığı ve `PRJ-12` tanımlayıcısıyla arama yapan, ok tuşlarıyla gezilebilen komut paleti ve proje bazlı hızlı aksiyonlar.
- 📈 **Dashboard & Analytics:** 4 istatistik kartı, "Bana Atananlar" widget'ı, son aktivite akışı ve sprint hızı paneli (tamamlanma oranı, burndown, ortalama hız) — harici grafik kütüphanesi kullanılmadan, saf Tailwind ile.
- 🧰 **Gelişmiş Filtreler & Kayıtlı Görünümler:** Durum grubu, bitiş tarihi (gecikmiş/bugün/bu hafta/tarihsiz) ve metin araması; tek tıklık hızlı filtre çipleri ve `localStorage` tabanlı, proje bazlı kayıtlı görünümler.
- 🔗 **Görev İlişkileri & Bağımlılıklar:** `Engelliyor` / `Tarafından engelleniyor` / `İlişkili` / `Kopyası` ilişkileri; tek yönlü tek kayıt depolama, çift ilişki engelleme ve iteratif DFS ile döngü önleme.

## 🔔 Faz 4 Özellikleri (v0.4.0 — Bildirimler & İletişim)

- 📬 **Uygulama İçi Bildirimler & Polling:** Görev atamaları, yorumlar ve sprint tamamlanma olaylarında anlık bildirimler, okunmamış sayacı rozeti, 30 saniyelik sekme duyarlı polling.
- ⚙️ **Kullanıcı Bildirim Tercihleri & @Mention:** `@kullanici` etiketleme tespiti, çift bildirim engelleme, 5 farklı kanal için kullanıcı tercih anahtarları, 0/1/3 takvim günü yaklaşan son tarih uyarıları.
- ✉️ **Evrensel E-posta Servisi (Nodemailer):** Canlı SMTP, Brevo, Ethereal test hesabı desteği; modern ve XSS-güvenli hoş geldiniz ve üye davet e-posta şablonları.
- 🎲 **Zengin Analitik Veri Tohumlayıcı:** 10 persona, 5 proje, 500 görev, 1.000 yorum ve 3.000 aktivite içeren deterministik PRNG veri seti (`npm run db:seed-rich`).

## 🤖 Faz 5 Özellikleri (v0.5.4 — AI Koordinasyonu & Mimari Sağlamlaştırma)

- ⚡ **Alan Olayları & Otomasyon Temeli:** 23 aktivite tipi, 7 bildirim tipi; engelleyici görev tamamlandığında otomatik `TASK_UNBLOCKED` bildirimi.
- 💬 **İlerleme Talebi ve Yanıtlama (Progress Collection):** Yöneticilerin görev sahiplerinden tek tıkla durum sorgulaması ve kullanıcıların modal üzerinden ilerleme yanıtı vermesi.
- 🧠 **AI İlerleme Yorumlama & Öneri Sistemi (AgentProposal):** Doğal dil ilerleme yanıtlarını analiz ederek durum, yüzde ve blokaj çıkarımı yapan sağlayıcı-bağımsız AI motoru; insan onaylı `AgentProposalCard` onay arayüzü.
- 🛡️ **Kapsamlı Kod Tabanı Refaktörü & 3 Sağlamlaştırma Paketi:**
  - `src/lib/authz.ts` merkezi yetkilendirmesi ile 12 server action'ın sadeleştirilmesi.
  - Projeler arası IDOR güvenlik açığının kapatılması (`cancelInvite`, `createTask`, `updateTask`).
  - React 19 render-phase senkronizasyonu ve `useTaskNavigation` hook'u ile URL derin bağlantı birleştirmesi.
  - `completeSprint` atomik `updateMany` kilidi ile yarış durumlarının (race condition) önlenmesi.
  - `ColorPicker` bileşeninde 200ms debounce ve render-phase prop senkronizasyonu.
  - 528 Vitest birim/entegrasyon testi (%100 yeşil).

---

## 🏗️ Teknoloji Yığını (Tech Stack)

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | Server Components, Server Actions ve SSR |
| **Dil** | TypeScript 5 | Sıkı tip denetimi (strict mode) |
| **Stil / Arayüz** | Tailwind CSS v4, Lucide React | Modern, minimalist ve koyu/açık tema uyumlu tasarım |
| **Sürükle-Bırak** | @dnd-kit (core, sortable, utilities) | Yüksek performanslı ve erişilebilir DnD motoru |
| **Markdown** | react-markdown + remark-gfm | GFM uyumlu Markdown render motoru |
| **ORM** | Prisma ORM 6.19 | Tip güvenli veritabanı modelleme ve migration |
| **Veritabanı** | PostgreSQL 16 (Docker) | Güçlü ilişkisel veritabanı altyapısı |
| **Kimlik Doğrulama** | NextAuth.js v4 + bcryptjs | JWT oturum stratejisi ve Edge Middleware |
| **E-posta Servisi** | Nodemailer | Universal SMTP / Ethereal / console e-posta motoru |
| **Test Aracı** | Vitest 5 | 528 birim ve entegrasyon testi (27 test paketi) |

---

## 🏛️ Mimari Varlık Modeli (Entity-Relationship)

Veritabanında tanımlı 19 ana model ve ilişkileri:

```mermaid
erDiagram
    User ||--o{ Project : "oluşturur"
    User ||--o{ ProjectMember : "üyesidir"
    User ||--o{ TaskAssignee : "atanır"
    User ||--o{ Comment : "yazar"
    User ||--o{ Activity : "gerçekleştirir"
    User ||--o{ ProjectInvite : "davet gönderir"
    User ||--o{ Notification : "alır"
    User ||--o| UserNotificationPreference : "sahiptir"
    User ||--o{ ProgressRequest : "talep eder"
    User ||--o{ ProgressResponse : "yanıtlar"
    User ||--o{ AgentProposal : "inceler / onaylar"

    Project ||--o{ ProjectMember : "barındırır"
    Project ||--o{ State : "tanımlar"
    Project ||--o{ Task : "içerir"
    Project ||--o{ Label : "kapsar"
    Project ||--o{ Sprint : "planlar"
    Project ||--o{ ProjectInvite : "davet açar"

    State ||--o{ Task : "gruplar (Restrict)"

    Task ||--o{ TaskLabel : "bağlanır"
    Task ||--o{ TaskAssignee : "bağlanır"
    Task ||--o{ Comment : "içerir"
    Task ||--o{ SprintTask : "bağlanır"
    Task ||--o{ Activity : "kaydeder"
    Task ||--o{ TaskRelation : "kaynak (Blocks/Relates/Duplicates)"
    Task ||--o{ TaskRelation : "hedef"
    Task ||--o{ ProgressRequest : "izler"
    Task ||--o{ AgentProposal : "öneri alır"

    ProgressRequest ||--o| ProgressResponse : "yanıtlanır"
    ProgressResponse ||--o| AgentProposal : "yorumlanır"

    Label ||--o{ TaskLabel : "etiketler"

    Sprint ||--o{ SprintTask : "kapsar"
```

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- **Node.js:** v20 veya üzeri
- **Docker Desktop:** (PostgreSQL servisi için)

### 1. Depoyu Klonlayın ve Bağımlılıkları Yükleyin
```bash
cd C:\Pulse
npm install
```

### 2. Ortam Değişkenlerini Tanımlayın (`.env`)
Proje kökündeki `.env` dosyasını kontrol edin veya oluşturun:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/pulse?schema=public"
NEXTAUTH_SECRET="super-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Veritabanını Başlatın ve Şemayı Senkronize Edin
Docker PostgreSQL konteynerini başlatın:
```bash
docker run --name pulse-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pulse -p 5432:5432 -d postgres:16
```

Prisma migration'larını veritabanına uygulayın:
```bash
npx prisma migrate dev
```

*(Opsiyonel)* Varsayılan demo verilerini tohumlayın:
```bash
npx prisma db seed
```

### 4. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```
Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın.

---

## 🧪 Testleri Çalıştırma

Kritik iş kurallarını (Filtreler, Sıra Numaraları, Kayan Noktalı Sıralama, Renk Motoru, Sprint, Aktivite Logu, Toplu İşlemler, Markdown, Ayarlar, Üye Yönetimi, Backlog, Arama, Analytics, Görev İlişkileri) test etmek için:

```bash
npm test
```

Tip kontrolü ve üretim derlemesi:
```bash
npx tsc --noEmit
npm run build
```

---

## 🗺️ Yol Haritası (Roadmap)

- [x] **Faz 1: Temel Kanban Panosu ve Proje Yönetimi MVP (v0.1.0)** — *Tamamlandı*
  - [x] NextAuth e-posta/şifre kimlik doğrulama
  - [x] Proje CRUD, Dashboard & Sidebar
  - [x] Görev CRUD, Proje Sequence ID (`PRJ-1`) & Float Sıralama
  - [x] Etiketler, Atamalar ve Deterministik Avatar Renkleri
  - [x] Sürükle-Bırak Kanban Panosu (@dnd-kit)
  - [x] Slide-Over Görev Detay Çekmecesi & Yorumlar
  - [x] URL Tabanlı Filtreleme ve Sıralama
  - [x] 14 Adet Vitest Otomatik Testi
- [x] **Faz 2: Sprint/Cycle & Gelişmiş Görünümler (v0.2.0)** — *Tamamlandı*
  - [x] Sprint (Cycle) döngüleri ve sprint bazlı filtreleme
  - [x] Liste Görünümü (List View) ve tablo görünümü
  - [x] Aktivite Geçmişi ve Değişiklik Günlüğü (Audit Log)
  - [x] Toplu Görev İşlemleri (Bulk Actions)
  - [x] Görev Açıklamasında Markdown Desteği
  - [x] Proje Ayarları (Durum & Etiket Yönetimi)
  - [x] 136 Adet Vitest Otomatik Testi
- [x] **Faz 3: UX/UI Kalitesi & Proje Yönetimi Yetenekleri (v0.3.0)** — *Tamamlandı*
  - [x] Üye Yönetimi & Proje Davet Sistemi
  - [x] Görev Detayı Premium UX (satır içi seçiciler, breadcrumb, bağlantı kopyalama)
  - [x] Backlog Görünümü & Sprint Entegrasyonu
  - [x] Global Arama & Komut Paleti (Ctrl+K)
  - [x] Dashboard Yenileme & Analytics
  - [x] Gelişmiş Filtreler & Kayıtlı Görünümler
  - [x] Görev İlişkileri (Engelliyor / İlişkili / Kopyası) ve döngü tespiti
- [ ] **Backlog (Gelecek Fikirler)**
  - [ ] E-posta ve uygulama içi bildirimler
  - [ ] Yapay Zekâ Destekli Görev Özeti ve Otomasyon

> **Kimlik doğrulama kapsamı:** Pulse yalnızca NextAuth **CredentialsProvider** (e-posta/şifre + bcrypt) mimarisiyle devam eder. Harici kimlik sağlayıcı entegrasyonu proje kapsamı dışındadır ve yol haritasında yer almaz.

---

## 📄 Lisans & Vizyon

Pulse Project Manager kurumsal seviyede, modern ve açık kaynak mimarilerden ilham alan bir proje yönetim platformudur.

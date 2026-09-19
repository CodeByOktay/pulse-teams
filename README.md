# Pulse — Modern Kanban-First Proje Yönetim Uygulaması

> Next.js 16 (App Router), PostgreSQL, Prisma ORM, NextAuth ve @dnd-kit kullanılarak geliştirilmiş modern, hızlı ve kurumsal seviyede proje yönetim (PM) sistemi.

![Sürüm](https://img.shields.io/badge/s%C3%BCr%C3%BCm-v0.2.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Testler](https://img.shields.io/badge/Vitest-136%20passed-success?logo=vitest)

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

## 🚀 Yeni Özellikler (Faz 2 — v0.2.0)

- 🏃 **Sprint / Cycle Yönetimi:** Taslak → Aktif → Tamamlandı durum akışı, tek seferde tek aktif sprint kısıtı, sprint bazlı ilerleme çubuğu ve gecikme (overdue) rozeti.
- 📊 **Liste Görünümü:** Kanban'a alternatif, sıralanabilir sütun başlıklı, state'e göre gruplanan ve gruplar açılıp kapanabilen (collapsible) tablo görünümü; `ViewSwitcher` ile Board ↔ Liste geçişi.
- 📜 **Aktivite / Audit Log:** 15 farklı `ActivityType` ile her görev mutasyonunun (durum, öncelik, atama, etiket, sprint, yorum) otomatik olarak kaydedilmesi ve Türkçe okunabilir mesajlara çevrilmesi.
- ☑️ **Toplu İşlemler (Bulk Actions):** Liste görünümünde çoklu görev seçimi (tümünü seç / indeterminate durum), toplu durum-öncelik değiştirme, toplu sprint'e ekleme ve onay dialoglu toplu silme.
- ✍️ **Markdown Desteği:** Görev açıklamalarında Yaz/Önizle sekmeli editör, seçili metni saran araç çubuğu (kalın/italik/kod/liste/link), Kanban kartında düz metin önizleme.
- ⚙️ **Proje Ayarları:** Yalnızca `ADMIN` rolüne açık durum (state) ve etiket yönetim paneli; sürükle-bırakla durum sıralama, renk seçici, kullanım sayısı gösterimi ve güvenli silme kısıtları.

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
| **Test Aracı** | Vitest 5 | Hızlı ve ESM uyumlu otomatik birim testi çalıştırma |

---

## 🏛️ Mimari Varlık Modeli (Entity-Relationship)

Veritabanında tanımlı 12 ana model ve ilişkileri:

```mermaid
erDiagram
    User ||--o{ Project : "oluşturur"
    User ||--o{ ProjectMember : "üyesidir"
    User ||--o{ TaskAssignee : "atanır"
    User ||--o{ Comment : "yazar"
    User ||--o{ Activity : "gerçekleştirir"

    Project ||--o{ ProjectMember : "barındırır"
    Project ||--o{ State : "tanımlar"
    Project ||--o{ Task : "içerir"
    Project ||--o{ Label : "kapsar"
    Project ||--o{ Sprint : "planlar"

    State ||--o{ Task : "gruplar (Restrict)"

    Task ||--o{ TaskLabel : "bağlanır"
    Task ||--o{ TaskAssignee : "bağlanır"
    Task ||--o{ Comment : "içerir"
    Task ||--o{ SprintTask : "bağlanır"
    Task ||--o{ Activity : "kaydeder"

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

Kritik iş kurallarını (Filtreler, Sıra Numaraları, Kayan Noktalı Sıralama, Renk Motoru, Sprint, Aktivite Logu, Toplu İşlemler, Markdown, Ayarlar) test etmek için:

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
- [ ] **Faz 3: Entegrasyonlar, Bildirimler & AI (v0.3.0)**
  - [ ] E-posta ve uygulama içi bildirimler
  - [ ] OAuth entegrasyonu (Google & GitHub)
  - [ ] Yapay Zekâ Destekli Görev Özeti ve Otomasyon

---

## 📄 Lisans

Bu proje eğitim ve staj geliştirme amacıyla oluşturulmuştur.

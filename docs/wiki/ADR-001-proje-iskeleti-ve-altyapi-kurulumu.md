# Faz 1.01 — Proje İskeleti & Altyapı Kurulumu: Teknik Rapor

> **Proje:** Pulse Project Manager  
> **Faz:** 1.01 (Proje Altyapısı)  
> **Tarih:** 17 Eylül 2026  
> **Durum:** ✅ Tamamlandı

---

## 1. Proje Genel Bakış

Bu rapor, proje kök dizininde hayata geçirilen Pulse Project Manager uygulamasının ilk altyapı fazını (Faz 1.01) belgelemektedir. Hedef; üretim kalitesinde, sürdürülebilir ve ölçeklenebilir bir Next.js + PostgreSQL + Prisma yığını oluşturmaktır.

### Referans Alınan Açık Kaynak Projeler

| Proje | Lisans | Alınan İlham |
|-------|--------|-------------|
| [Plane](https://github.com/makeplane/plane) | AGPL-3.0 | State/StateGroup modeli, float sortOrder, sequence ID pattern |
| [Vikunja](https://github.com/go-vikunja/vikunja) | AGPL-3.0 | Bucket bazlı Kanban yaklaşımı |
| [Focalboard](https://github.com/mattermost/focalboard) | AGPL-3.0 | Board/Block soyutlaması |

> ⚠️ Bu projelerden **hiçbir kaynak kodu kopyalanmamıştır.** Tüm referanslar kavramsal düzeydedir.

---

## 2. Teknoloji Yığını (Tech Stack)

```
┌─────────────────────────────────────────────────┐
│                    FRONTEND                     │
│  Next.js 15 (App Router) + TypeScript           │
│  Tailwind CSS + lucide-react                    │
│  @dnd-kit (sürükle-bırak)                       │
│  clsx (koşullu CSS sınıfları)                   │
├─────────────────────────────────────────────────┤
│                 AUTH KATMANI                    │
│  NextAuth.js v5                                 │
│  @auth/prisma-adapter                           │
│  bcryptjs (şifre hashleme)                      │
├─────────────────────────────────────────────────┤
│               VERİTABANI KATMANI                │
│  Prisma ORM (schema-first)                      │
│  PostgreSQL 15                                  │
│  Veritabanı: pulse_db                            │
├─────────────────────────────────────────────────┤
│                   PLATFORM                      │
│  Node.js 20+ / pnpm                             │
│  Geliştirme: localhost:3000                     │
└─────────────────────────────────────────────────┘
```

---

## 3. Yazılım Mimarisi

### 3.1 Genel Mimari Diyagramı

```
Pulse/
│
├── src/
│   ├── app/                    ← Next.js App Router (sayfa ve API)
│   │   ├── (auth)/             ← Gruplandırılmış route: Auth sayfaları
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (main)/             ← Gruplandırılmış route: Uygulama sayfaları
│   │   │   ├── page.tsx        ← Dashboard
│   │   │   └── projects/
│   │   │       └── [projectId]/
│   │   │           └── board/  ← Kanban board
│   │   └── api/
│   │       └── auth/           ← NextAuth API endpoint'leri
│   │
│   ├── components/             ← Yeniden kullanılabilir React bileşenleri
│   │   ├── auth/
│   │   ├── board/
│   │   ├── layout/
│   │   ├── projects/
│   │   └── ui/
│   │
│   ├── lib/                    ← Yardımcı modüller
│   │   ├── prisma.ts           ← Prisma singleton (bu fazda oluşturuldu)
│   │   └── auth.ts             ← NextAuth konfigürasyonu (Faz 1.03)
│   │
│   ├── actions/                ← Next.js Server Actions
│   │   ├── project.ts
│   │   ├── task.ts
│   │   └── comment.ts
│   │
│   └── middleware.ts           ← Route koruması (auth guard)
│
├── prisma/
│   ├── schema.prisma           ← Veritabanı şema tanımı
│   └── seed.ts                 ← Başlangıç verisi scripti
│
├── .env                        ← Ortam değişkenleri (git'e eklenmez)
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

### 3.2 Mimari Katmanlar

#### Katman 1 — Sunum Katmanı (Presentation Layer)
- **Next.js App Router** ile dosya bazlı yönlendirme
- **Server Components** (varsayılan): veri çekme işlemleri sunucuda yapılır, tarayıcıya sadece HTML gider
- **Client Components** (`"use client"`): sadece etkileşim gerektiren bileşenler (Kanban board, form inputları)

#### Katman 2 — İş Mantığı Katmanı (Business Logic Layer)
- **Server Actions** (`src/actions/`): Form submit ve veri mutasyonları için
- Doğrudan API route yazmaya gerek kalmaz (Next.js 14+ pattern)
- Her action: oturum kontrolü → iş kuralı → Prisma çağrısı → revalidatePath

#### Katman 3 — Veri Erişim Katmanı (Data Access Layer)
- **Prisma ORM**: tip güvenli veritabanı sorguları
- Tüm DB işlemleri Prisma Client üzerinden, ham SQL yazmaktan kaçınılır
- `src/lib/prisma.ts` global singleton: geliştirme ortamında hot-reload sırasında birden fazla bağlantı açılmasını önler

#### Katman 4 — Veritabanı
- **PostgreSQL** ilişkisel veritabanı
- Şema Prisma üzerinden yönetilir (`prisma db push` veya migration)

---

## 4. Bu Fazda Kurulan Altyapı

### 4.1 Prisma Singleton (`src/lib/prisma.ts`)

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Neden bu pattern?**
- Next.js geliştirme sunucusu her dosya değişikliğinde modülleri yeniden yükler (hot-reload)
- Her yeniden yüklemede yeni `PrismaClient` açılsa PostgreSQL bağlantı havuzu dolar
- `globalThis` üzerinde saklayarak tek örnek (singleton) garantilenir

### 4.2 Ortam Değişkenleri (`.env`)

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/pulse_db?schema=public"
NEXTAUTH_SECRET="super-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

> ⚠️ `.env` dosyası `.gitignore`'a eklenmiştir. Gerçek şifreler asla Git geçmişine girmez.

### 4.3 Kurulu Bağımlılıklar

| Paket | Versiyon | Amaç |
|-------|----------|------|
| `next` | 15.x | React framework, App Router |
| `typescript` | 5.x | Tip güvenliği |
| `tailwindcss` | 3.x | Utility-first CSS |
| `prisma` | 6.x | ORM CLI araçları |
| `@prisma/client` | 6.x | Tip güvenli DB istemcisi |
| `next-auth` | 5.x (beta) | Kimlik doğrulama |
| `@auth/prisma-adapter` | latest | NextAuth ↔ Prisma köprüsü |
| `bcryptjs` | 2.x | Şifre hashleme |
| `@dnd-kit/core` | latest | Sürükle-bırak çekirdeği |
| `@dnd-kit/sortable` | latest | Sıralanabilir listeler |
| `@dnd-kit/utilities` | latest | DnD yardımcı fonksiyonlar |
| `clsx` | 2.x | Koşullu CSS birleştirme |
| `lucide-react` | latest | İkon seti |

---

## 5. Alınan Mimari Kararlar

### Karar 1: Next.js App Router (dosya bazlı route grupları)
- `(auth)` ve `(main)` parantezli klasörler route gruplama için — URL'e yansımaz
- Auth sayfaları sidebar'sız, uygulama sayfaları sidebar'lı layout kullanır
- **Alternatif:** Pages Router — daha eski, daha az özellik → Reddedildi

### Karar 2: Server Actions (API route yerine)
- Veri mutasyonları için ayrı `api/` endpoint'i yazmak yerine Server Actions kullanılır
- Avantaj: tip güvenliği, form submit işlemi basitleşir, istemci tarafı fetch kodu yazılmaz
- **Alternatif:** REST API routes — daha fazla kod, daha fazla tip uyumsuzluğu riski → Reddedildi

### Karar 3: Prisma db push (migration yerine)
- Geliştirme aşamasında `prisma db push` şemayı doğrudan uygular, migration dosyası oluşturmaz
- Üretim için ilerleyen fazlarda `prisma migrate dev` kullanımına geçilecek
- **Alternatif:** Drizzle ORM — daha hafif ama Prisma'nın tip üretimi daha güçlü → Reddedildi

### Karar 4: bcryptjs (native bcrypt yerine)
- `bcryptjs`: saf JavaScript, derleme gerektirmez, Windows'ta sorunsuz çalışır
- `bcrypt`: C++ native binding, Windows'ta kurulum sorunları çıkabilir
- **Seçilen:** `bcryptjs` — taşınabilirlik öncelikli

### Karar 5: @dnd-kit (react-beautiful-dnd yerine)
- `react-beautiful-dnd`: bakımı durduruldu (deprecated), React 18 ile sorunları var
- `@dnd-kit`: aktif geliştirme, React 18+ ile uyumlu, erişilebilirlik desteği iyi
- **Seçilen:** `@dnd-kit` — güncel ve sürdürülebilir

---

## 6. Veri Akışı

```
Kullanıcı Eylemi (tıklama, form submit)
         │
         ▼
  Client Component
  ("use client" bileşen)
         │
         ▼
  Server Action çağrısı
  (src/actions/*.ts)
         │
         ├── Session kontrolü (getServerSession)
         ├── Input validasyonu
         │
         ▼
  Prisma Client
  (src/lib/prisma.ts singleton)
         │
         ▼
  PostgreSQL Veritabanı
  (pulse_db)
         │
         ▼
  revalidatePath() → Next.js cache temizlenir
         │
         ▼
  Server Component yeniden render eder
  → Kullanıcı güncel veriyi görür
```

---

## 7. Kabul Kriterleri Doğrulama

| Kriter | Durum | Not |
|--------|-------|-----|
| `npm run dev` çalışıyor, `localhost:3000` açılıyor | ✅ | Next.js varsayılan sayfası görünüyor |
| `prisma/schema.prisma` dosyası mevcut | ✅ | `npx prisma init` ile oluşturuldu |
| `src/lib/prisma.ts` dosyası mevcut | ✅ | globalThis singleton pattern |
| `.env` dosyasında `DATABASE_URL` tanımlı | ✅ | PostgreSQL bağlantı string'i ayarlı |
| `package.json`'da tüm bağımlılıklar listelenmiş | ✅ | 11 paket kuruldu |

---

## 8. Bilinen Kısıtlamalar & Sonraki Adımlar

### Bu fazda kasıtlı olarak yapılmayanlar:
- ❌ Veritabanı şema tanımı (Faz 1.02'de yapılacak)
- ❌ Kullanıcı arayüzü / sayfalar (Faz 1.03-I'da yapılacak)
- ❌ Auth sistemi (Faz 1.03'de yapılacak)
- ❌ Herhangi bir iş mantığı

### Sonraki Adım — Faz 1.02:
- `prisma/schema.prisma` içine 9 tablo tanımlanacak
- Seed script ile 5 varsayılan Kanban state'i oluşturulacak
- `npx prisma db push` ile şema veritabanına uygulanacak

---

## 9. Sorun Giderme Rehberi

| Sorun | Olası Neden | Çözüm |
|-------|-------------|-------|
| `npm run dev` hata veriyor | Node.js sürümü eski | Node.js 20+ yükle |
| Prisma import hatası | `@prisma/client` generate edilmedi | `npx prisma generate` çalıştır |
| `.env` değişkenleri tanınmıyor | `.env.local` kullanılıyor | `.env` olarak yeniden oluştur |
| Port 3000 meşgul | Başka bir uygulama kullanıyor | `npx next dev -p 3001` ile farklı port |
| `bcryptjs` import hatası | `@types/bcryptjs` eksik | `npm install -D @types/bcryptjs` |

---

*Bu rapor Faz 1.01 tamamlandığında oluşturulmuştur. Faz 1.02 tamamlandığında güncellenecektir.*
